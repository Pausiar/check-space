import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'

export function runPowerShell(script, { timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const prelude = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = "SilentlyContinue"; '
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', prelude + script],
      { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 256 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          err.stderr = stderr
          reject(err)
        } else {
          resolve(stdout)
        }
      }
    )
  })
}

// ============================================
// Drive detection
// ============================================

async function getDrivesWindows() {
  // DriveType: 2 = removable (USB, SD), 3 = fixed
  const script =
    'Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 3 } | ' +
    'Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem, DriveType | ConvertTo-Json -Compress'
  const output = (await runPowerShell(script, { timeout: 20000 })).trim()
  if (!output) return []
  const parsed = JSON.parse(output)
  const disks = Array.isArray(parsed) ? parsed : [parsed]
  return disks
    .filter((d) => d.Size > 0) // card readers without media report no size
    .map((disk) => ({
      letter: disk.DeviceID.replace(':', ''),
      path: disk.DeviceID + '\\',
      label: disk.VolumeName || '',
      totalSize: disk.Size,
      freeSpace: disk.FreeSpace,
      usedSpace: disk.Size - disk.FreeSpace,
      fileSystem: disk.FileSystem || '',
      type: disk.DriveType === 2 ? 'removable' : 'fixed'
    }))
}

// Local filesystems worth showing. Network and pseudo filesystems are skipped:
// they are not storage the user can clean up here.
const LINUX_FS = new Set([
  'ext2',
  'ext3',
  'ext4',
  'btrfs',
  'xfs',
  'f2fs',
  'vfat',
  'exfat',
  'ntfs',
  'ntfs3',
  'fuseblk',
  'zfs',
  'bcachefs',
  'hfs',
  'hfsplus'
])

// Mounts that are part of the system image or read-only metadata, not user
// storage. /media and /run/media are intentionally kept: removable drives
// usually appear there.
const LINUX_SKIP_MOUNTS = [
  '/boot',
  '/snap',
  '/var/lib/snapd',
  '/var/lib/docker',
  '/var/lib/containers',
  '/run',
  '/sys',
  '/proc',
  '/dev'
]

function skipMount(mountpoint) {
  if (mountpoint === '/') return false
  // Fedora and Arch mount removable media under /run/media; /run itself is
  // pseudo storage, but that subtree is exactly what we want to show.
  if (mountpoint === '/run/media' || mountpoint.startsWith('/run/media/')) return false
  return LINUX_SKIP_MOUNTS.some((prefix) => mountpoint === prefix || mountpoint.startsWith(prefix + '/'))
}

function linuxDrive(entry, usage) {
  const mountpoint = entry.mountpoint
  return {
    letter: mountpoint,
    path: mountpoint === '/' ? '/' : mountpoint.replace(/\/+$/, '') + '/',
    label: entry.label || '',
    totalSize: usage.total,
    freeSpace: usage.free,
    usedSpace: usage.used,
    fileSystem: entry.fileSystem || '',
    type: entry.removable ? 'removable' : 'fixed'
  }
}

async function getDrivesLinuxFromLsblk() {
  const { stdout } = await execFileAsync(
    'lsblk',
    ['--json', '--bytes', '--output', 'NAME,LABEL,FSTYPE,SIZE,MOUNTPOINTS,RM,TYPE'],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 }
  )
  const parsed = JSON.parse(stdout)
  const mounts = []
  const walk = (devices) => {
    for (const device of devices || []) {
      const points = Array.isArray(device.mountpoints)
        ? device.mountpoints
        : device.mountpoint
          ? [device.mountpoint]
          : []
      for (const mountpoint of points) {
        if (!mountpoint) continue
        mounts.push({
          mountpoint,
          label: String(device.label || '').trim(),
          fileSystem: String(device.fstype || '').trim(),
          removable: device.rm === true || device.rm === 1 || device.rm === '1',
          type: String(device.type || '')
        })
      }
      walk(device.children)
    }
  }
  walk(parsed.blockdevices)

  const seen = new Set()
  const drives = []
  for (const entry of mounts) {
    if (seen.has(entry.mountpoint)) continue
    if (skipMount(entry.mountpoint)) continue
    if (!LINUX_FS.has(entry.fileSystem)) continue
    if (['loop', 'rom', 'zram'].includes(entry.type)) continue
    seen.add(entry.mountpoint)
    try {
      drives.push(linuxDrive(entry, await diskUsage(entry.mountpoint)))
    } catch {
      // The mount can disappear between lsblk and statfs (unplugged USB).
    }
  }
  return drives
}

async function getDrivesLinuxFromProc() {
  const raw = await fs.promises.readFile('/proc/mounts', 'utf8')
  const seen = new Set()
  const drives = []
  for (const line of raw.split('\n')) {
    const [device, escaped, fileSystem] = line.split(/\s+/)
    if (!device || !escaped || !LINUX_FS.has(fileSystem)) continue
    const mountpoint = escaped.replace(/\\040/g, ' ').replace(/\\011/g, '\t').replace(/\\134/g, '\\')
    if (seen.has(mountpoint) || skipMount(mountpoint)) continue
    seen.add(mountpoint)
    try {
      drives.push(
        linuxDrive(
          { mountpoint, label: '', fileSystem, removable: mountpoint.startsWith('/media/') || mountpoint.startsWith('/run/media/') },
          await diskUsage(mountpoint)
        )
      )
    } catch {
      // Unreadable mount; it is not a usable target.
    }
  }
  return drives
}

function sortLinuxDrives(drives) {
  return drives.sort((a, b) => {
    if (a.path === '/' && b.path !== '/') return -1
    if (b.path === '/' && a.path !== '/') return 1
    if (a.type !== b.type) return a.type === 'removable' ? 1 : -1
    return a.path.localeCompare(b.path)
  })
}

async function getDrivesLinux() {
  let drives = []
  try {
    drives = await getDrivesLinuxFromLsblk()
  } catch {
    // lsblk is not available in every minimal distribution.
  }
  if (drives.length === 0) {
    try {
      drives = await getDrivesLinuxFromProc()
    } catch {
      drives = []
    }
  }
  if (drives.length === 0) {
    // Last resort: always offer the root filesystem.
    const usage = await diskUsage('/')
    drives = [
      {
        letter: '/',
        path: '/',
        label: '',
        totalSize: usage.total,
        freeSpace: usage.free,
        usedSpace: usage.used,
        fileSystem: '',
        type: 'fixed'
      }
    ]
  }
  return sortLinuxDrives(drives)
}

async function getDrivesPosix() {
  // Fallback for POSIX systems other than Linux (e.g. development on macOS).
  const info = await diskUsage('/')
  return [
    {
      letter: '/',
      path: '/',
      label: '',
      totalSize: info.total,
      freeSpace: info.free,
      usedSpace: info.used,
      fileSystem: '',
      type: 'fixed'
    }
  ]
}

export async function getDrives() {
  if (isWin) return getDrivesWindows()
  if (isLinux) return getDrivesLinux()
  return getDrivesPosix()
}

export async function diskUsage(target) {
  const s = await fs.promises.statfs(target)
  const total = s.blocks * s.bsize
  // bavail is what the user can actually use; bfree includes root-only blocks.
  const free = s.bavail * s.bsize
  return { total, free, used: total - free, clusterSize: s.bsize }
}

export function isDriveRoot(p) {
  const resolved = path.resolve(p)
  // Windows drive letters and the POSIX root are single-segment roots.
  if (path.parse(resolved).root === resolved) return true
  if (!isLinux) return false
  // A Linux mount point is any directory on a different device than its
  // parent (for example /home or /media/user/USB). /proc, /sys and bind mounts
  // of the same device are deliberately left to the scanner's dev check.
  try {
    return fs.statSync(resolved).dev !== fs.statSync(path.dirname(resolved)).dev
  } catch {
    return false
  }
}

// ============================================
// Elevation
// ============================================

let adminCache = null

export function isAdmin() {
  if (!isWin) return Promise.resolve(typeof process.getuid === 'function' && process.getuid() === 0)
  if (adminCache !== null) return Promise.resolve(adminCache)
  return new Promise((resolve) => {
    execFile('net', ['session'], { windowsHide: true }, (err) => {
      adminCache = !err
      resolve(adminCache)
    })
  })
}

function psQuote(s) {
  return "'" + String(s).replace(/'/g, "''") + "'"
}

/** Relaunch the app elevated. Resolves true if the elevated process was started. */
export async function relaunchAsAdmin(extraArgs = []) {
  if (!isWin) return false
  // Portable builds run from a temp folder; relaunch the original .exe instead.
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
  const args = process.defaultApp ? [path.resolve(process.argv[1] || '.'), ...extraArgs] : extraArgs
  let script = `Start-Process -FilePath ${psQuote(exe)} -Verb RunAs`
  if (args.length) script += ` -ArgumentList ${args.map((a) => psQuote(`"${a}"`)).join(',')}`
  try {
    await runPowerShell(script, { timeout: 120000 })
    return true
  } catch {
    return false // UAC prompt cancelled
  }
}

export async function emptyRecycleBin(driveLetter) {
  if (!isWin) return false
  const letter = String(driveLetter).replace(/[^A-Za-z]/g, '').slice(0, 1)
  if (!letter) return false
  await runPowerShell(`Clear-RecycleBin -DriveLetter ${letter} -Force -ErrorAction SilentlyContinue`, { timeout: 300000 })
  return true
}

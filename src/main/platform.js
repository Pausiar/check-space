import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'

const isWin = process.platform === 'win32'

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

async function getDrivesPosix() {
  // Development fallback so the app can run outside Windows.
  const info = await diskUsage('/')
  return [
    {
      letter: '/',
      path: '/',
      label: 'root',
      totalSize: info.total,
      freeSpace: info.free,
      usedSpace: info.used,
      fileSystem: '',
      type: 'fixed'
    }
  ]
}

export async function getDrives() {
  return isWin ? getDrivesWindows() : getDrivesPosix()
}

export async function diskUsage(target) {
  const s = await fs.promises.statfs(target)
  const total = s.blocks * s.bsize
  const free = s.bavail * s.bsize
  return { total, free, used: total - s.bfree * s.bsize, clusterSize: s.bsize }
}

export function isDriveRoot(p) {
  const resolved = path.resolve(p)
  return path.parse(resolved).root === resolved
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

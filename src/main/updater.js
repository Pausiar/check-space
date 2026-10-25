// In-app updates.
//
// electron-updater reads app-update.yml (written at build time from the
// "publish" block in electron-builder.yml), asks the GitHub release feed for
// latest.yml (Windows) or latest-linux.yml (AppImage), downloads the new build
// and installs it in place. The user never visits GitHub: the app only offers
// "restart".
//
// Windows uses the NSIS installer (the portable .exe cannot replace itself).
// On Linux only the AppImage can replace itself; the .deb is updated through
// the distribution or by downloading a new release. The build has to be
// packaged; otherwise the UI explains why instead of failing.

import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

// First check a little after startup, then every few hours. Downloads are never
// automatic: the user decides, so a metered connection is not drained silently.
const FIRST_CHECK_DELAY_MS = 20 * 1000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR)
const isAppImage = process.platform === 'linux' && Boolean(process.env.APPIMAGE)

const state = {
  status: 'idle', // idle | checking | available | downloading | downloaded | up-to-date | error | unsupported
  currentVersion: app.getVersion(),
  version: null,
  releaseDate: null,
  percent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  checkedAt: null,
  error: null,
  reason: null // why updates are unavailable: platform | portable | development
}

let sendStatus = () => {}
let initialized = false
let supported = false
let checking = null
let firstCheckTimer = null
let intervalTimer = null

function publish() {
  sendStatus({ ...state })
}

function setState(patch) {
  Object.assign(state, patch)
  publish()
}

/** Snapshot for the renderer (also used when it opens before the first event). */
export function getUpdateState() {
  return { ...state }
}

export function initUpdater(send) {
  sendStatus = send
  state.currentVersion = app.getVersion()
  if (initialized) {
    publish()
    return getUpdateState()
  }
  initialized = true

  if (process.platform !== 'win32' && process.platform !== 'linux') {
    setState({ status: 'unsupported', reason: 'platform' })
    return getUpdateState()
  }
  if (isPortable) {
    setState({ status: 'unsupported', reason: 'portable' })
    return getUpdateState()
  }
  if (!app.isPackaged || !autoUpdater) {
    // Development builds cannot install an update over themselves
    setState({ status: 'unsupported', reason: 'development' })
    return getUpdateState()
  }
  if (process.platform === 'linux' && !isAppImage) {
    // .deb/rpm installs are owned by the package manager, not the app.
    setState({ status: 'unsupported', reason: 'package' })
    return getUpdateState()
  }

  supported = true
  autoUpdater.autoDownload = false
  // Once the download finished, closing the app is enough to apply it
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: null })
  })
  autoUpdater.on('update-available', (info) => {
    setState({
      status: 'available',
      version: info?.version || null,
      releaseDate: info?.releaseDate || null,
      checkedAt: Date.now(),
      error: null,
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0
    })
  })
  autoUpdater.on('update-not-available', () => {
    setState({ status: 'up-to-date', checkedAt: Date.now(), error: null })
  })
  autoUpdater.on('download-progress', (p) => {
    setState({
      status: 'downloading',
      percent: Math.max(0, Math.min(100, Number(p?.percent) || 0)),
      transferred: Number(p?.transferred) || 0,
      total: Number(p?.total) || 0,
      bytesPerSecond: Number(p?.bytesPerSecond) || 0
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    setState({
      status: 'downloaded',
      version: info?.version || state.version,
      percent: 100,
      error: null
    })
  })
  autoUpdater.on('update-cancelled', () => {
    setState({ status: state.version ? 'available' : 'idle', error: null })
  })
  // Errors reach the UI through the IPC call as well; the event keeps the
  // status honest when a download fails after the check already succeeded.
  autoUpdater.on('error', (err) => {
    setState({ status: 'error', error: messageOf(err), checkedAt: Date.now() })
  })

  firstCheckTimer = setTimeout(() => checkForUpdates(), FIRST_CHECK_DELAY_MS)
  intervalTimer = setInterval(() => checkForUpdates(), CHECK_INTERVAL_MS)

  return getUpdateState()
}

function messageOf(err) {
  const text = err?.message ? String(err.message) : String(err || '')
  // electron-updater prefixes network errors with the feed URL; keep the cause
  return text.slice(0, 500)
}

export async function checkForUpdates() {
  if (!supported) return getUpdateState()
  if (state.status === 'downloading' || state.status === 'downloaded') return getUpdateState()
  if (checking) return checking

  setState({ status: 'checking', error: null })
  checking = autoUpdater
    .checkForUpdates()
    .then(() => getUpdateState())
    .catch((err) => {
      setState({ status: 'error', error: messageOf(err), checkedAt: Date.now() })
      return getUpdateState()
    })
    .finally(() => {
      checking = null
    })
  return checking
}

export async function downloadUpdate() {
  if (!supported) return getUpdateState()
  if (state.status === 'downloading' || state.status === 'downloaded') return getUpdateState()
  if (state.status !== 'available') {
    // Downloading without a known update (e.g. after a restart) asks first
    await checkForUpdates()
    if (state.status !== 'available') return getUpdateState()
  }

  setState({ status: 'downloading', percent: 0, transferred: 0, total: 0, error: null })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setState({ status: 'error', error: messageOf(err) })
  }
  return getUpdateState()
}

export function installUpdate() {
  if (!supported || state.status !== 'downloaded') return false
  // The window closes immediately; the installer (or the new AppImage) takes over.
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true)
    } catch (err) {
      setState({ status: 'error', error: messageOf(err) })
    }
  })
  return true
}

export function disposeUpdater() {
  clearTimeout(firstCheckTimer)
  clearInterval(intervalTimer)
}

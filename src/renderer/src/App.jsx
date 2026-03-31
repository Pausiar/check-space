import { useState, useCallback, useEffect } from 'react'
import DriveSelector from './components/DriveSelector'
import ScanView from './components/ScanView'
import { useScan } from './hooks/useScan'
import { Moon, Sun } from 'lucide-react'

export default function App() {
  const [screen, setScreen] = useState('select') // select | scan
  const [selectedDrive, setSelectedDrive] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true'
  })
  const { status, tree, stats, extras, progress, error, startScan, cancelScan, loadCache } = useScan()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('darkMode', darkMode)
    window.api.setTheme(darkMode)
  }, [darkMode])

  const handleSelectDrive = useCallback(async (drive) => {
    setSelectedDrive(drive)
    setScreen('scan')
    // Try to load cache first, then start scan
    const cached = await loadCache(drive.letter)
    if (!cached) {
      startScan(drive.path)
    }
  }, [startScan, loadCache])

  const handleBack = useCallback(() => {
    if (status === 'scanning') {
      cancelScan()
    }
    setScreen('select')
    setSelectedDrive(null)
  }, [status, cancelScan])

  const handleRescan = useCallback(() => {
    if (selectedDrive) {
      startScan(selectedDrive.path)
    }
  }, [selectedDrive, startScan])

  const themeToggle = (
    <button
      className="btn-icon theme-toggle"
      onClick={() => setDarkMode(d => !d)}
      title={darkMode ? 'Light mode' : 'Dark mode'}
    >
      {darkMode ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )

  if (screen === 'select') {
    return (
      <>
        <div className="theme-toggle-float">{themeToggle}</div>
        <DriveSelector onSelect={handleSelectDrive} />
      </>
    )
  }

  return (
    <>
      <ScanView
        drive={selectedDrive}
        status={status}
        tree={tree}
        stats={stats}
        extras={extras}
        progress={progress}
        error={error}
        onCancel={cancelScan}
        onRescan={handleRescan}
        onBack={handleBack}
        themeToggle={themeToggle}
      />
    </>
  )
}

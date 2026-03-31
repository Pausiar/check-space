import { useState, useEffect } from 'react'
import { formatBytes } from '../utils/format'
import { HardDrive } from 'lucide-react'

export default function DriveSelector({ onSelect }) {
  const [drives, setDrives] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getDrives().then((d) => {
      setDrives(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="drive-selector">
        <div className="drive-selector-header">
          <div className="logo">
            <HardDrive size={32} strokeWidth={1.5} />
          </div>
          <h1>Disk Scanner</h1>
          <p className="subtitle">Detecting drives...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="drive-selector">
      <div className="drive-selector-header">
        <div className="logo">
          <HardDrive size={32} strokeWidth={1.5} />
        </div>
        <h1>Disk Scanner</h1>
        <p className="subtitle">Select a drive to analyze</p>
      </div>
      <div className="drive-grid">
        {drives.map((drive) => {
          const usedPercent = (drive.usedSpace / drive.totalSize) * 100
          return (
            <button
              key={drive.letter}
              className="drive-card"
              onClick={() => onSelect(drive)}
            >
              <div className="drive-card-header">
                <span className="drive-letter">{drive.letter}:</span>
                {drive.label && <span className="drive-label">{drive.label}</span>}
              </div>
              <div className="drive-bar-track">
                <div
                  className="drive-bar-fill"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <div className="drive-card-info">
                <span>{formatBytes(drive.usedSpace)} used</span>
                <span className="drive-total">of {formatBytes(drive.totalSize)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

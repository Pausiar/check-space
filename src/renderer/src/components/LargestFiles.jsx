import { FolderOpen, Trash2, FileText } from 'lucide-react'
import { formatBytes } from '../utils/format'

export default function LargestFiles({ files, onDelete }) {
  if (!files || files.length === 0) {
    return <div className="panel-empty">No file data available</div>
  }

  const handleShowInFolder = (filePath) => {
    window.api.showItemInFolder(filePath)
  }

  const handleDelete = async (file) => {
    if (!confirm(`¿Mover "${file.name}" a la papelera?\n${file.path}`)) return
    const result = await window.api.moveToTrash(file.path)
    if (result.success && onDelete) onDelete(file)
  }

  return (
    <div className="file-list-panel">
      <div className="file-list-header">
        <FileText size={16} />
        <h3>Largest Files</h3>
      </div>
      <div className="file-list">
        {files.map((file, i) => (
          <div key={file.path} className="file-row">
            <span className="file-rank">#{i + 1}</span>
            <div className="file-info">
              <span className="file-name" title={file.name}>{file.name}</span>
              <span className="file-path" title={file.path}>{file.path}</span>
            </div>
            <span className="file-size">{formatBytes(file.size)}</span>
            <div className="file-actions">
              <button
                className="btn-icon-sm"
                onClick={() => handleShowInFolder(file.path)}
                title="Show in Explorer"
              >
                <FolderOpen size={14} />
              </button>
              <button
                className="btn-icon-sm btn-danger"
                onClick={() => handleDelete(file)}
                title="Move to Trash"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

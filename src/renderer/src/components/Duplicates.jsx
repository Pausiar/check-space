import { FolderOpen, Trash2, Copy } from 'lucide-react'
import { formatBytes } from '../utils/format'

export default function Duplicates({ duplicates, onDelete }) {
  if (!duplicates || duplicates.length === 0) {
    return <div className="panel-empty">No duplicates found</div>
  }

  const totalWasted = duplicates.reduce((sum, d) => sum + d.wastedSpace, 0)

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
        <Copy size={16} />
        <h3>Duplicate Files</h3>
        <span className="header-badge">{formatBytes(totalWasted)} wasted space</span>
      </div>
      <div className="duplicates-list">
        {duplicates.map((group, gi) => (
          <div key={gi} className="duplicate-group">
            <div className="duplicate-group-header">
              <span className="duplicate-badge">{group.count} copies</span>
              <span className="file-size">{formatBytes(group.size)} each</span>
              <span className="duplicate-wasted">-{formatBytes(group.wastedSpace)} wasted</span>
            </div>
            {group.files.map((file) => (
              <div key={file.path} className="file-row file-row-indent">
                <div className="file-info">
                  <span className="file-name" title={file.name}>{file.name}</span>
                  <span className="file-path" title={file.path}>{file.path}</span>
                </div>
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
        ))}
      </div>
    </div>
  )
}

import { ChevronRight } from 'lucide-react'

export default function Breadcrumb({ path, onNavigate }) {
  if (path.length <= 1) return null

  return (
    <div className="breadcrumb">
      {path.map((node, i) => (
        <span key={node.path} className="breadcrumb-item">
          {i > 0 && <ChevronRight size={14} className="breadcrumb-sep" />}
          <button
            className={`breadcrumb-btn ${i === path.length - 1 ? 'active' : ''}`}
            onClick={() => onNavigate(i)}
            disabled={i === path.length - 1}
          >
            {node.name}
          </button>
        </span>
      ))}
    </div>
  )
}

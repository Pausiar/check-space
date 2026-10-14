import { ChevronRight } from 'lucide-react'

/** path: [{ name, path }] from the root to the current folder */
export default function Breadcrumb({ path, onNavigate }) {
  if (!path || path.length <= 1) return null

  return (
    <nav className="breadcrumb">
      {path.map((node, i) => (
        <span key={node.path} className="breadcrumb-item">
          {i > 0 && <ChevronRight size={14} className="breadcrumb-sep" />}
          <button
            className={`breadcrumb-btn ${i === path.length - 1 ? 'active' : ''}`}
            onClick={() => onNavigate(node.path)}
            disabled={i === path.length - 1}
          >
            {node.name}
          </button>
        </span>
      ))}
    </nav>
  )
}

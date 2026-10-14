import TitleBar from './components/TitleBar'
import DriveSelector from './components/DriveSelector'
import ScanView from './components/ScanView'
import { useScan } from './context/ScanContext'

export default function App() {
  const { status } = useScan()
  return (
    <div className="app">
      <TitleBar />
      <main className="app-body">{status === 'idle' ? <DriveSelector /> : <ScanView />}</main>
    </div>
  )
}

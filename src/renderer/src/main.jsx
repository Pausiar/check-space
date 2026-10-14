import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'
import { ScanProvider } from './context/ScanContext'
import { FileActionsProvider } from './context/FileActions'
import './App.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('React Error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-error">
          <h2>Something went wrong / Algo ha fallado</h2>
          <pre>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button className="btn-secondary" onClick={() => this.setState({ error: null })}>
            Try again / Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <I18nProvider>
      <ThemeProvider>
        <ScanProvider>
          <FileActionsProvider>
            <App />
          </FileActionsProvider>
        </ScanProvider>
      </ThemeProvider>
    </I18nProvider>
  </ErrorBoundary>
)

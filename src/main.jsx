import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'
import App from './App.jsx'

// A render error would otherwise leave a blank page; show a way back instead.
class CrashGuard extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="content" role="alert">
        <div className="panel">
          <h1>Something went wrong</h1>
          <p className="muted">{String(this.state.error.message || this.state.error)}</p>
          <button className="reload" onClick={() => location.reload()}>Reload the page</button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(<StrictMode><CrashGuard><App /></CrashGuard></StrictMode>)

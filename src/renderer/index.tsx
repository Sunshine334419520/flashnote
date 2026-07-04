import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'

// Apply saved theme synchronously before React mounts (avoids flash of light theme)
const saved = localStorage.getItem('flashnote-theme')
if (saved === 'dark') {
  document.documentElement.classList.add('dark')
} else if (saved === 'system') {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)

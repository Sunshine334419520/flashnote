import type { ReactElement } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { MainView } from './routes/MainView'
import { QuickCapture } from './routes/QuickCapture'
import { SettingsView } from './routes/SettingsView'

export function App(): ReactElement {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainView />} />
          <Route path="/quick-capture" element={<QuickCapture />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}

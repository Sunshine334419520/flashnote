import type { ReactElement } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { I18nProvider } from './i18n'
import { useTheme } from './hooks/useTheme'
import { MainView } from './routes/MainView'
import { QuickCapture } from './routes/QuickCapture'
import { SettingsView } from './routes/SettingsView'

function ThemeInit(): ReactElement {
  useTheme()
  return (
    <Routes>
      <Route path="/" element={<MainView />} />
      <Route path="/quick-capture" element={<QuickCapture />} />
      <Route path="/settings" element={<SettingsView />} />
    </Routes>
  )
}

export function App(): ReactElement {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <HashRouter>
          <ThemeInit />
        </HashRouter>
      </I18nProvider>
    </ErrorBoundary>
  )
}

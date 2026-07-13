import { Menu, app } from 'electron'
import { loadConfig } from './services/config.service'
import { logger } from './utils/logger'
import { IS_MAC } from '../shared/constants'

// ── i18n for main process ────────────────────────────────────────────────

type Lang = 'zh-CN' | 'en'

const messages: Record<string, Record<string, string>> = {
  'app.about':       { 'zh-CN': '关于闪记',       'en': 'About FlashNote' },
  'app.settings':    { 'zh-CN': '设置...',         'en': 'Settings...' },
  'app.quit':        { 'zh-CN': '退出闪记',        'en': 'Quit FlashNote' },
  'edit.undo':       { 'zh-CN': '撤销',            'en': 'Undo' },
  'edit.redo':       { 'zh-CN': '重做',            'en': 'Redo' },
  'edit.cut':        { 'zh-CN': '剪切',            'en': 'Cut' },
  'edit.copy':       { 'zh-CN': '复制',            'en': 'Copy' },
  'edit.paste':      { 'zh-CN': '粘贴',            'en': 'Paste' },
  'edit.selectAll':  { 'zh-CN': '全选',            'en': 'Select All' },
  'window.minimize': { 'zh-CN': '最小化',          'en': 'Minimize' },
  'window.close':    { 'zh-CN': '关闭窗口',        'en': 'Close Window' },
  'tray.capture':    { 'zh-CN': '快捷记录',        'en': 'Quick Capture' },
  'tray.open':       { 'zh-CN': '打开闪记',        'en': 'Open FlashNote' },
  'tray.settings':   { 'zh-CN': '设置...',         'en': 'Settings...' },
  'tray.quit':       { 'zh-CN': '退出',            'en': 'Quit' },
}

let lang: Lang = 'zh-CN'

/** Determine the UI language: config > system locale fallback. */
function resolveLanguage(): Lang {
  try {
    const config = loadConfig('')
    const configured = config.language
    if (configured === 'zh-CN' || configured === 'en') return configured
    if (configured === 'system') {
      const sys = app.getLocale().startsWith('zh') ? 'zh-CN' : 'en'
      return sys
    }
  } catch { /* config not loaded yet */ }
  return app.getLocale().startsWith('zh') ? 'zh-CN' : 'en'
}

function t(key: string): string {
  return messages[key]?.[lang] ?? messages[key]?.['en'] ?? key
}

// ── macOS application menu ───────────────────────────────────────────────

export function createAppMenu(settingsAction: () => void): void {
  lang = resolveLanguage()
  logger.info('main:menu', `Language resolved: ${lang}`)

  if (!IS_MAC) return // Windows/Linux: no native app menu

  const menu = Menu.buildFromTemplate([
    {
      label: 'FlashNote',
      submenu: [
        { label: t('app.about'), role: 'about' },
        { type: 'separator' },
        {
          label: t('app.settings'),
          accelerator: 'CmdOrCtrl+,',
          click: () => settingsAction()
        },
        { type: 'separator' },
        { label: t('app.quit'), accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: t('edit.title') || 'Edit',
      submenu: [
        { label: t('edit.undo'), accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: t('edit.redo'), accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: t('edit.cut'), accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: t('edit.copy'), accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: t('edit.paste'), accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: t('edit.selectAll'), accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: t('window.title') || 'Window',
      submenu: [
        { label: t('window.minimize'), accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: t('window.close'), accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    }
  ])

  Menu.setApplicationMenu(menu)
}

// ── Tray context menu ────────────────────────────────────────────────────

interface TrayActions {
  showQuickCapture: () => void
  showMain: () => void
  showSettings: () => void
  quit: () => void
  getHotkeyLabel: () => string
}

export function createTrayMenu(actions: TrayActions): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: `${t('tray.capture')}    ${actions.getHotkeyLabel()}`,
      click: () => actions.showQuickCapture()
    },
    {
      label: t('tray.open'),
      click: () => actions.showMain()
    },
    { type: 'separator' },
    {
      label: t('tray.settings'),
      click: () => actions.showSettings()
    },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => actions.quit()
    }
  ])
}

/** Refresh i18n labels when language setting changes. */
export function refreshMenuLanguage(newLang: Lang): void {
  lang = newLang
}

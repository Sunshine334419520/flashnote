import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, nativeTheme } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { registerAllIpcHandlers } from './ipc'
import { getDefaultStoragePath, ensureStorageDirectories } from './utils/paths'
import { loadConfig } from './services/config.service'
import { initStorageService } from './services/storage.service'
import { AIService } from './services/ai'
import { TaskManager } from './services/task-manager'
import { initLogger, logger } from './utils/logger'
import { DEFAULT_HOTKEY } from '../shared/constants'

let mainWindow: BrowserWindow | null = null
let quickCaptureWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = !app.isPackaged

const DARK_BG = '#141312'
const LIGHT_BG = '#fafaf9'

/** Read saved theme and return matching window background color. */
function getThemeBackgroundColor(): string {
  try {
    const configPath = join(homedir(), 'FlashNote', 'config.json')
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw) as { theme?: string }
    const t = config.theme ?? 'system'
    const sysDark = nativeTheme.shouldUseDarkColors
    let bg: string
    if (t === 'dark') bg = DARK_BG
    else if (t === 'light') bg = LIGHT_BG
    else bg = sysDark ? DARK_BG : LIGHT_BG
    logger.info('main:theme', `theme=${t} systemDark=${sysDark} → bg=${bg}`)
    return bg
  } catch (err) {
    logger.warn('main:theme', 'Could not read config', { err: String(err) })
    return nativeTheme.shouldUseDarkColors ? DARK_BG : LIGHT_BG
  }
}

/**
 * Platform-aware window frame options. The renderer has no custom window
 * controls (min/max/close), so on Windows/Linux we must keep the native frame.
 * On macOS we use hiddenInset for a clean look that still shows traffic lights.
 * QuickCapture is intentionally frameless regardless of platform.
 */
function windowFrameOptions(): { frame?: boolean; titleBarStyle?: 'hiddenInset' } {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset' }
  }
  return { frame: true }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 690,
    minWidth: 680,
    minHeight: 420,
    backgroundColor: getThemeBackgroundColor(),
    icon: nativeImage.createFromPath(ICONS.dock),
    ...windowFrameOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createQuickCaptureWindow(): void {
  quickCaptureWindow = new BrowserWindow({
    width: 520,
    height: 80,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  if (isDev) {
    quickCaptureWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL!}#/quick-capture`)
  } else {
    quickCaptureWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/quick-capture'
    })
  }
}

function showQuickCaptureWindow(): void {
  if (quickCaptureWindow?.isDestroyed()) {
    quickCaptureWindow = null
  }

  if (!quickCaptureWindow) {
    createQuickCaptureWindow()
  }

  const win = quickCaptureWindow!
  win.center()
  win.show()
  win.focus()
}

function hideQuickCaptureWindow(): void {
  quickCaptureWindow?.hide()
}

function createSettingsWindow(): void {
  settingsWindow = new BrowserWindow({
    width: 700,
    height: 560,
    backgroundColor: getThemeBackgroundColor(),
    icon: nativeImage.createFromPath(ICONS.dock),
    ...windowFrameOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
  })

  if (isDev) {
    settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL!}#/settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/settings'
    })
  }
}

function showSettingsWindow(): void {
  if (settingsWindow?.isDestroyed()) {
    settingsWindow = null
  }

  if (!settingsWindow) {
    createSettingsWindow()
  }

  settingsWindow!.show()
  settingsWindow!.focus()
}

function showMainWindow(): void {
  if (mainWindow?.isDestroyed()) {
    mainWindow = null
  }

  if (!mainWindow) {
    createMainWindow()
  }

  mainWindow!.show()
  mainWindow!.focus()
}

function registerGlobalShortcut(hotkey: string): void {
  const registered = globalShortcut.register(hotkey, () => {
    showQuickCaptureWindow()
  })

  if (!registered) {
    console.warn(`Failed to register global shortcut: ${hotkey}`)
  }
}

// ── Centralized icon assets ──────────────────────────────────────────────
const ICON_VERSION = 'v2'
const ICON_BASE = isDev
  ? join(__dirname, '../../assets/icons', ICON_VERSION)
  : join(process.resourcesPath, 'assets/icons', ICON_VERSION)

const ICONS = {
  tray:  join(ICON_BASE, 'icon_16x16.png'),
  dock:  join(ICON_BASE, 'icon_dock_256x256.png'),
}

function createTrayIcon(): Electron.NativeImage {
  return nativeImage.createFromPath(ICONS.tray)
}

function createTray(): void {
  const icon = createTrayIcon()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quick Capture',
      click: () => showQuickCaptureWindow()
    },
    {
      label: 'Open FlashNote',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createMainWindow()
          mainWindow!.show()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => showSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])

  tray.setToolTip('FlashNote')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createMainWindow()
      mainWindow!.show()
    }
  })
}

// ============================================================
// Service initialization
// ============================================================

function initServices(): { storagePath: string; aiService: AIService; taskManager: TaskManager } {
  const storagePath = getDefaultStoragePath()

  // Ensure ~/FlashNote/ exists with all subdirectories
  ensureStorageDirectories(storagePath)

  // Initialize logger first so all subsequent errors are captured
  initLogger(storagePath)

  // Global error handlers
  process.on('uncaughtException', (error) => {
    logger.error('main:uncaughtException', error.message, { stack: error.stack })
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('main:unhandledRejection', String(reason))
  })

  // Load or create config
  loadConfig(storagePath)

  // Initialize storage engine (also initializes SQLite)
  initStorageService(storagePath)

  // Initialize AI service (loads providers from SQLite settings)
  const aiService = new AIService(storagePath)

  // Initialize task manager (in-memory only)
  const taskManager = new TaskManager()

  logger.info('main:init', 'Services initialized', { storagePath })

  return { storagePath, aiService, taskManager }
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(() => {
  const { storagePath, aiService, taskManager } = initServices()

  registerAllIpcHandlers({
    storagePath,
    aiService,
    taskManager,
    showQuickCaptureWindow,
    hideQuickCaptureWindow,
    showSettingsWindow,
    showMainWindow
  })

  createMainWindow()
  createQuickCaptureWindow()

  // Dock icon (macOS)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(ICONS.dock))
  }

  createTray()
  registerGlobalShortcut(DEFAULT_HOTKEY)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
  } else {
    createMainWindow()
    mainWindow!.show()
  }
})

import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
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

function createTrayIcon(): Electron.NativeImage {
  // Create a 16x16 tray icon programmatically — a simple "F" dot
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)

  // Draw a simple filled circle (dot)
  const cx = size / 2
  const cy = size / 2
  const r = 6

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) {
        canvas[i] = 100     // R
        canvas[i + 1] = 140  // G
        canvas[i + 2] = 255  // B
        canvas[i + 3] = 255  // A
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
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

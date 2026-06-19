import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { registerAllIpcHandlers } from './ipc'
import { getDefaultStoragePath, ensureStorageDirectories } from './utils/paths'
import { loadConfig } from './services/config.service'
import { initStorageService } from './services/storage.service'
import { AIService } from './services/ai'

let mainWindow: BrowserWindow | null = null
let quickCaptureWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = !app.isPackaged

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    titleBarStyle: 'hidden',
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
    width: 600,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
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

function registerGlobalShortcut(hotkey: string): void {
  const registered = globalShortcut.register(hotkey, () => {
    showQuickCaptureWindow()
  })

  if (!registered) {
    console.warn(`Failed to register global shortcut: ${hotkey}`)
  }
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
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

function initServices(): { storagePath: string; aiService: AIService } {
  const storagePath = getDefaultStoragePath()

  // Ensure ~/FlashNote/ exists with all subdirectories
  ensureStorageDirectories(storagePath)

  // Load or create config
  loadConfig(storagePath)

  // Initialize storage engine (also initializes SQLite)
  initStorageService(storagePath)

  // Initialize AI service (loads providers from SQLite settings)
  const aiService = new AIService(storagePath)

  return { storagePath, aiService }
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(() => {
  const { storagePath, aiService } = initServices()

  registerAllIpcHandlers({
    storagePath,
    aiService,
    showQuickCaptureWindow,
    hideQuickCaptureWindow
  })

  createMainWindow()
  createQuickCaptureWindow()
  createTray()
  registerGlobalShortcut('Alt+Space')
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

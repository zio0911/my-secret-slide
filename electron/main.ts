import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions } from 'electron'
import path from 'path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    }
  })

  win.loadURL(
      process.env.VITE_DEV_SERVER_URL ||
      `file://${path.join(__dirname, '../dist/index.html')}`
  )
}

/* ✅ macOS About 패널 설정 */
function setupAboutPanel() {
  app.setName('Free Image Viewer')

  app.setAboutPanelOptions({
    applicationName: 'Free Image Viewer',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: '© 2026 zio0911',
    credits: 'Free Image Viewer with Secret Mode',
    authors: ['zio0911']
  })
}

function createMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  setupAboutPanel()
  createMenu()
  createWindow()
})

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.filePaths
})

const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let quitting = false;
let alwaysOnTop = true;

const WIDTH = 640;
const HEIGHT = 480;

function positionTopRight(){
  if(!win) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const [w, h] = win.getSize();
  win.setPosition(wa.x + wa.width - w - 12, wa.y + 12, false);
}

function createWindow(){
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    minWidth: 480,
    minHeight: 360,
    frame: false,
    resizable: true,
    alwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#cba482',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.on('did-finish-load', () => win.webContents.send('sea:pin-state', alwaysOnTop));
  win.once('ready-to-show', () => positionTopRight());
  win.on('close', (e) => {
    if(!quitting){ e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => { win = null; });
}

function toggleWindow(){
  if(!win){ createWindow(); return; }
  if(win.isVisible()){ win.hide(); }
  else { win.show(); positionTopRight(); }
}

function createTray(){
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon-16.png'));
  tray = new Tray(icon);
  tray.setToolTip('像素风海景窗');
  createTrayMenu();
  tray.on('click', toggleWindow);
}

function createTrayMenu(){
  const menu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: toggleWindow },
    { label: '回到右上角', click: () => { if(win){ win.show(); positionTopRight(); } } },
    { type: 'separator' },
    { label: '窗口置顶', type: 'checkbox', checked: alwaysOnTop, click: (item) => {
      alwaysOnTop = item.checked;
      if(win){ win.setAlwaysOnTop(alwaysOnTop); win.webContents.send('sea:pin-state', alwaysOnTop); }
    } },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

const gotLock = app.requestSingleInstanceLock();
if(!gotLock){
  app.quit();
} else {
  app.on('second-instance', () => {
    if(win){ win.show(); positionTopRight(); }
  });
  app.whenReady().then(() => {
    ipcMain.handle('sea:hide', (event) => {
      if(win && event.sender === win.webContents) win.hide();
    });
    ipcMain.handle('sea:pin', (event) => {
      if(!win || event.sender !== win.webContents) return false;
      alwaysOnTop = !alwaysOnTop;
      win.setAlwaysOnTop(alwaysOnTop);
      createTrayMenu();
      return alwaysOnTop;
    });
    createWindow();
    createTray();
  });
  app.on('activate', () => { if(!win) createWindow(); });
}

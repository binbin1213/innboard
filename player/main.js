'use strict';

const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 首次运行时默认填写的服务器地址（不带 /display）
const DEFAULT_SERVER_URL = 'https://hotel.binbino.cn';

let controlWin = null;
let displayWin = null;

/* ---------------- 配置读写 ---------------- */

function configFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  const fallback = { serverUrl: DEFAULT_SERVER_URL };
  try {
    const raw = fs.readFileSync(configFile(), 'utf8');
    return { ...fallback, ...JSON.parse(raw) };
  } catch (e) {
    return fallback;
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// 去掉结尾斜杠和 /display，得到基础地址
function normalizeBaseUrl(input) {
  let u = String(input || '').trim();
  if (!u) return '';
  u = u.replace(/\/+$/, '');
  u = u.replace(/\/display$/, '');
  return u;
}

/* ---------------- 屏幕选择 ---------------- */

function displayInfo() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    primary: d.id === primary.id,
    width: d.bounds.width,
    height: d.bounds.height,
    x: d.bounds.x,
    y: d.bounds.y,
  }));
}

// 选一块非主屏作为电视；只有一块屏时退回主屏
function chooseDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.find((d) => d.id !== primary.id) || primary;
}

/* ---------------- 展示窗口 ---------------- */

function openDisplay() {
  const base = normalizeBaseUrl(loadConfig().serverUrl);
  if (!base) return { ok: false, msg: '请先填写服务器地址' };

  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.destroy();
    displayWin = null;
  }

  const url = base + '/display';
  const target = chooseDisplay();
  const { x, y, width, height } = target.bounds;

  displayWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    frame: false,
    show: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // 去掉 UA 中的 Electron 标识，避免被 Cloudflare 当作爬虫触发人机验证
  displayWin.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
  );

  displayWin.loadURL(url);

  displayWin.once('ready-to-show', () => {
    try {
      displayWin.setBounds({ x, y, width, height });
    } catch (e) { /* 忽略 */ }
    if (!displayWin.isFullScreen()) {
      displayWin.setFullScreen(true);
    }
    displayWin.show();
  });

  displayWin.webContents.on('did-fail-load', (event, code, desc, failedUrl, isMainFrame) => {
    // code -3 为主动取消（例如 destroy），忽略
    if (isMainFrame && code !== -3) {
      displayWin.loadFile(path.join(__dirname, 'offline.html'), { query: { url } }).catch(() => {});
    }
  });

  displayWin.on('closed', () => {
    displayWin = null;
  });

  return { ok: true, url, width, height };
}

function closeDisplay() {
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.destroy();
    displayWin = null;
    return true;
  }
  return false;
}

/* ---------------- 控制窗口 ---------------- */

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 470,
    height: 660,
    resizable: false,
    title: '房价牌播放器',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  controlWin.loadFile('control.html');
  controlWin.on('closed', () => {
    controlWin = null;
    closeDisplay();
  });
}

/* ---------------- IPC ---------------- */

function registerIpc() {
  ipcMain.handle('get-config', () => loadConfig());
  ipcMain.handle('save-config', (e, cfg) => {
    const ok = saveConfig({ serverUrl: normalizeBaseUrl(cfg && cfg.serverUrl) });
    return { ok };
  });
  ipcMain.handle('get-displays', () => displayInfo());
  ipcMain.handle('play', () => openDisplay());
  ipcMain.handle('stop', () => ({ ok: closeDisplay() }));
  ipcMain.handle('refresh', () => {
    const base = normalizeBaseUrl(loadConfig().serverUrl);
    if (!displayWin || displayWin.isDestroyed() || !base) {
      return { ok: false, msg: '当前没有在播放' };
    }
    const displayUrl = base + '/display';
    const current = displayWin.webContents.getURL();
    if (current && current.startsWith(displayUrl)) {
      displayWin.webContents.reloadIgnoringCache();
    } else {
      displayWin.loadURL(displayUrl);
    }
    return { ok: true };
  });
  ipcMain.handle('open-admin', () => {
    const base = normalizeBaseUrl(loadConfig().serverUrl);
    if (!base) return { ok: false, msg: '请先填写服务器地址' };
    shell.openExternal(base + '/admin');
    return { ok: true };
  });
  ipcMain.handle('get-urls', () => {
    const base = normalizeBaseUrl(loadConfig().serverUrl);
    return {
      display: base ? base + '/display' : '',
      admin: base ? base + '/admin' : '',
    };
  });
}

/* ---------------- 生命周期 ---------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (controlWin) {
      if (controlWin.isMinimized()) controlWin.restore();
      controlWin.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    createControlWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

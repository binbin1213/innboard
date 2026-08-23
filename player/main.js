'use strict';

const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// 首次运行时默认填写的服务器地址（不带 /display）
const DEFAULT_SERVER_URL = 'https://hotel.binbino.cn';

let controlWin = null;
let displayWin = null;
let recoverTimer = null;
let manualLocal = false;
let caching = false;

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

function displayUrl(base) {
  return base ? base + '/display' : '';
}

/* ---------------- 网络检测与酒店名缓存 ---------------- */

// 检测服务器是否可达（主进程直接请求，不走页面缓存）
function checkServer(url) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (!settled) { settled = true; resolve(ok); }
    };
    try {
      const req = https.get(url, { timeout: 8000 }, (res) => {
        done(res.statusCode >= 200 && res.statusCode < 400);
        res.resume();
      });
      req.on('error', () => done(false));
      req.on('timeout', () => { req.destroy(); done(false); });
    } catch (e) {
      done(false);
    }
  });
}

// 在线时缓存酒店名，供本地应急模式显示
function cacheHotelName(base) {
  if (!base) return;
  let req;
  req = https.get(base + '/api/display', { timeout: 8000 }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return; }
    let body = '';
    res.on('data', (c) => {
      body += c;
      if (body.length > 1e6) req.destroy();
    });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data && data.hotel_name) {
          const cfg = loadConfig();
          cfg.hotel_name = data.hotel_name;
          saveConfig(cfg);
        }
      } catch (e) { /* 忽略 */ }
    });
  });
  req.on('error', () => {});
  req.on('timeout', () => { req.destroy(); });
}

/* ---------------- 本地快照（手动缓存完整页面） ---------------- */

const SNAP_DIR = () => path.join(app.getPath('userData'), 'snapshot');
const LOG_FILE = () => path.join(app.getPath('userData'), 'player.log');
let localServer = null;
let localPort = null;

// 简单日志：方便排查问题（如缓存失败原因）
function log(msg) {
  try {
    fs.appendFileSync(LOG_FILE(), `${new Date().toLocaleString('zh-CN', { hour12: false })} ${msg}\n`);
  } catch (e) { /* 忽略日志错误 */ }
}

function downloadFile(url, timeout = 15000, redirects = 5) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error('重定向过多'));
        const next = new URL(res.headers.location, url).href;
        return resolve(downloadFile(next, timeout, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
  });
}

// 本地服务器：把缓存的快照原样伺服（URL 结构与线上一致，页面无需任何改动）
function startLocalServer() {
  return new Promise((resolve) => {
    if (localServer) return resolve(localPort);
    localServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let p = url.pathname;
      if (p === '/' || p === '/display') p = '/index.html';
      if (p === '/api/display') {
        fs.readFile(path.join(SNAP_DIR(), 'api.json'), (err, buf) => {
          if (err) { res.writeHead(404); res.end(); return; }
          try {
            const data = JSON.parse(buf.toString('utf8'));
            if (data.server_time) data.server_time = new Date().toISOString();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
          } catch (e) {
            res.writeHead(500); res.end();
          }
        });
        return;
      }
      const filePath = path.resolve(path.join(SNAP_DIR(), p));
      if (!filePath.startsWith(path.resolve(SNAP_DIR()))) {
        res.writeHead(404); res.end(); return;
      }
      fs.readFile(filePath, (err, buf) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath).toLowerCase();
        const mime = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    localServer.listen(0, '127.0.0.1', () => {
      localPort = localServer.address().port;
      resolve(localPort);
    });
    localServer.on('error', () => { localServer = null; resolve(null); });
  });
}

function snapshotExists() {
  return fs.existsSync(path.join(SNAP_DIR(), 'index.html'));
}

// 手动缓存：下载完整展示页（HTML + JS/CSS + 数据 + 图片）到本地
async function cacheSnapshot() {
  if (caching) return { ok: false, msg: '正在缓存中，请稍候' };
  caching = true;
  const base = normalizeBaseUrl(loadConfig().serverUrl);
  if (!base) { caching = false; return { ok: false, msg: '请先填写服务器地址' }; }
  const snapDir = SNAP_DIR();
  fs.mkdirSync(path.join(snapDir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(snapDir, 'uploads'), { recursive: true });
  log('开始手动缓存: ' + base);
  try {
    // 1) 展示页 HTML
    const htmlBuf = await downloadFile(base + '/display');
    // 2) 页面引用的静态资源
    const html = htmlBuf.toString('utf8');
    const assetUrls = [...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map((m) => m[1]);
    log('页面资源: ' + JSON.stringify(assetUrls));
    for (const p of assetUrls) {
      try {
        const buf = await downloadFile(base + p);
        fs.writeFileSync(path.join(snapDir, p.replace(/^\//, '')), buf);
      } catch (e) { log('资源失败(忽略): ' + p + ' ' + e.message); }
    }
    fs.writeFileSync(path.join(snapDir, 'index.html'), htmlBuf);
    // 3) 展示数据
    const apiBuf = await downloadFile(base + '/api/display');
    const apiData = JSON.parse(apiBuf.toString('utf8'));
    // 4) 数据中的图片（logo / 二维码 / 轮播图）
    const imgUrls = [];
    if (apiData.logo_url) imgUrls.push(apiData.logo_url);
    if (apiData.qr_url) imgUrls.push(apiData.qr_url);
    (apiData.images || []).forEach((im) => { if (im && im.url) imgUrls.push(im.url); });
    log('图片: ' + JSON.stringify(imgUrls));
    for (const p of imgUrls) {
      try {
        const buf = await downloadFile(base + p);
        fs.writeFileSync(path.join(snapDir, p.replace(/^\//, '')), buf);
      } catch (e) { log('图片失败(忽略): ' + p + ' ' + e.message); }
    }
    fs.writeFileSync(path.join(snapDir, 'api.json'), apiBuf);
    await startLocalServer();
    log('手动缓存成功');
    return { ok: true };
  } catch (e) {
    log('手动缓存失败: ' + (e && e.stack ? e.stack : e));
    return { ok: false, msg: '缓存失败：' + (e.message || '未知错误') };
  } finally {
    caching = false;
  }
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

function createDisplayWindow() {
  const base = normalizeBaseUrl(loadConfig().serverUrl);
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

  displayWin.once('ready-to-show', () => {
    try {
      displayWin.setBounds({ x, y, width, height });
    } catch (e) { /* 忽略 */ }
    if (!displayWin.isFullScreen()) {
      displayWin.setFullScreen(true);
    }
    displayWin.show();
  });

  // 加载失败（服务器断线且无离线缓存）→ 自动切入本地应急模式
  displayWin.webContents.on('did-fail-load', (event, code, desc, failedUrl, isMainFrame) => {
    // code -3 为主动取消（例如 destroy），忽略
    if (isMainFrame && code !== -3 && !manualLocal) {
      showEmergency();
    }
  });

  // 成功加载线上页面时缓存酒店名
  displayWin.webContents.on('did-finish-load', () => {
    const cur = displayWin && !displayWin.isDestroyed() ? displayWin.webContents.getURL() : '';
    if (cur.startsWith(displayUrl(base))) cacheHotelName(base);
  });

  displayWin.on('closed', () => {
    displayWin = null;
    stopRecoverTimer();
  });
}

function openDisplay() {
  const base = normalizeBaseUrl(loadConfig().serverUrl);
  if (!base) return { ok: false, msg: '请先填写服务器地址' };

  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.destroy();
    displayWin = null;
  }
  manualLocal = false;
  stopRecoverTimer();

  createDisplayWindow();
  displayWin.loadURL(displayUrl(base));
  log('播放: ' + displayUrl(base));
  return { ok: true, url: displayUrl(base), width: chooseDisplay().bounds.width };
}

/* ---------------- 本地应急模式 ---------------- */

function showEmergency() {
  if (!displayWin || displayWin.isDestroyed()) return;
  if (snapshotExists()) {
    // 优先用手动缓存的完整页面
    startLocalServer().then((port) => {
      if (port && displayWin && !displayWin.isDestroyed()) {
        displayWin.loadURL(`http://127.0.0.1:${port}/display`);
      }
    });
  } else {
    // 没有缓存 → 最后的兜底：本地时钟页
    const cfg = loadConfig();
    displayWin
      .loadFile(path.join(__dirname, 'emergency.html'), { query: { name: cfg.hotel_name || '' } })
      .catch(() => {});
  }
  startRecoverTimer();
}

// 每 30 秒探测一次服务器，恢复后自动切回线上
function startRecoverTimer() {
  stopRecoverTimer();
  recoverTimer = setInterval(async () => {
    if (manualLocal) return;
    const base = normalizeBaseUrl(loadConfig().serverUrl);
    const url = displayUrl(base);
    if (!url) return;
    const ok = await checkServer(url);
    if (ok) {
      stopRecoverTimer();
      if (displayWin && !displayWin.isDestroyed()) displayWin.loadURL(url);
    }
  }, 30000);
}

function stopRecoverTimer() {
  if (recoverTimer) {
    clearInterval(recoverTimer);
    recoverTimer = null;
  }
}

// 手动进入本地模式（显示手动缓存的页面，不自动切回，直到点「播放」恢复）
async function enterLocalMode() {
  if (!snapshotExists()) {
    return { ok: false, msg: '还没有缓存，请先点「📥 手动缓存」' };
  }
  const port = await startLocalServer();
  if (!port) return { ok: false, msg: '本地服务启动失败' };
  manualLocal = true;
  stopRecoverTimer();
  if (!displayWin || displayWin.isDestroyed()) {
    createDisplayWindow();
  }
  displayWin.loadURL(`http://127.0.0.1:${port}/display`);
  log('本地模式: http://127.0.0.1:' + port + '/display');
  return { ok: true };
}

function closeDisplay() {
  manualLocal = false;
  stopRecoverTimer();
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
    height: 800,
    resizable: true,
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
    const url = displayUrl(base);
    const current = displayWin.webContents.getURL();
    if (current && current.startsWith(url)) {
      displayWin.webContents.reloadIgnoringCache();
    } else {
      displayWin.loadURL(url);
    }
    return { ok: true };
  });
  ipcMain.handle('local-mode', () => enterLocalMode());
  ipcMain.handle('cache-snapshot', () => cacheSnapshot());
  ipcMain.handle('open-admin', () => {
    const base = normalizeBaseUrl(loadConfig().serverUrl);
    if (!base) return { ok: false, msg: '请先填写服务器地址' };
    shell.openExternal(base + '/admin');
    return { ok: true };
  });
  ipcMain.handle('get-urls', () => {
    const base = normalizeBaseUrl(loadConfig().serverUrl);
    return {
      display: displayUrl(base),
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

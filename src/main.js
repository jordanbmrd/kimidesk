'use strict';

const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// --- Réglages ---------------------------------------------------------------
const BASE_WIN = 160;          // taille (carrée) de référence de la fenêtre (échelle 1)
const TICK_MS = 16;            // ~60 FPS pour la logique
const GRAVITY = 0.9;           // accélération de chute (px/tick²)
const AIR_FRICTION = 0.99;     // frottement horizontal en l'air
const BOUNCE = 0.35;           // rebond au sol

// Boîte « attrapable » du chat à l'intérieur de la fenêtre (le chat est en bas, centré).
const BASE_CAT_W = 110;
const BASE_CAT_H = 110;
const HIT_PAD = 6;

// --- Taille ajustable -------------------------------------------------------
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.15;
const SIZE_PRESETS = [
  { label: 'Mini',   value: 0.6 },
  { label: 'Petit',  value: 0.8 },
  { label: 'Normal', value: 1.0 },
  { label: 'Grand',  value: 1.4 },
  { label: 'Géant',  value: 2.0 },
];

let scale = 1;
let WIN_SIZE = BASE_WIN;        // recalculées par recomputeSizes()
let CAT_W = BASE_CAT_W;
let CAT_H = BASE_CAT_H;

function clampScale(s) {
  if (!Number.isFinite(s)) return 1;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(s * 100) / 100));
}
function recomputeSizes() {
  WIN_SIZE = Math.round(BASE_WIN * scale);
  CAT_W = Math.round(BASE_CAT_W * scale);
  CAT_H = Math.round(BASE_CAT_H * scale);
}

const TOGGLE_SHORTCUT = 'Control+Alt+K';
const GROW_SHORTCUT = 'Control+Alt+Up';
const SHRINK_SHORTCUT = 'Control+Alt+Down';

let win = null;
let tray = null;
let hidden = false;

// --- Préférences (taille) persistées ----------------------------------------
let settingsPath = null;
function loadSettings() {
  try {
    settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (typeof data.scale === 'number') scale = clampScale(data.scale);
  } catch { /* premiers réglages : on garde les valeurs par défaut */ }
  recomputeSizes();
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath, JSON.stringify({ scale })); } catch { /* ignore */ }
}

function setScale(next) {
  next = clampScale(next);
  if (next === scale) return;
  scale = next;
  recomputeSizes();
  if (win && !win.isDestroyed()) {
    // resizable=false empêche Windows de RÉTRÉCIR la fenêtre : on le réactive le temps du resize.
    win.setResizable(true);
    win.setSize(WIN_SIZE, WIN_SIZE);
    win.setResizable(false);
    mascot.x = clampX(mascot.x);
    mascot.y = floorY();                 // garder le chat posé au sol
    applyPosition(true);
  }
  sendScale();
  saveSettings();
  refreshTrayMenu();
}
function stepScale(delta) { setScale(scale + delta); }

// --- État de la mascotte ----------------------------------------------------
const mascot = {
  state: 'idle',          // idle | drag | fall | sleep
  facing: 1,              // 1 = droite, -1 = gauche
  x: 0, y: 0,
  vx: 0, vy: 0,
  timer: 0,
  grab: { dx: 0, dy: 0 },
  lastCursor: null,
};

function workArea() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}
function floorY() {
  const wa = workArea();
  return wa.y + wa.height - WIN_SIZE;
}
function clampX(x) {
  const wa = workArea();
  return Math.max(wa.x, Math.min(wa.x + wa.width - WIN_SIZE, x));
}

// --- Boucle logique ---------------------------------------------------------
function tick() {
  switch (mascot.state) {
    case 'idle':  updateIdle(); break;
    case 'drag':  updateDrag(); break;
    case 'fall':  updateFall(); break;
    case 'sleep': updateSleep(); break;
  }
  applyPosition();
  updateInteractive();
}

function updateIdle() {
  mascot.timer -= TICK_MS;
  if (mascot.timer <= 0) {
    if (Math.random() < 0.25) {
      enterSleep();
    } else {
      mascot.timer = 2500 + Math.random() * 4500; // reste tranquillement posé
    }
  }
}

function updateDrag() {
  const c = screen.getCursorScreenPoint();
  const nx = c.x - mascot.grab.dx;
  const ny = c.y - mascot.grab.dy;
  if (mascot.lastCursor) {
    mascot.vx = nx - mascot.x;
    mascot.vy = ny - mascot.y;
  }
  mascot.x = nx; mascot.y = ny;
  mascot.facing = mascot.vx >= 0 ? 1 : -1;
  mascot.lastCursor = c;
}

function updateFall() {
  mascot.vy += GRAVITY;
  mascot.vx *= AIR_FRICTION;
  mascot.x += mascot.vx;
  mascot.y += mascot.vy;

  const wa = workArea();
  const minX = wa.x, maxX = wa.x + wa.width - WIN_SIZE;
  if (mascot.x < minX) { mascot.x = minX; mascot.vx = -mascot.vx * BOUNCE; }
  if (mascot.x > maxX) { mascot.x = maxX; mascot.vx = -mascot.vx * BOUNCE; }

  const fy = floorY();
  if (mascot.y >= fy) {
    mascot.y = fy;
    if (Math.abs(mascot.vy) > 4) {
      mascot.vy = -mascot.vy * BOUNCE;
    } else {
      mascot.vy = 0; mascot.vx = 0;
      enterIdle();
    }
  }
}

function updateSleep() {
  mascot.timer -= TICK_MS;
  if (mascot.timer <= 0) enterIdle();
}

// --- Transitions ------------------------------------------------------------
function setState(next) {
  if (mascot.state !== next) {
    mascot.state = next;
    sendState();
  }
}
function enterIdle()  { mascot.timer = 1500 + Math.random() * 4000; setState('idle'); }
function enterSleep() { mascot.timer = 6000 + Math.random() * 8000; setState('sleep'); }

function sendState() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('mascot:state', { state: mascot.state, facing: mascot.facing });
  }
}
function sendScale() {
  if (win && !win.isDestroyed()) win.webContents.send('mascot:scale', scale);
}

let lastX = null, lastY = null;
function applyPosition(force) {
  const ix = Math.round(mascot.x), iy = Math.round(mascot.y);
  if (force || ix !== lastX || iy !== lastY) {
    win.setPosition(ix, iy);
    lastX = ix; lastY = iy;
  }
}

// Pousse l'orientation au renderer quand elle change (throttlé).
let lastFacing = 1;
setInterval(() => {
  if (mascot.facing !== lastFacing) { lastFacing = mascot.facing; sendState(); }
}, 80);

// --- Click-through : interactif seulement quand le curseur est sur le chat ---
let ignoring = true;
function hitCat(c) {
  const left = mascot.x + (WIN_SIZE - CAT_W) / 2 - HIT_PAD;
  const right = mascot.x + (WIN_SIZE + CAT_W) / 2 + HIT_PAD;
  const top = mascot.y + (WIN_SIZE - CAT_H) - HIT_PAD;
  const bottom = mascot.y + WIN_SIZE + HIT_PAD;
  return c.x >= left && c.x <= right && c.y >= top && c.y <= bottom;
}
function updateInteractive() {
  if (!win || win.isDestroyed() || hidden) return;
  const over = mascot.state === 'drag' || hitCat(screen.getCursorScreenPoint());
  const shouldIgnore = !over;
  if (shouldIgnore !== ignoring) {
    win.setIgnoreMouseEvents(shouldIgnore, { forward: true });
    ignoring = shouldIgnore;
  }
}

// --- IPC --------------------------------------------------------------------
ipcMain.on('drag:start', () => {
  const c = screen.getCursorScreenPoint();
  mascot.grab.dx = c.x - mascot.x;
  mascot.grab.dy = c.y - mascot.y;
  mascot.lastCursor = null;
  mascot.vx = 0; mascot.vy = 0;
  setState('drag');
});
ipcMain.on('drag:end', () => { if (mascot.state === 'drag') setState('fall'); });
ipcMain.on('mascot:menu', () => showMascotMenu());

// --- Masquer / Afficher -----------------------------------------------------
function toggleHidden() {
  hidden = !hidden;
  if (hidden) {
    win.hide();
  } else {
    win.showInactive();
  }
  refreshTrayMenu();
}

// --- Menus ------------------------------------------------------------------
function sizeSubmenu() {
  const presets = SIZE_PRESETS.map((p) => ({
    label: p.label,
    type: 'radio',
    checked: Math.abs(scale - p.value) < 0.001,
    click: () => setScale(p.value),
  }));
  return [
    { label: '➕  Agrandir (Ctrl+Alt+↑)', click: () => stepScale(SCALE_STEP) },
    { label: '➖  Réduire (Ctrl+Alt+↓)', click: () => stepScale(-SCALE_STEP) },
    { type: 'separator' },
    ...presets,
  ];
}

function showMascotMenu() {
  Menu.buildFromTemplate([
    { label: '😴  Va dormir', click: () => enterSleep() },
    { label: '👀  Réveille-toi', click: () => { mascot.timer = 0; enterIdle(); } },
    { type: 'separator' },
    { label: '📐  Taille', submenu: sizeSubmenu() },
    { type: 'separator' },
    { label: '🙈  Masquer (Ctrl+Alt+K)', click: () => toggleHidden() },
    { label: '❌  Quitter Kimi', click: () => app.quit() },
  ]).popup({ window: win });
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: hidden ? '👀  Afficher Kimi' : '🙈  Masquer Kimi', click: () => toggleHidden() },
    { label: 'Réveille-toi', click: () => { mascot.timer = 0; enterIdle(); } },
    { label: 'Va dormir', click: () => enterSleep() },
    { type: 'separator' },
    { label: '📐  Taille', submenu: sizeSubmenu() },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]));
}

function buildTray() {
  const img = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' + Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
         <circle cx="8" cy="8" r="7" fill="#e8a36b"/>
         <circle cx="5.5" cy="7" r="1.3" fill="#2b2440"/>
         <circle cx="10.5" cy="7" r="1.3" fill="#2b2440"/>
       </svg>`
    ).toString('base64')
  );
  tray = new Tray(img);
  tray.setToolTip('KimiDesk — ta mascotte de bureau');
  tray.on('click', () => { if (hidden) toggleHidden(); });
  refreshTrayMenu();
}

// --- Fenêtre ----------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
    width: WIN_SIZE, height: WIN_SIZE,
    transparent: true, frame: false, resizable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, 'index.html'));

  const wa = workArea();
  mascot.x = clampX(wa.x + wa.width - WIN_SIZE - 24); // bas à droite
  mascot.y = floorY();
  win.setPosition(Math.round(mascot.x), Math.round(mascot.y));

  win.webContents.once('did-finish-load', () => {
    sendScale();
    sendState();
    setInterval(tick, TICK_MS);
  });
}

app.whenReady().then(() => {
  loadSettings();
  createWindow();
  buildTray();
  globalShortcut.register(TOGGLE_SHORTCUT, toggleHidden);
  globalShortcut.register(GROW_SHORTCUT, () => stepScale(SCALE_STEP));
  globalShortcut.register(SHRINK_SHORTCUT, () => stepScale(-SCALE_STEP));
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

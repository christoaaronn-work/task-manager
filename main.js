const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen, nativeTheme } = require('electron');
const path = require('path'), fs = require('fs'), { spawn, execSync } = require('child_process');
const DATA = path.join(__dirname, 'data.json');
const W = 680, H = 520;
const SETTINGS = path.join(__dirname, 'settings.json');
let win, widget, tray, helper, quitting = false, widgetW = 200, keepTop;
let settings = { widget: true, x: 64 };
try { Object.assign(settings, JSON.parse(fs.readFileSync(SETTINGS, 'utf8'))); } catch {}
const saveSettings = () => { try { fs.writeFileSync(SETTINGS, JSON.stringify(settings)); } catch {} };

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => cmd('open'));

ipcMain.on('load', e => { try { e.returnValue = fs.readFileSync(DATA, 'utf8'); } catch { e.returnValue = ''; } });
ipcMain.on('save', (_e, json) => {
  try { fs.writeFileSync(DATA, json); } catch {}
  if (widget) widget.webContents.send('data');
});
ipcMain.on('wsize', (_e, w) => { widgetW = Math.max(60, Math.ceil(w)); placeWidget(); });
ipcMain.on('wclick', () => cmd('toggle'));
ipcMain.on('ignore', (_e, on) => { if (win) win.setIgnoreMouseEvents(on, { forward: true }); });
ipcMain.on('focus', () => { if (win) win.focus(); });

// The window is a fixed, always-visible, transparent canvas at the top of the
// screen. Only the "island" drawn inside it is visible/clickable; the renderer
// animates it between a small pill and the full panel.
function cmd(c) {
  if (!win) return;
  place();
  if (c !== 'close') win.focus();
  win.webContents.send('cmd', c);
}
function place() {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win.setPosition(Math.round(workArea.x + (workArea.width - W) / 2), workArea.y);
}

// A small transparent window laid over the Windows taskbar, just left of the
// system tray. Windows 11 has no API for third-party taskbar widgets, so this
// is a floating always-on-top window that lines up with the taskbar.
const WH = 32;
function placeWidget() {
  if (!widget) return;
  const d = screen.getPrimaryDisplay();
  const barH = d.bounds.height - d.workArea.height || 48;
  const x = d.bounds.x + settings.x;
  const y = d.bounds.y + d.bounds.height - barH + Math.round((barH - WH) / 2);
  widget.setBounds({ x, y, width: widgetW, height: WH });
}
function setWidget(on) {
  settings.widget = on; saveSettings();
  if (on && !widget) {
    widget = new BrowserWindow({
      width: widgetW, height: WH, show: false, frame: false, transparent: true, backgroundColor: '#00000000',
      hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
    });
    widget.setAlwaysOnTop(true, 'screen-saver');
    widget.loadFile('widget.html');
    widget.webContents.on('did-finish-load', () => sendTheme());
    widget.once('ready-to-show', () => { placeWidget(); widget.showInactive(); });
    widget.on('closed', () => { widget = null; });
    keepTop = setInterval(() => { if (widget) { placeWidget(); widget.moveTop(); sendTheme(); } }, 3000);
  } else if (!on && widget) {
    clearInterval(keepTop); widget.destroy(); widget = null;
  }
  if (tray) buildMenu();
}
// the taskbar follows SystemUsesLightTheme (not the app theme), so read it directly
function sendTheme() {
  if (!widget) return;
  let light = false;
  try { light = /0x1\s*$/m.test(execSync(String.raw`reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" /v SystemUsesLightTheme`, { windowsHide: true, encoding: 'utf8' })); } catch {}
  widget.webContents.send('theme', light);
}
function buildMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => cmd('open') },
    { label: 'Taskbar widget', type: 'checkbox', checked: settings.widget, click: i => setWidget(i.checked) },
    { label: 'Move widget left', enabled: settings.widget, click: () => { settings.x = Math.max(0, settings.x - 40); saveSettings(); placeWidget(); } },
    { label: 'Move widget right', enabled: settings.widget, click: () => { settings.x += 40; saveSettings(); placeWidget(); } },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: i => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
}
nativeTheme.on('updated', sendTheme);

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: W, height: H, show: false, frame: false, transparent: true, backgroundColor: '#00000000',
    hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenuBarVisibility(false);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('tasks.html');
  win.once('ready-to-show', () => { place(); win.showInactive(); });
  win.on('blur', () => win.webContents.send('cmd', 'close'));
  win.on('close', e => { if (!quitting) e.preventDefault(); });

  globalShortcut.register('Control+Alt+T', () => cmd('toggle'));

  // tapping Ctrl+Alt on its own (no other key) toggles the island
  helper = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'keytap.ps1')], { windowsHide: true });
  let buf = '';
  helper.stdout.on('data', d => { buf += d; const parts = buf.split(String.fromCharCode(10)); buf = parts.pop(); if (parts.some(l => l.trim() === 'tap')) cmd('toggle'); });

  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
  tray.setToolTip('Quick Tasks (tap Ctrl+Alt)');
  tray.on('click', () => cmd('open'));
  screen.on('display-metrics-changed', () => placeWidget());
  buildMenu();
  if (settings.widget) setWidget(true);
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (helper) helper.kill(); });
app.on('window-all-closed', e => e.preventDefault());

// Proceso principal de Electron: ventana, almacenamiento local (JSON) y carga de contenido.
const { app, BrowserWindow, ipcMain, nativeTheme, shell, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

nativeTheme.themeSource = 'system';

// En desarrollo el contenido vive en ./content; empaquetado, en Resources/content
// (fuera del asar, para que se pueda editar sin recompilar).
function contentDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'content')
    : path.join(__dirname, 'content');
}

function dataFile() {
  return path.join(app.getPath('userData'), 'progress.json');
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Escritura atómica: primero a un archivo temporal, luego rename.
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

ipcMain.handle('store:load', () => readJSON(dataFile(), null));
ipcMain.handle('store:save', (_e, data) => {
  writeJSON(dataFile(), data);
  return true;
});

ipcMain.handle('content:load', (_e, name) => {
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error('Nombre de contenido inválido');
  const file = path.join(contentDir(), name + '.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { __error: `No se pudo leer content/${name}.json: ${err.message}` };
  }
});

// ---------- Grabaciones del simulador de entrevista ----------
function recordingsDir() {
  return path.join(app.getPath('userData'), 'recordings');
}
function recordingFile(id) {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Id de grabación inválido');
  return path.join(recordingsDir(), id + '.webm');
}
ipcMain.handle('recordings:save', (_e, id, bytes) => {
  fs.mkdirSync(recordingsDir(), { recursive: true });
  fs.writeFileSync(recordingFile(id), Buffer.from(bytes));
  return true;
});
ipcMain.handle('recordings:load', (_e, id) => {
  try {
    return new Uint8Array(fs.readFileSync(recordingFile(id)));
  } catch {
    return null;
  }
});
ipcMain.handle('recordings:delete', (_e, id) => {
  fs.rmSync(recordingFile(id), { force: true });
  return true;
});

// En macOS hay que pedir permiso de micrófono al sistema (usa NSMicrophoneUsageDescription).
ipcMain.handle('media:askMic', async () => {
  if (process.platform !== 'darwin') return true;
  if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true;
  return systemPreferences.askForMediaAccess('microphone');
});

ipcMain.handle('app:paths', () => ({
  userData: app.getPath('userData'),
  content: contentDir(),
}));
ipcMain.handle('app:openPath', (_e, which) => {
  const target = which === 'content' ? contentDir() : app.getPath('userData');
  return shell.openPath(target);
});

function createWindow() {
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'English Coach',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: 'followWindow',
    backgroundColor: isMac ? '#00000000' : (nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Los enlaces externos (si los hubiera) se abren fuera de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // Solo se permite el micrófono (para grabar respuestas); cualquier otro permiso se niega.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const audioOnly = permission === 'media' && (details.mediaTypes || []).every((t) => t === 'audio');
    callback(audioOnly);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

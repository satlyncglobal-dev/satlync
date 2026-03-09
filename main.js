const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const https = require('https');

const API_BASE = 'https://432b9c4f-5fca-46c5-b93e-2aed5a2be436-00-umx4k3ul4rnm.janeway.replit.dev';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 580,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#03060c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// System checks
ipcMain.handle('system-check', async () => {
  const results = {};
  try {
    const release = fs.readFileSync('/etc/os-release', 'utf8');
    results.ubuntu = release.includes('Ubuntu');
    const match = release.match(/VERSION_ID="([^"]+)"/);
    results.version = match ? match[1] : 'Unknown';
    results.supported = ['20.04', '22.04', '24.04'].includes(results.version);
  } catch { results.ubuntu = false; results.supported = false; }
  try { execSync('node --version'); results.node = true; } catch { results.node = false; }
  const mem = os.totalmem() / (1024 * 1024 * 1024);
  results.memory = mem >= 1.5;
  results.memoryGB = mem.toFixed(1);
  const arch = os.arch();
  results.arch = arch === 'x64';
  return results;
});

// Detect network interfaces
ipcMain.handle('get-interfaces', async () => {
  const ifaces = [];
  try {
    const out = execSync("ip -o link show | awk '{print $2}' | sed 's/://'").toString().trim().split('\n');
    for (const name of out) {
      if (name === 'lo') continue;
      let type = 'unknown', icon = '🌐';
      if (/^eth|^enp|^ens/.test(name)) { type = 'Ethernet'; icon = '🔌'; }
      else if (/^wlan|^wlp/.test(name)) { type = 'WiFi'; icon = '📶'; }
      else if (/^wwan|^usb/.test(name)) { type = 'LTE/USB'; icon = '📱'; }
      else if (/^tun|^tap/.test(name)) { type = 'VPN/Tunnel'; icon = '🔒'; }
      let ip = '';
      try { ip = execSync(`ip -4 addr show ${name} | grep inet | awk '{print $2}' | cut -d/ -f1`).toString().trim(); } catch {}
      ifaces.push({ name, type, icon, ip });
    }
  } catch {}
  return ifaces;
});

// Run silent install
ipcMain.handle('run-install', async (event, { interfaces }) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.resourcesPath, 'scripts', 'postinstall-silent.sh');
    const ifaceList = interfaces.join(',');
    exec(`pkexec bash "${scriptPath}" "${ifaceList}" "${API_BASE}"`, (err, stdout, stderr) => {
      if (err) { resolve({ success: false, error: err.message }); return; }
      resolve({ success: true });
    });
  });
});

// Poll for activation code from daemon
ipcMain.handle('get-activation-code', async () => {
  return new Promise((resolve) => {
    const localUrl = 'http://localhost:3456/api/status';
    const req = require('http').get(localUrl, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ code: JSON.parse(data).activationCode || null }); }
        catch { resolve({ code: null }); }
      });
    });
    req.on('error', () => resolve({ code: null }));
    req.on('timeout', () => { req.destroy(); resolve({ code: null }); });
  });
});

// Open browser
ipcMain.handle('open-url', async (event, url) => {
  shell.openExternal(url);
});

// Quit installer
ipcMain.handle('quit', () => app.quit());

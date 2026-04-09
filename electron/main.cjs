const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs   = require("fs");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// ── Config storage (userData/veval-config.json) ─────────────────
function configPath() {
  return path.join(app.getPath("userData"), "veval-config.json");
}
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), "utf8")); }
  catch { return {}; }
}
function writeConfig(data) {
  fs.writeFileSync(configPath(), JSON.stringify(data, null, 2), "utf8");
}

// ── IPC handlers ─────────────────────────────────────────────────
ipcMain.handle("config:get", () => readConfig());
ipcMain.handle("config:set", (_e, data) => { writeConfig(data); return true; });
ipcMain.handle("config:clear", () => { try { fs.unlinkSync(configPath()); } catch {} return true; });

// Open external links in default browser, not inside Electron
ipcMain.on("open-external", (_e, url) => shell.openExternal(url));

// ── Window ───────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "Vertiport Eval",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Open anchor clicks in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

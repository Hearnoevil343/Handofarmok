const { app, protocol, net, shell, BrowserWindow } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..", "dist");

// A real scheme (not file://) so fetch() works for public/presets/*.txt
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    backgroundColor: "#1a1a1d",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // Links that ask for a new window (the update notice, the GitHub link on the
  // About page) belong in the system browser. Electron would otherwise open them
  // in a bare window of its own, with no address bar and no way to download.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL("app://local/index.html");
}

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const { pathname } = new URL(req.url);
    const file = path.join(ROOT, decodeURIComponent(pathname));
    if (!file.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import { DesktopService } from "./desktop-service.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { InputIsolation, cliRunner, defaultHidHideCli } from "../isolation/hidhide.js";
import { nativeExecutable } from "../native/executable.js";
import { OutputClient } from "../virtual-controller/output-client.js";

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let isQuitting = false;
let service: DesktopService | undefined;
let shutdownComplete = false;
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
});

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1450,
    height: 950,
    minWidth: 360,
    minHeight: 480,
    show: false,
    icon: fileURLToPath(new URL("./icon.png", import.meta.url)),
    backgroundColor: "#0a0d11",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
    },
  });

  void window.loadFile(fileURLToPath(new URL("./renderer/index.html", import.meta.url)));
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });
  return window;
}

function createTray(): Tray {
  const placeholderIcon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA" +
      "DUlEQVR42mNk+M/wHwAF/gL+XwzXWQAAAABJRU5ErkJggg==",
  );
  const applicationTray = new Tray(placeholderIcon);
  applicationTray.setToolTip("XBridge");
  applicationTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open XBridge",
        click: () => mainWindow?.show(),
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  applicationTray.on("double-click", () => mainWindow?.show());
  return applicationTray;
}

void app.whenReady().then(() => {
  if (!primaryInstance) return;
  const directory = app.getPath("userData");
  const cli = defaultHidHideCli();
  // Only XBridge's own readers may still see the hidden controller: Electron (raw HID capture)
  // and the native joystick reader.
  const isolation = new InputIsolation(
    cli ? cliRunner(cli) : undefined,
    [process.execPath, nativeExecutable("native")],
    join(directory, "isolation.json"),
  );
  service = new DesktopService(directory, () => new OutputClient(), isolation);
  void service.recoverIsolation().catch((error: unknown) => {
    console.error(error);
  });
  const handlers: Record<string, (value: unknown) => unknown> = {
    connect: () => service?.connect(),
    disconnect: () => service?.disconnect(),
    state: () => service?.snapshot(),
    capture: (value) => service?.capture(value),
    loadMapping: () => service?.loadMapping(),
    saveMapping: (value) => service?.saveMapping(value),
    previewMapping: (value) => service?.previewMapping(value),
    startOutput: () => service?.startOutput(),
    stopOutput: () => service?.stopOutput(),
  };
  for (const [name, handler] of Object.entries(handlers))
    ipcMain.handle(`desktop:${name}`, (event, value: unknown) => {
      if (
        event.sender !== mainWindow?.webContents ||
        event.senderFrame !== mainWindow.webContents.mainFrame
      )
        throw new Error("Untrusted sender.");
      return handler(value);
    });
  mainWindow = createWindow();
  tray = createTray();

  if (!process.argv.includes("--minimized")) {
    mainWindow.show();
  }
});

app.on("window-all-closed", () => {
  // XBridge remains available through the tray on Windows.
});

app.on("before-quit", (event) => {
  isQuitting = true;
  if (!shutdownComplete && service) {
    event.preventDefault();
    void service
      .disconnect()
      .catch((error: unknown) => {
        console.error(error);
      })
      .finally(() => {
        shutdownComplete = true;
        app.quit();
      });
  }
  tray?.destroy();
});

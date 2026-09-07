// Electron sandbox preloads must use CommonJS; ESM imports cannot run here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import electron = require("electron");
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld(
  "xbridge",
  Object.freeze({
    startOutput: () => ipcRenderer.invoke("desktop:startOutput"),
    stopOutput: () => ipcRenderer.invoke("desktop:stopOutput"),
    previewMapping: (mapping: unknown) => ipcRenderer.invoke("desktop:previewMapping", mapping),
    connect: () => ipcRenderer.invoke("desktop:connect"),
    disconnect: () => ipcRenderer.invoke("desktop:disconnect"),
    state: () => ipcRenderer.invoke("desktop:state"),
    capture: (label: string) => ipcRenderer.invoke("desktop:capture", label),
    loadMapping: () => ipcRenderer.invoke("desktop:loadMapping"),
    saveMapping: (mapping: unknown) => ipcRenderer.invoke("desktop:saveMapping", mapping),
  }),
);

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    "start-service": (name: string) => ipcRenderer.invoke("start-service", name),
    "stop-service": (name: string) => ipcRenderer.invoke("stop-service", name),
    "get-services": () => ipcRenderer.invoke("get-services"),
})


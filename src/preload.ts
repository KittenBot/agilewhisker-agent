// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    "start_service": (name: string) => ipcRenderer.invoke("start-service", name),
    "stop_service": (name: string) => ipcRenderer.invoke("stop-service", name),
    "get_services": () => ipcRenderer.invoke("get-services"),
})


// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    "start_service": (name: string) => ipcRenderer.invoke("start-service", name),
    "stop_service": (name: string) => ipcRenderer.invoke("stop-service", name),
    "get_services": () => ipcRenderer.invoke("get-services"),
    // screen capture selection done
    "selection_done": (x: number, y: number, width: number, height: number) => ipcRenderer.invoke("selection-done", x, y, width, height),
    "ocr_result": (result: string) => ipcRenderer.invoke("ocr-result", result),
    "show_chat": (text: string) => ipcRenderer.invoke("show-chat", text),
    "get_settings": () => ipcRenderer.invoke("get-settings"),
    "save_settings": (settings: any) => ipcRenderer.invoke("save-settings", settings),
    // text to chat window
    onUserText: (callback: any) => ipcRenderer.on('user-text', (event, text) => callback(text)),
})


const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Config: { provider: "anthropic"|"openai"|"gemini", apiKey: string }
  getConfig:   ()       => ipcRenderer.invoke("config:get"),
  setConfig:   (data)   => ipcRenderer.invoke("config:set", data),
  clearConfig: ()       => ipcRenderer.invoke("config:clear"),
  openExternal: (url)   => ipcRenderer.send("open-external", url),
  isElectron: true,
});

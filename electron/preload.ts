import { contextBridge, ipcRenderer, webUtils } from "electron";

export interface ElectronAPI {
  selectDocuments: () => Promise<string[] | null>;
  selectOutputFolder: () => Promise<string | null>;
  revealFile: (filePath: string) => Promise<boolean>;
  openPreviewWindow: (filePath: string, title?: string) => Promise<boolean>;
  readFileContent: (filePath: string) => Promise<string | null>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  isAlwaysOnTop: () => Promise<boolean>;
  storeApiKey: (apiKey: string) => Promise<boolean>;
  getApiKey: () => Promise<string | null>;
  getBackendInfo: () => Promise<{ port: number; token: string }>;
  getFilePath: (file: File) => string;
  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) => Promise<number | null>;
  stopFindInPage: (action?: "clearSelection" | "keepSelection" | "activateSelection") => Promise<void>;
  onFoundInPage: (callback: (result: { activeMatchOrdinal: number; numberOfMatches: number; finalUpdate: boolean }) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  selectDocuments: () => ipcRenderer.invoke("dialog:selectDocuments"),
  selectOutputFolder: () => ipcRenderer.invoke("dialog:selectOutputFolder"),
  revealFile: (filePath: string) => ipcRenderer.invoke("shell:revealFile", filePath),
  openPreviewWindow: (filePath: string, title?: string) =>
    ipcRenderer.invoke("preview:openWindow", filePath, title),
  readFileContent: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke("window:setAlwaysOnTop", flag),
  isAlwaysOnTop: () => ipcRenderer.invoke("window:isAlwaysOnTop"),
  storeApiKey: (apiKey: string) => ipcRenderer.invoke("secure:storeApiKey", apiKey),
  getApiKey: () => ipcRenderer.invoke("secure:getApiKey"),
  getBackendInfo: () => ipcRenderer.invoke("config:getBackendInfo"),
  getFilePath: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return (file as any).path || "";
    }
  },
  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) =>
    ipcRenderer.invoke("window:findInPage", text, options),
  stopFindInPage: (action?: "clearSelection" | "keepSelection" | "activateSelection") =>
    ipcRenderer.invoke("window:stopFindInPage", action),
  onFoundInPage: (callback: (result: { activeMatchOrdinal: number; numberOfMatches: number; finalUpdate: boolean }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("window:foundInPageResult", handler);
    return () => ipcRenderer.removeListener("window:foundInPageResult", handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

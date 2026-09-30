import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { spawn, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcess | null = null;
let backendPort: number = 0;
const sessionToken: string = crypto.randomUUID();

// Path to encrypted credentials file
const credentialsPath = path.join(app.getPath("userData"), "secure_credentials.bin");

function getPythonPath(): string {
  // Check virtual environment first
  const venvPython = path.join(__dirname, "../../backend/.venv/bin/python");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  const venvPythonWin = path.join(__dirname, "../../backend/.venv/Scripts/python.exe");
  if (fs.existsSync(venvPythonWin)) {
    return venvPythonWin;
  }
  return "python3";
}

function startPythonBackend(): Promise<number> {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonPath();
    const runScript = path.join(__dirname, "../../backend/run.py");
    const backendCwd = path.join(__dirname, "../../backend");

    console.log(`Starting Python backend using: ${pythonExe} ${runScript}`);

    pythonProcess = spawn(pythonExe, [runScript], {
      cwd: backendCwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONPATH: backendCwd,
        SESSION_TOKEN: sessionToken,
        PARENT_PID: process.pid.toString(),
      },
    });

    let resolved = false;

    pythonProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        console.log(`[Python stdout] ${line}`);
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.event === "SERVER_READY" && parsed.port) {
            backendPort = parsed.port;
            if (!resolved) {
              resolved = true;
              resolve(backendPort);
            }
          }
        } catch {
          // Normal logging line
        }
      }
    });

    pythonProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`[Python stderr] ${data.toString()}`);
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start Python backend process:", err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    pythonProcess.on("exit", (code, signal) => {
      console.log(`Python backend exited with code: ${code}, signal: ${signal}`);
      if (!resolved) {
        resolved = true;
        reject(new Error(`Python process exited prematurely with code ${code}`));
      }
    });

    // Timeout safety
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timeout waiting for Python backend handshake"));
      }
    }, 15000);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: "Academic Document Processor",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../frontend/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("dialog:selectDocuments", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Academic Document(s)",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Supported Documents",
        extensions: ["pdf", "docx", "pptx", "txt", "md"],
      },
      { name: "PDF Documents", extensions: ["pdf"] },
      { name: "Word Documents", extensions: ["docx"] },
      { name: "PowerPoint Presentations", extensions: ["pptx"] },
      { name: "Text & Markdown", extensions: ["txt", "md"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths;
});

ipcMain.handle("dialog:selectOutputFolder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Output Folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("shell:revealFile", async (_event, filePath: string) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("secure:storeApiKey", async (_event, apiKey: string) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      fs.writeFileSync(credentialsPath, encrypted);
    } else {
      // Fallback encoding if OS keychain not available
      const b64 = Buffer.from(apiKey, "utf-8").toString("base64");
      fs.writeFileSync(credentialsPath, b64, "utf-8");
    }
    return true;
  } catch (err) {
    console.error("Failed to store API key securely:", err);
    return false;
  }
});

ipcMain.handle("secure:getApiKey", async () => {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return null;
    }
    const buffer = fs.readFileSync(credentialsPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer);
    } else {
      return Buffer.from(buffer.toString("utf-8"), "base64").toString("utf-8");
    }
  } catch (err) {
    console.error("Failed to read secure API key:", err);
    return null;
  }
});

ipcMain.handle("config:getBackendInfo", async () => {
  return {
    port: backendPort,
    token: sessionToken,
  };
});

function createPreviewWindow(filePath: string, title?: string): BrowserWindow {
  const previewWin = new BrowserWindow({
    width: 900,
    height: 750,
    minWidth: 600,
    minHeight: 450,
    title: title || path.basename(filePath),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Relay found-in-page search results to renderer
  previewWin.webContents.on("found-in-page", (_event, result) => {
    previewWin.webContents.send("window:foundInPageResult", {
      activeMatchOrdinal: result.activeMatchOrdinal,
      numberOfMatches: result.matches,
      finalUpdate: result.finalUpdate,
    });
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const hash = `preview?path=${encodeURIComponent(filePath)}&title=${encodeURIComponent(title || path.basename(filePath))}`;
  if (isDev) {
    previewWin.loadURL(`http://localhost:5173/#${hash}`);
  } else {
    previewWin.loadFile(path.join(__dirname, "../../frontend/dist/index.html"), { hash });
  }

  return previewWin;
}

ipcMain.handle("preview:openWindow", async (_event, filePath: string, title?: string) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }
  createPreviewWindow(filePath, title);
  return true;
});

ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (err) {
    console.error("Failed to read file:", err);
    return null;
  }
});

ipcMain.handle("window:setAlwaysOnTop", async (event, flag: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setAlwaysOnTop(flag);
    return win.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle("window:isAlwaysOnTop", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isAlwaysOnTop() : false;
});

ipcMain.handle("window:findInPage", async (event, text: string, options?: Electron.FindInPageOptions) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !text) return null;
  return win.webContents.findInPage(text, options);
});

ipcMain.handle("window:stopFindInPage", async (event, action?: "clearSelection" | "keepSelection" | "activateSelection") => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.webContents.stopFindInPage(action || "clearSelection");
});

// App Lifecycle
app.whenReady().then(async () => {
  try {
    console.log("Initializing application...");
    await startPythonBackend();
    createWindow();
  } catch (err) {
    console.error("Startup error:", err);
    dialog.showErrorBox(
      "Backend Startup Failed",
      `Failed to launch the Python backend service:\n${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (pythonProcess && !pythonProcess.killed) {
    console.log("Terminating Python child process...");
    pythonProcess.kill("SIGTERM");
  }
});

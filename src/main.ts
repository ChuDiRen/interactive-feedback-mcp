import pkg, { BrowserWindow as BrowserWindowType } from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = pkg;
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { kill } from 'process';

interface FeedbackResult {
  command_logs: string;
  interactive_feedback: string;
}

class ElectronApp {
  private mainWindow: BrowserWindowType | null = null;
  private currentProcess: ChildProcess | null = null;
  private projectDirectory: string = '';
  private prompt: string = '';
  private outputFile: string = '';

  constructor() {
    this.setupApp();
    this.setupIPC();
  }

  private setupApp() {
    app.whenReady().then(() => {
      this.createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      this.cleanup();
    });
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
      icon: path.join(__dirname, '../assets/feedback.png'),
      show: false,
      titleBarStyle: 'default',
    });

    // Load the HTML file
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.cleanup();
    });
  }

  private setupIPC() {
    ipcMain.handle('get-initial-data', () => {
      return {
        projectDirectory: this.projectDirectory,
        prompt: this.prompt,
      };
    });

    ipcMain.handle('run-command', async (event, command: string, cwd: string) => {
      return new Promise((resolve, reject) => {
        this.currentProcess = spawn(command, {
          shell: true,
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        this.currentProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          event.sender.send('command-output', output);
        });

        this.currentProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          event.sender.send('command-output', output);
        });

        this.currentProcess.on('close', (code) => {
          this.currentProcess = null;
          resolve({ code, stdout, stderr });
        });

        this.currentProcess.on('error', (error) => {
          this.currentProcess = null;
          reject(error);
        });
      });
    });

    ipcMain.handle('stop-command', () => {
      if (this.currentProcess) {
        this.killProcessTree(this.currentProcess.pid!);
        this.currentProcess = null;
        return true;
      }
      return false;
    });

    ipcMain.handle('submit-feedback', async (event, logs: string, feedback: string) => {
      const result: FeedbackResult = {
        command_logs: logs,
        interactive_feedback: feedback,
      };

      if (this.outputFile) {
        const fs = require('fs').promises;
        try {
          await fs.writeFile(this.outputFile, JSON.stringify(result, null, 2));
        } catch (error) {
          console.error('Failed to write output file:', error);
        }
      }

      app.quit();
      return result;
    });

    ipcMain.handle('get-platform', () => {
      return process.platform;
    });
  }

  private killProcessTree(pid: number) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/t', '/f']);
      } else {
        kill(-pid, 'SIGTERM');
      }
    } catch (error) {
      console.error('Failed to kill process tree:', error);
    }
  }

  private cleanup() {
    if (this.currentProcess) {
      this.killProcessTree(this.currentProcess.pid!);
      this.currentProcess = null;
    }
  }

  public setInitialData(projectDirectory: string, prompt: string, outputFile: string) {
    this.projectDirectory = projectDirectory;
    this.prompt = prompt;
    this.outputFile = outputFile;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    projectDirectory: process.cwd(),
    prompt: 'I implemented the changes you requested.',
    outputFile: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-directory':
        result.projectDirectory = args[++i];
        break;
      case '--prompt':
        result.prompt = args[++i];
        break;
      case '--output-file':
        result.outputFile = args[++i];
        break;
    }
  }

  return result;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const electronApp = new ElectronApp();
  const args = parseArgs();
  electronApp.setInitialData(args.projectDirectory, args.prompt, args.outputFile);
}

export { ElectronApp };
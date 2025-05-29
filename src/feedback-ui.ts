#!/usr/bin/env node

import pkg from 'electron';
const { app, BrowserWindow } = pkg;
import { ElectronApp } from './main.js';
import * as fs from 'fs';
import * as path from 'path';

interface FeedbackResult {
  command_logs: string;
  interactive_feedback: string;
}

class FeedbackUI {
  private electronApp: ElectronApp;
  private projectDirectory: string;
  private prompt: string;
  private outputFile?: string;

  constructor(projectDirectory: string, prompt: string, outputFile?: string) {
    this.projectDirectory = projectDirectory;
    this.prompt = prompt;
    this.outputFile = outputFile;
    this.electronApp = new ElectronApp();
  }

  async run(): Promise<FeedbackResult> {
    return new Promise((resolve, reject) => {
      // Set initial data for the Electron app
      this.electronApp.setInitialData(
        this.projectDirectory,
        this.prompt,
        this.outputFile || ''
      );

      // Handle app events
      app.on('window-all-closed', () => {
        // Read result from output file if specified
        if (this.outputFile && fs.existsSync(this.outputFile)) {
          try {
            const resultData = fs.readFileSync(this.outputFile, 'utf8');
            const result = JSON.parse(resultData) as FeedbackResult;
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to read output file: ${error}`));
          }
        } else {
          // Return empty result if no output file
          resolve({
            command_logs: '',
            interactive_feedback: ''
          });
        }
      });

      app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
          this.electronApp = new ElectronApp();
          this.electronApp.setInitialData(
            this.projectDirectory,
            this.prompt,
            this.outputFile || ''
          );
        }
      });
    });
  }
}

// Command line interface
function parseArgs(): {
  projectDirectory: string;
  prompt: string;
  outputFile?: string;
} {
  const args = process.argv.slice(2);
  const result = {
    projectDirectory: process.cwd(),
    prompt: 'I implemented the changes you requested.',
    outputFile: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-directory':
        if (i + 1 < args.length) {
          result.projectDirectory = args[++i];
        }
        break;
      case '--prompt':
        if (i + 1 < args.length) {
          result.prompt = args[++i];
        }
        break;
      case '--output-file':
        if (i + 1 < args.length) {
          result.outputFile = args[++i];
        }
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: feedback-ui [options]

Options:
  --project-directory <path>  Project directory (default: current directory)
  --prompt <text>            Prompt text (default: "I implemented the changes you requested.")
  --output-file <path>       Output file for results (optional)
  --help, -h                 Show this help message
`);
        process.exit(0);
        break;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  
  // Ensure project directory exists
  if (!fs.existsSync(args.projectDirectory)) {
    console.error(`Error: Project directory does not exist: ${args.projectDirectory}`);
    process.exit(1);
  }

  // Create output directory if specified
  if (args.outputFile) {
    const outputDir = path.dirname(args.outputFile);
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (error) {
        console.error(`Error: Failed to create output directory: ${error}`);
        process.exit(1);
      }
    }
  }

  try {
    const feedbackUI = new FeedbackUI(
      args.projectDirectory,
      args.prompt,
      args.outputFile
    );
    
    const result = await feedbackUI.run();
    
    if (!args.outputFile) {
      console.log('\nLogs collected:');
      console.log(result.command_logs);
      console.log('\nFeedback received:');
      console.log(result.interactive_feedback);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { FeedbackUI };
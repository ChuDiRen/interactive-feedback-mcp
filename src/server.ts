#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { FeedbackUI } from './feedback-ui.js';

interface FeedbackResult {
  command_logs: string;
  interactive_feedback: string;
}

class InteractiveFeedbackMCP {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'interactive-feedback-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'interactive_feedback',
            description: 'Request interactive feedback for a given project directory and summary',
            inputSchema: {
              type: 'object',
              properties: {
                project_directory: {
                  type: 'string',
                  description: 'Full path to the project directory',
                },
                summary: {
                  type: 'string',
                  description: 'Short, one-line summary of the changes',
                },
              },
              required: ['project_directory', 'summary'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'interactive_feedback') {
        const { project_directory, summary } = request.params.arguments as {
          project_directory: string;
          summary: string;
        };

        try {
          const result = await this.launchFeedbackUI(
            this.firstLine(project_directory),
            this.firstLine(summary)
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  private async launchFeedbackUI(
    projectDirectory: string,
    summary: string
  ): Promise<FeedbackResult> {
    // Create a temporary file for the feedback result
    const tmpDir = os.tmpdir();
    const outputFile = path.join(tmpDir, `feedback-${Date.now()}.json`);

    try {
      // Get the path to feedback UI script
      const scriptDir = path.dirname(__filename);
      const feedbackUIPath = path.join(scriptDir, 'feedback-ui.js');

      // Check if we're in development mode
      const isDev = process.env.NODE_ENV === 'development';
      const command = isDev ? 'ts-node' : 'node';
      const scriptPath = isDev
        ? path.join(path.dirname(scriptDir), 'src', 'feedback-ui.ts')
        : feedbackUIPath;

      // Run feedback UI as a separate process
      const args = [
        scriptPath,
        '--project-directory',
        projectDirectory,
        '--prompt',
        summary,
        '--output-file',
        outputFile,
      ];

      const result = spawn(command, args, {
        stdio: ['ignore', 'ignore', 'ignore'],
        detached: false,
      });

      // Wait for the process to complete
      await new Promise<void>((resolve, reject) => {
        result.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Feedback UI process exited with code ${code}`));
          } else {
            resolve();
          }
        });

        result.on('error', (error) => {
          reject(new Error(`Failed to launch feedback UI: ${error.message}`));
        });
      });

      // Read the result from the temporary file
      const resultData = await fs.promises.readFile(outputFile, 'utf8');
      const feedbackResult = JSON.parse(resultData) as FeedbackResult;

      // Clean up temporary file
      await fs.promises.unlink(outputFile);

      return feedbackResult;
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.promises.unlink(outputFile);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private firstLine(text: string): string {
    return text.split('\n')[0].trim();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Interactive Feedback MCP server running on stdio');
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new InteractiveFeedbackMCP();
    server.run().catch((error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
}

export { InteractiveFeedbackMCP };
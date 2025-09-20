#!/usr/bin/env node
// Copyright (c) 2025 左岚. All rights reserved.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { startWebServer } from './server/web-server.js';

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
    const web = await startWebServer({
      projectDirectory,
      prompt: summary,
      port: Number(process.env.MCP_WEB_PORT || 5000),
    });

    console.error(`Open the feedback page: ${web.url}`);

    try {
      const result = await web.waitForResult;
      return result;
    } finally {
      await web.close();
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
const isMain = (() => {
  try {
    return pathToFileURL(process.argv[1]).href === import.meta.url; // Windows/macOS/Linux兼容
  } catch {
    return false;
  }
})();

if (isMain) {
  const server = new InteractiveFeedbackMCP();
  server.run().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

export { InteractiveFeedbackMCP };
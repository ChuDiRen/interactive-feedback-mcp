#!/usr/bin/env node
// Copyright (c) 2025 左岚. All rights reserved.

import { startWebServer } from './server/web-server.js';  // 注释

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (typeof v === 'undefined') args[k] = true; else args[k] = v;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const port = Number(args.port || process.env.MCP_WEB_PORT || 5000);
  const prompt = String(args.prompt || '请对本次工作给出反馈');
  const projectDirectory = String(args.cwd || process.cwd());

  const web = await startWebServer({ projectDirectory, prompt, port });
  console.error(`[web] listening at ${web.url}`);  // 注释

  const result = await web.waitForResult;  // 注释
  console.log(JSON.stringify(result));
  await web.close();
}

main().catch((e) => { console.error(e); process.exit(1); });


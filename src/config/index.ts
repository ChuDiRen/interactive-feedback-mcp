// Copyright (c) 2025 左岚. All rights reserved.

import dotenv from 'dotenv';
dotenv.config(); // 加载 .env

const toBool = (v: any, d=false) => {
  if (v === undefined || v === null || v === '') return d; // 注释
  const s = String(v).toLowerCase();
  return ['1','true','yes','y','on'].includes(s); // 注释
};

const toInt = (v: any, d: number) => {
  const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : d; // 注释
};

export const config = {
  port: toInt(process.env.MCP_WEB_PORT, 5000), // 注释
  apiKey: process.env.MCP_API_KEY || '', // 注释
  apiBaseUrl: process.env.MCP_API_BASE_URL || 'https://api.openai.com/v1', // 注释
  defaultModel: process.env.MCP_DEFAULT_MODEL || 'gpt-4o-mini', // 注释
  dialogTimeout: toInt(process.env.MCP_DIALOG_TIMEOUT, 60000), // 注释
  enableImageToText: toBool(process.env.MCP_ENABLE_IMAGE_TO_TEXT, true), // 注释
};

export type AppConfig = typeof config;


#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

// Run Jest with proper configuration
const jestProcess = spawn('npx', ['jest', '--config', 'jest.config.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

jestProcess.on('close', (code) => {
  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('Failed to start Jest:', error);
  process.exit(1);
});




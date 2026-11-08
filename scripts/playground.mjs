import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../apps/pcrd/dist/index.js';

// Dedicated identity; never initialize or index the owner's existing ~/.pcr installation.
const userDir = resolve(process.env.PCR_USER_DIR || join(homedir(), 'Library/Application Support/PCR/playground-owner'));
await mkdir(userDir, { recursive: true, mode: 0o700 });
await writeFile(join(userDir, 'config.yaml'), 'tools:\n  enabled: [progress-assessment, coding, planner, grammar]\nintelligence:\n  enabled: false\n  provider: none\n', { flag: 'wx', mode: 0o600 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
process.env.PCR_USER_DIR = userDir;
process.env.PCR_DB_PATH = process.env.PCR_DB_PATH || join(userDir, 'pcr.sqlite');
process.env.PCR_SKIP_ENV_FILE = '1';
process.chdir(userDir);
const server = await startServer({ workspaceDir: userDir, port: Number(process.env.PCR_PORT || 4319) });
console.log(`PCR Playground: ${server.url}/dashboard/playground/`);
console.log(`Local workspace: ${userDir}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });

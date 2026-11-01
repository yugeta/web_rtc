import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'login.log');

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function appendLoginLog(user: { sub: string; name: string; email: string }): void {
  ensureDataDir();
  const timestamp = new Date().toISOString();
  const line = `${timestamp}\t${user.sub}\t${user.name}\t${user.email}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf-8');
}

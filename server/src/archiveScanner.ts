import fs from 'fs';
import path from 'path';

const ARCHIVE_DIR = path.join(__dirname, '..', 'chat-logs', 'archive');

/**
 * Scans the archive directory and deletes files older than 30 days.
 * Only operates on server/chat-logs/archive/ — never touches active logs.
 */
export function scanAndCleanup(): void {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    return;
  }

  let files: string[];
  try {
    files = fs.readdirSync(ARCHIVE_DIR);
  } catch (error) {
    console.error('Failed to read archive directory:', error);
    return;
  }

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  for (const file of files) {
    // Expected pattern: {roomId}.{YYYYMMDD}.jsonl.gz
    const match = file.match(/\.(\d{4})(\d{2})(\d{2})\.jsonl\.gz$/);
    if (!match) {
      continue;
    }

    const [, year, month, day] = match;
    const fileDate = new Date(Number(year), Number(month) - 1, Number(day));
    const ageMs = now - fileDate.getTime();

    if (ageMs > THIRTY_DAYS_MS) {
      try {
        fs.unlinkSync(path.join(ARCHIVE_DIR, file));
      } catch (error) {
        console.error(`Failed to delete expired archive file ${file}:`, error);
      }
    }
  }
}

/**
 * Starts the archive cleanup scheduler.
 * Runs an initial scan immediately, then repeats every 1 hour.
 */
export function startScheduler(): void {
  scanAndCleanup();
  setInterval(scanAndCleanup, 3600000);
}

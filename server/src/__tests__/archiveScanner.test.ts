import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { scanAndCleanup } from '../archiveScanner';

const ARCHIVE_DIR = path.join(__dirname, '..', '..', 'chat-logs', 'archive');
const CHAT_LOGS_DIR = path.join(__dirname, '..', '..', 'chat-logs');

function formatDate(date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe('scanAndCleanup', () => {
  beforeEach(() => {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up archive dir
    if (fs.existsSync(ARCHIVE_DIR)) {
      for (const f of fs.readdirSync(ARCHIVE_DIR)) {
        fs.unlinkSync(path.join(ARCHIVE_DIR, f));
      }
      fs.rmdirSync(ARCHIVE_DIR);
    }
    if (fs.existsSync(CHAT_LOGS_DIR)) {
      // Remove any active log files created during tests
      for (const f of fs.readdirSync(CHAT_LOGS_DIR)) {
        const fp = path.join(CHAT_LOGS_DIR, f);
        if (fs.statSync(fp).isFile()) {
          fs.unlinkSync(fp);
        }
      }
    }
  });

  it('should return silently when archive directory does not exist', () => {
    // Remove the archive dir
    fs.rmdirSync(ARCHIVE_DIR);
    expect(() => scanAndCleanup()).not.toThrow();
  });

  it('should handle an empty archive directory', () => {
    expect(() => scanAndCleanup()).not.toThrow();
    expect(fs.readdirSync(ARCHIVE_DIR)).toEqual([]);
  });

  it('should delete files older than 30 days', () => {
    const oldDate = formatDate(daysAgo(31));
    const oldFile = `room1.${oldDate}.jsonl.gz`;
    fs.writeFileSync(path.join(ARCHIVE_DIR, oldFile), 'data');

    scanAndCleanup();

    expect(fs.existsSync(path.join(ARCHIVE_DIR, oldFile))).toBe(false);
  });

  it('should keep files that are 30 days old or newer', () => {
    const recentDate = formatDate(daysAgo(10));
    const recentFile = `room2.${recentDate}.jsonl.gz`;
    fs.writeFileSync(path.join(ARCHIVE_DIR, recentFile), 'data');

    scanAndCleanup();

    expect(fs.existsSync(path.join(ARCHIVE_DIR, recentFile))).toBe(true);
  });

  it('should delete expired files and keep recent files', () => {
    const oldDate = formatDate(daysAgo(35));
    const recentDate = formatDate(daysAgo(5));
    const oldFile = `roomA.${oldDate}.jsonl.gz`;
    const recentFile = `roomB.${recentDate}.jsonl.gz`;

    fs.writeFileSync(path.join(ARCHIVE_DIR, oldFile), 'data');
    fs.writeFileSync(path.join(ARCHIVE_DIR, recentFile), 'data');

    scanAndCleanup();

    expect(fs.existsSync(path.join(ARCHIVE_DIR, oldFile))).toBe(false);
    expect(fs.existsSync(path.join(ARCHIVE_DIR, recentFile))).toBe(true);
  });

  it('should skip files that do not match the expected naming pattern', () => {
    const nonMatchingFile = 'random-file.txt';
    fs.writeFileSync(path.join(ARCHIVE_DIR, nonMatchingFile), 'data');

    scanAndCleanup();

    expect(fs.existsSync(path.join(ARCHIVE_DIR, nonMatchingFile))).toBe(true);
  });

  it('should not touch active log files in chat-logs/ directory', () => {
    const activeLog = path.join(CHAT_LOGS_DIR, 'activeRoom.jsonl');
    fs.writeFileSync(activeLog, 'active log data');

    scanAndCleanup();

    expect(fs.existsSync(activeLog)).toBe(true);
  });

  it('should log error and continue when file deletion fails', () => {
    const oldDate = formatDate(daysAgo(40));
    const oldFile = `failRoom.${oldDate}.jsonl.gz`;
    fs.writeFileSync(path.join(ARCHIVE_DIR, oldFile), 'data');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('permission denied');
    });

    scanAndCleanup();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete expired archive file'),
      expect.any(Error)
    );

    errorSpy.mockRestore();
    unlinkSpy.mockRestore();
  });
});

import fc from 'fast-check';

/**
 * Feature: text-chat, Property 12: Archive Scannerは期限切れアーカイブのみを削除する
 * Validates: Requirements 7.3, 7.4
 */
describe('Property 12: Archive Scannerは期限切れアーカイブのみを削除する', () => {
  beforeEach(() => {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(ARCHIVE_DIR)) {
      for (const f of fs.readdirSync(ARCHIVE_DIR)) {
        fs.unlinkSync(path.join(ARCHIVE_DIR, f));
      }
    }
    if (fs.existsSync(CHAT_LOGS_DIR)) {
      for (const f of fs.readdirSync(CHAT_LOGS_DIR)) {
        const fp = path.join(CHAT_LOGS_DIR, f);
        if (fs.statSync(fp).isFile()) {
          fs.unlinkSync(fp);
        }
      }
    }
  });

  /** Generate a roomId: alphanumeric, 1-20 chars */
  const roomIdArb = fc.stringMatching(/^[a-z0-9]{1,20}$/);

  /** Generate days offset: expired (31-365) or non-expired (0-30) */
  const expiredDaysArb = fc.integer({ min: 31, max: 365 });
  const nonExpiredDaysArb = fc.integer({ min: 0, max: 29 });

  function formatDateFromDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  it('should delete only expired archives and keep non-expired ones', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(roomIdArb, expiredDaysArb), { minLength: 0, maxLength: 5 }),
        fc.array(fc.tuple(roomIdArb, nonExpiredDaysArb), { minLength: 0, maxLength: 5 }),
        (expiredEntries, nonExpiredEntries) => {
          // Clean archive dir before each iteration
          if (fs.existsSync(ARCHIVE_DIR)) {
            for (const f of fs.readdirSync(ARCHIVE_DIR)) {
              fs.unlinkSync(path.join(ARCHIVE_DIR, f));
            }
          }
          // Also clean active log files
          if (fs.existsSync(CHAT_LOGS_DIR)) {
            for (const f of fs.readdirSync(CHAT_LOGS_DIR)) {
              const fp = path.join(CHAT_LOGS_DIR, f);
              if (fs.statSync(fp).isFile()) {
                fs.unlinkSync(fp);
              }
            }
          }

          // Build unique filenames to avoid collisions
          const expiredFiles: string[] = [];
          const nonExpiredFiles: string[] = [];
          const usedNames = new Set<string>();

          for (const [roomId, days] of expiredEntries) {
            const dateStr = formatDateFromDaysAgo(days);
            const filename = `${roomId}.${dateStr}.jsonl.gz`;
            if (usedNames.has(filename)) continue;
            usedNames.add(filename);
            expiredFiles.push(filename);
            fs.writeFileSync(path.join(ARCHIVE_DIR, filename), 'data');
          }

          for (const [roomId, days] of nonExpiredEntries) {
            const dateStr = formatDateFromDaysAgo(days);
            const filename = `${roomId}.${dateStr}.jsonl.gz`;
            if (usedNames.has(filename)) continue;
            usedNames.add(filename);
            nonExpiredFiles.push(filename);
            fs.writeFileSync(path.join(ARCHIVE_DIR, filename), 'data');
          }

          // Act
          scanAndCleanup();

          // Assert: all expired files should be deleted
          for (const f of expiredFiles) {
            expect(fs.existsSync(path.join(ARCHIVE_DIR, f))).toBe(false);
          }

          // Assert: all non-expired files should still exist
          for (const f of nonExpiredFiles) {
            expect(fs.existsSync(path.join(ARCHIVE_DIR, f))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never touch active log files in chat-logs/ directory', () => {
    fc.assert(
      fc.property(
        roomIdArb,
        expiredDaysArb,
        (activeRoomId, expiredDays) => {
          // Clean before each iteration
          if (fs.existsSync(ARCHIVE_DIR)) {
            for (const f of fs.readdirSync(ARCHIVE_DIR)) {
              fs.unlinkSync(path.join(ARCHIVE_DIR, f));
            }
          }
          if (fs.existsSync(CHAT_LOGS_DIR)) {
            for (const f of fs.readdirSync(CHAT_LOGS_DIR)) {
              const fp = path.join(CHAT_LOGS_DIR, f);
              if (fs.statSync(fp).isFile()) {
                fs.unlinkSync(fp);
              }
            }
          }

          // Create an active log file in chat-logs/ (not archive)
          const activeLogFile = path.join(CHAT_LOGS_DIR, `${activeRoomId}.jsonl`);
          fs.writeFileSync(activeLogFile, 'active log data');

          // Create an expired archive file
          const dateStr = formatDateFromDaysAgo(expiredDays);
          const archiveFile = `expired.${dateStr}.jsonl.gz`;
          fs.writeFileSync(path.join(ARCHIVE_DIR, archiveFile), 'data');

          // Act
          scanAndCleanup();

          // Assert: active log file must still exist
          expect(fs.existsSync(activeLogFile)).toBe(true);
          // Assert: expired archive should be deleted
          expect(fs.existsSync(path.join(ARCHIVE_DIR, archiveFile))).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

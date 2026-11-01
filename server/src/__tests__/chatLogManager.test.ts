import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import { serializeMessage, parseMessage, appendMessage, getHistory, ChatMessage, MetaHeader } from '../chatLogManager';

/**
 * Feature: text-chat, Property 1: ChatMessageシリアライズのラウンドトリップ
 *
 * Validates: Requirements 1.4, 8.1, 8.2, 8.3
 *
 * 任意の有効なChatMessageオブジェクトに対して、serializeMessageで整形してから
 * parseMessageでパースした結果は、元のオブジェクトと等価である。
 */

const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  userName: fc.string({ minLength: 1 }),
  message: fc.string({ minLength: 1 }),
  timestamp: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

describe('Property 1: ChatMessageシリアライズのラウンドトリップ', () => {
  it('serializeMessage → parseMessage の結果が元のオブジェクトと等価である', () => {
    fc.assert(
      fc.property(chatMessageArb, (original: ChatMessage) => {
        const serialized = serializeMessage(original);
        const parsed = parseMessage(serialized);

        expect(parsed).not.toBeNull();
        expect(parsed).toEqual(original);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: text-chat, Property 8: 初回メッセージでメタヘッダー付きファイルが作成される
 *
 * Validates: Requirements 4.1, 4.2
 *
 * 任意のroomIdに対して、最初のメッセージをappendMessageで書き込んだ後、
 * Chat_Log_Fileの先頭行は_metaフィールドを持つメタヘッダーであり、
 * roomIdフィールドが引数のroomIdと一致する。
 */

// Resolve the chat-logs directory the same way the module does
const CHAT_LOGS_DIR = path.join(__dirname, '..', '..', 'chat-logs');

const roomIdArb = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/).map((s) => `__test_prop8_${s}`);

describe('Property 8: 初回メッセージでメタヘッダー付きファイルが作成される', () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const filePath of createdFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
    createdFiles.length = 0;
  });

  it('appendMessage後のファイル先頭行が正しいMetaHeaderであること', () => {
    fc.assert(
      fc.property(roomIdArb, chatMessageArb, (roomId: string, msg: ChatMessage) => {
        const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

        // Ensure the file does not exist before the test
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Track for cleanup
        createdFiles.push(filePath);

        // Ensure the directory exists
        fs.mkdirSync(CHAT_LOGS_DIR, { recursive: true });

        // Act: append a message to a new room
        appendMessage(roomId, msg);

        // Assert: file should exist
        expect(fs.existsSync(filePath)).toBe(true);

        // Read the first line
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.length > 0);
        expect(lines.length).toBeGreaterThanOrEqual(2); // meta header + message

        // Parse the first line as MetaHeader
        const firstLine = JSON.parse(lines[0]) as MetaHeader;
        expect(firstLine._meta).toBe('header');
        expect(firstLine.roomId).toBe(roomId);
        expect(typeof firstLine.createdAt).toBe('number');
        expect(firstLine.createdAt).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: text-chat, Property 9: 追記メッセージ数の不変条件
 *
 * Validates: Requirements 4.3
 *
 * 任意のN件のChatMessageをappendMessageで追記した後、
 * Chat_Log_Fileの非メタヘッダー行数はNと等しい。
 */

const roomIdArbProp9 = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/).map((s) => `__test_prop9_${s}`);

describe('Property 9: 追記メッセージ数の不変条件', () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const filePath of createdFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
    createdFiles.length = 0;
  });

  it('appendMessage後の非メタヘッダー行数がNと等しいこと', () => {
    fc.assert(
      fc.property(
        roomIdArbProp9,
        fc.array(chatMessageArb, { minLength: 1, maxLength: 50 }),
        (roomId: string, messages: ChatMessage[]) => {
          const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

          // Ensure the file does not exist before the test
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          // Track for cleanup
          createdFiles.push(filePath);

          // Ensure the directory exists
          fs.mkdirSync(CHAT_LOGS_DIR, { recursive: true });

          // Act: append N messages to the same room
          for (const msg of messages) {
            appendMessage(roomId, msg);
          }

          // Assert: file should exist
          expect(fs.existsSync(filePath)).toBe(true);

          // Read all lines
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter((l) => l.length > 0);

          // Count non-meta-header lines
          const nonMetaLines = lines.filter((line) => {
            try {
              const parsed = JSON.parse(line);
              return !(typeof parsed === 'object' && parsed !== null && '_meta' in parsed);
            } catch {
              return true;
            }
          });

          expect(nonMetaLines.length).toBe(messages.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: text-chat, Property 10: getHistoryはメタヘッダーを除外し時系列順でChatMessageのみを返す
 *
 * Validates: Requirements 5.1, 5.3, 5.4
 *
 * 任意のメタヘッダーとN件のChatMessageが書き込まれたChat_Log_Fileに対して、
 * getHistoryはN件のChatMessageのみを返し、_metaフィールドを持つ行は含まれず、
 * タイムスタンプの昇順で並んでいる。
 */

const roomIdArbProp10 = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/).map((s) => `__test_prop10_${s}`);

/**
 * Generate an array of ChatMessages with strictly increasing timestamps.
 */
const increasingTimestampMessagesArb = fc
  .array(chatMessageArb, { minLength: 1, maxLength: 50 })
  .map((messages) => {
    let ts = 1000;
    return messages.map((m) => {
      ts += 1;
      return { ...m, timestamp: ts };
    });
  });

describe('Property 10: getHistoryはメタヘッダーを除外し時系列順でChatMessageのみを返す', () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const filePath of createdFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
    createdFiles.length = 0;
  });

  it('getHistoryがN件のChatMessageのみを返し、メタヘッダーを含まず、タイムスタンプ昇順であること', () => {
    fc.assert(
      fc.property(roomIdArbProp10, increasingTimestampMessagesArb, (roomId: string, messages: ChatMessage[]) => {
        const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

        // Ensure the file does not exist before the test
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Track for cleanup
        createdFiles.push(filePath);

        // Ensure the directory exists
        fs.mkdirSync(CHAT_LOGS_DIR, { recursive: true });

        // Act: append N messages (first call creates meta header automatically)
        for (const msg of messages) {
          appendMessage(roomId, msg);
        }

        // Act: retrieve history
        const history = getHistory(roomId);

        // Assert: history length equals N (no meta header included)
        expect(history.length).toBe(messages.length);

        // Assert: no entry has a _meta field
        for (const entry of history) {
          expect(entry).not.toHaveProperty('_meta');
        }

        // Assert: each returned message matches the original
        for (let i = 0; i < messages.length; i++) {
          expect(history[i]).toEqual(messages[i]);
        }

        // Assert: timestamps are in ascending order
        for (let i = 1; i < history.length; i++) {
          expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: text-chat, Property 13: 不正なJSON行はスキップされ有効な行のみが返される
 *
 * Validates: Requirements 8.4
 *
 * 任意の有効なJSON行と不正なJSON行が混在するファイルに対して、
 * getHistoryは有効なChatMessage行のみを返し、不正な行はスキップされる。
 */

const roomIdArbProp13 = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/).map((s) => `__test_prop13_${s}`);

/**
 * Generate a string that is NOT valid JSON.
 * We filter out strings that happen to parse as valid JSON.
 */
const invalidJsonLineArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => {
    // Must not contain newlines (single JSONL line)
    if (s.includes('\n') || s.includes('\r')) return false;
    try {
      JSON.parse(s);
      return false; // valid JSON — reject
    } catch {
      return true; // invalid JSON — keep
    }
  });

describe('Property 13: 不正なJSON行はスキップされ有効な行のみが返される', () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const filePath of createdFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
    createdFiles.length = 0;
  });

  it('getHistoryが有効なChatMessageのみを返し、不正なJSON行をスキップすること', () => {
    fc.assert(
      fc.property(
        roomIdArbProp13,
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        fc.array(invalidJsonLineArb, { minLength: 1, maxLength: 20 }),
        fc.func(fc.boolean()),
        (roomId: string, validMessages: ChatMessage[], invalidLines: string[], orderFn: (v: unknown) => boolean) => {
          const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

          // Ensure clean state
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          createdFiles.push(filePath);
          fs.mkdirSync(CHAT_LOGS_DIR, { recursive: true });

          // Build file content: MetaHeader first, then interleaved valid/invalid lines
          const metaHeader: MetaHeader = {
            _meta: 'header',
            roomId,
            createdAt: Date.now(),
          };

          const validSerialized = validMessages.map((m) => serializeMessage(m));

          // Interleave valid and invalid lines using the generated order function
          const dataLines: string[] = [];
          let vi = 0;
          let ii = 0;
          let counter = 0;
          while (vi < validSerialized.length || ii < invalidLines.length) {
            if (vi < validSerialized.length && (ii >= invalidLines.length || orderFn(counter))) {
              dataLines.push(validSerialized[vi]);
              vi++;
            } else if (ii < invalidLines.length) {
              dataLines.push(invalidLines[ii]);
              ii++;
            }
            counter++;
          }

          // Write the file directly
          const fileContent = [JSON.stringify(metaHeader), ...dataLines].join('\n') + '\n';
          fs.writeFileSync(filePath, fileContent, 'utf-8');

          // Act: retrieve history
          const history = getHistory(roomId);

          // Assert: history contains exactly the valid messages (in order)
          expect(history.length).toBe(validMessages.length);
          for (let i = 0; i < validMessages.length; i++) {
            expect(history[i]).toEqual(validMessages[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: text-chat, Property 11: アーカイブ処理の完全性
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 *
 * 任意のアクティブなChat_Log_Fileに対して、archiveLogを実行すると、
 * (1) archive/ディレクトリに.jsonl.gzファイルが作成され、
 * (2) そのgzipを展開した内容が元のファイルと等価であり、
 * (3) 元のChat_Log_Fileは削除される。
 */

import zlib from 'zlib';
import { archiveLog } from '../chatLogManager';

const ARCHIVE_DIR = path.join(__dirname, '..', '..', 'chat-logs', 'archive');

const roomIdArbProp11 = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/).map((s) => `__test_prop11_${s}`);

describe('Property 11: アーカイブ処理の完全性', () => {
  const cleanupPaths: string[] = [];

  afterEach(() => {
    for (const p of cleanupPaths) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore cleanup errors
      }
    }
    cleanupPaths.length = 0;
  });

  it('archiveLog後にarchive/に.jsonl.gzが作成され、展開内容が元と等価で、元ファイルが削除されること', () => {
    fc.assert(
      fc.property(
        roomIdArbProp11,
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        (roomId: string, messages: ChatMessage[]) => {
          const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

          // Ensure clean state
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          // Ensure directories exist
          fs.mkdirSync(CHAT_LOGS_DIR, { recursive: true });
          fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

          // Write messages via appendMessage (creates meta header + messages)
          for (const msg of messages) {
            appendMessage(roomId, msg);
          }

          // Read the original file content before archiving
          const originalContent = fs.readFileSync(filePath);

          // Build expected archive path
          const now = new Date();
          const dateStr =
            String(now.getFullYear()) +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
          const archivePath = path.join(ARCHIVE_DIR, `${roomId}.${dateStr}.jsonl.gz`);

          // Track for cleanup
          cleanupPaths.push(filePath);
          cleanupPaths.push(archivePath);

          // Act: archive the log
          archiveLog(roomId);

          // Assert (a): archive file exists
          expect(fs.existsSync(archivePath)).toBe(true);

          // Assert (b): gunzip the archive and verify content matches original
          const compressed = fs.readFileSync(archivePath);
          const decompressed = zlib.gunzipSync(compressed);
          expect(decompressed.equals(originalContent)).toBe(true);

          // Assert (c): original .jsonl file is deleted
          expect(fs.existsSync(filePath)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

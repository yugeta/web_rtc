import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// --- Interfaces ---

export interface ChatMessage {
  userName: string;
  message: string;
  timestamp: number;
}

export interface MetaHeader {
  _meta: 'header';
  roomId: string;
  createdAt: number;
}

// --- Directory paths ---

const CHAT_LOGS_DIR = path.join(__dirname, '..', 'chat-logs');
const ARCHIVE_DIR = path.join(CHAT_LOGS_DIR, 'archive');

// --- Directory management ---

export function ensureDirectories(): void {
  fs.mkdirSync(CHAT_LOGS_DIR, { recursive: true });
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// --- Serialization / Parsing ---

export function serializeMessage(message: ChatMessage): string {
  return JSON.stringify(message);
}

export function parseMessage(line: string): ChatMessage | null {
  try {
    const parsed = JSON.parse(line);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.userName === 'string' &&
      typeof parsed.message === 'string' &&
      typeof parsed.timestamp === 'number'
    ) {
      return { userName: parsed.userName, message: parsed.message, timestamp: parsed.timestamp };
    }
    console.warn('Invalid ChatMessage format:', line);
    return null;
  } catch {
    console.warn('Failed to parse JSON line:', line);
    return null;
  }
}

// --- Message persistence ---

// --- History retrieval ---

export function getHistory(roomId: string): ChatMessage[] {
  const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.length > 0);
  const messages: ChatMessage[] = [];

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.warn('Failed to parse JSON line:', line);
      continue;
    }

    // Skip MetaHeader lines
    if (typeof parsed === 'object' && parsed !== null && '_meta' in parsed) {
      continue;
    }

    const msg = parseMessage(line);
    if (msg !== null) {
      messages.push(msg);
    }
  }

  return messages;
}

// --- Message persistence ---

export function appendMessage(roomId: string, message: ChatMessage): void {
  try {
    const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);
    const serialized = serializeMessage(message);

    if (!fs.existsSync(filePath)) {
      const metaHeader: MetaHeader = {
        _meta: 'header',
        roomId,
        createdAt: Date.now(),
      };
      fs.writeFileSync(filePath, JSON.stringify(metaHeader) + '\n');
    }

    fs.appendFileSync(filePath, serialized + '\n');
  } catch (error) {
    console.error('Failed to append message:', error);
  }
}

// --- Archive ---

export function archiveLog(roomId: string): void {
  const filePath = path.join(CHAT_LOGS_DIR, `${roomId}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath);
    const compressed = zlib.gzipSync(content);

    const now = new Date();
    const dateStr =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const archivePath = path.join(ARCHIVE_DIR, `${roomId}.${dateStr}.jsonl.gz`);
    fs.writeFileSync(archivePath, compressed);
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Failed to archive log:', error);
  }
}

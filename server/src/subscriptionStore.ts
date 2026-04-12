import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SubscriptionRecord {
  userSub: string;
  deviceId: string;
  subscription: PushSubscriptionData;
  createdAt: string;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'subscriptions.json');

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function hashEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export function load(): SubscriptionRecord[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content) as SubscriptionRecord[];
}

function persist(records: SubscriptionRecord[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function save(record: SubscriptionRecord): void {
  const records = load();
  const existing = records.findIndex(
    (r) => r.userSub === record.userSub && r.deviceId === record.deviceId
  );
  if (existing !== -1) {
    records[existing] = record;
  } else {
    records.push(record);
  }
  persist(records);
}

export function findByUser(userSub: string): SubscriptionRecord[] {
  return load().filter((r) => r.userSub === userSub);
}

export function remove(userSub: string, deviceId: string): boolean {
  const records = load();
  const index = records.findIndex(
    (r) => r.userSub === userSub && r.deviceId === deviceId
  );
  if (index === -1) return false;
  records.splice(index, 1);
  persist(records);
  return true;
}

export function removeByUser(userSub: string): void {
  const records = load();
  const filtered = records.filter((r) => r.userSub !== userSub);
  persist(filtered);
}

export function removeByEndpoint(endpoint: string): void {
  const deviceId = hashEndpoint(endpoint);
  const records = load();
  const filtered = records.filter((r) => r.deviceId !== deviceId);
  persist(filtered);
}

import fs from 'fs';
import path from 'path';

export interface UserData {
  sub: string;
  name: string;
  email: string;
  picture: string;
  registeredAt: string;
  lastLoginAt: string;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function load(): UserData[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content) as UserData[];
}

export function save(users: UserData[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export function findBySub(sub: string): UserData | undefined {
  return load().find(u => u.sub === sub);
}

export function upsert(user: { sub: string; name: string; email: string; picture: string }): UserData {
  const users = load();
  const now = new Date().toISOString();
  const existing = users.find(u => u.sub === user.sub);

  if (existing) {
    existing.name = user.name;
    existing.email = user.email;
    existing.picture = user.picture;
    existing.lastLoginAt = now;
    save(users);
    return existing;
  }

  const newUser: UserData = {
    ...user,
    registeredAt: now,
    lastLoginAt: now,
  };
  users.push(newUser);
  save(users);
  return newUser;
}

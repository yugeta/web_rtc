import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface RoomData {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  settings: Record<string, unknown>;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function load(): RoomData[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content) as RoomData[];
}

export function save(rooms: RoomData[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
}

export function create(room: Omit<RoomData, 'id' | 'createdAt'>): RoomData {
  const rooms = load();
  const newRoom: RoomData = {
    ...room,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  rooms.push(newRoom);
  save(rooms);
  return newRoom;
}

export function findByOwner(ownerId: string): RoomData[] {
  const rooms = load();
  return rooms.filter((r) => r.ownerId === ownerId);
}

export function findById(id: string): RoomData | undefined {
  const rooms = load();
  return rooms.find((r) => r.id === id);
}

export function remove(id: string): boolean {
  const rooms = load();
  const index = rooms.findIndex((r) => r.id === id);
  if (index === -1) {
    return false;
  }
  rooms.splice(index, 1);
  save(rooms);
  return true;
}

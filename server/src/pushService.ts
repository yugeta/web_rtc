import webpush from 'web-push';
import * as subscriptionStore from './subscriptionStore';
import type { PushSubscriptionData } from './subscriptionStore';

// --- Types ---

export interface PushPayload {
  type: 'invite' | 'chat' | 'join';
  title: string;
  body: string;
  roomId: string;
  tag?: string;
}

// --- VAPID initialization ---

const vapidPublicKey = process.env['VAPID_PUBLIC_KEY'];
const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY'];
const vapidSubject = process.env['VAPID_SUBJECT'];

export const pushEnabled = !!(vapidPublicKey && vapidPrivateKey && vapidSubject);

if (pushEnabled) {
  webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);
}

// --- Visibility state (set by index.ts in task 3.2) ---

let userVisibility: Map<string, 'foreground' | 'background'> = new Map();

export function setUserVisibility(map: Map<string, 'foreground' | 'background'>): void {
  userVisibility = map;
}

export function getUserVisibility(): Map<string, 'foreground' | 'background'> {
  return userVisibility;
}

// --- Room participants (set by index.ts in task 3.2) ---
// Maps roomId -> Set of userSub values currently in the room

let roomParticipants: Map<string, Set<string>> = new Map();

export function setRoomParticipants(map: Map<string, Set<string>>): void {
  roomParticipants = map;
}

export function getRoomParticipants(): Map<string, Set<string>> {
  return roomParticipants;
}

// --- Payload builders ---

export function buildInvitePayload(roomId: string, roomName: string, inviterName: string): PushPayload {
  return {
    type: 'invite',
    title: `${inviterName} から ${roomName} への招待`,
    body: `${inviterName} さんがルーム「${roomName}」に招待しています`,
    roomId,
    tag: `invite-${roomId}`,
  };
}

export function buildChatPayload(roomId: string, roomName: string, senderName: string, message: string): PushPayload {
  const truncated = message.length > 100 ? message.slice(0, 100) + '…' : message;
  return {
    type: 'chat',
    title: `${roomName} - 新しいメッセージ`,
    body: `${senderName}: ${truncated}`,
    roomId,
    tag: `chat-${roomId}`,
  };
}

export function buildJoinPayload(roomId: string, roomName: string, userName: string): PushPayload {
  return {
    type: 'join',
    title: `${userName} が ${roomName} に参加しました`,
    body: `${userName} さんがルーム「${roomName}」に入室しました`,
    roomId,
    tag: `join-${roomId}`,
  };
}

// --- Send helpers ---

async function trySend(sub: PushSubscriptionData, payload: string): Promise<boolean> {
  try {
    await webpush.sendNotification(sub, payload);
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410) {
      // Subscription expired — remove it
      subscriptionStore.removeByEndpoint(sub.endpoint);
    }
    return false;
  }
}

/**
 * Send a push notification to all devices registered for a given user.
 */
export async function sendNotification(userSub: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;

  const records = subscriptionStore.findByUser(userSub);
  const payloadStr = JSON.stringify(payload);

  await Promise.all(records.map((r) => trySend(r.subscription, payloadStr)));
}

/**
 * Send a push notification to all background participants in a room,
 * excluding the specified user (typically the event originator).
 */
export async function sendToRoom(
  roomId: string,
  payload: PushPayload,
  excludeUserSub?: string,
): Promise<void> {
  if (!pushEnabled) return;

  const participants = roomParticipants.get(roomId);
  if (!participants) return;

  const payloadStr = JSON.stringify(payload);

  const sends: Promise<boolean>[] = [];

  for (const userSub of participants) {
    // Skip the event originator
    if (excludeUserSub && userSub === excludeUserSub) continue;

    // Only send to users in background state for this room
    const visKey = `${userSub}:${roomId}`;
    const state = userVisibility.get(visKey);
    if (state !== 'background') continue;

    const records = subscriptionStore.findByUser(userSub);
    for (const r of records) {
      sends.push(trySend(r.subscription, payloadStr));
    }
  }

  await Promise.all(sends);
}

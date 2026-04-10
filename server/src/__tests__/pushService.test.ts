import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildInvitePayload,
  buildChatPayload,
  buildJoinPayload,
} from '../pushService';

describe('buildInvitePayload', () => {
  it('returns correct payload with room name and inviter name', () => {
    const payload = buildInvitePayload('room-1', 'テストルーム', '田中');
    expect(payload.type).toBe('invite');
    expect(payload.title).toContain('田中');
    expect(payload.title).toContain('テストルーム');
    expect(payload.body).toContain('田中');
    expect(payload.body).toContain('テストルーム');
    expect(payload.roomId).toBe('room-1');
    expect(payload.tag).toBe('invite-room-1');
  });
});

describe('buildChatPayload', () => {
  it('returns correct payload with sender name and message', () => {
    const payload = buildChatPayload('room-1', 'テストルーム', '佐藤', 'こんにちは');
    expect(payload.type).toBe('chat');
    expect(payload.body).toContain('佐藤');
    expect(payload.body).toContain('こんにちは');
    expect(payload.roomId).toBe('room-1');
    expect(payload.tag).toBe('chat-room-1');
  });

  it('truncates message to 100 characters', () => {
    const longMessage = 'あ'.repeat(150);
    const payload = buildChatPayload('room-1', 'ルーム', '佐藤', longMessage);
    // body = "佐藤: " + truncated message
    // The message portion should be 100 chars + ellipsis
    const messageInBody = payload.body.split(': ').slice(1).join(': ');
    expect(messageInBody.length).toBeLessThanOrEqual(101); // 100 chars + '…'
    expect(messageInBody).toContain('…');
  });

  it('does not truncate message of exactly 100 characters', () => {
    const exactMessage = 'a'.repeat(100);
    const payload = buildChatPayload('room-1', 'ルーム', '佐藤', exactMessage);
    expect(payload.body).toContain(exactMessage);
    expect(payload.body).not.toContain('…');
  });
});

describe('buildJoinPayload', () => {
  it('returns correct payload with user name and room name', () => {
    const payload = buildJoinPayload('room-1', 'テストルーム', '鈴木');
    expect(payload.type).toBe('join');
    expect(payload.title).toContain('鈴木');
    expect(payload.title).toContain('テストルーム');
    expect(payload.body).toContain('鈴木');
    expect(payload.body).toContain('テストルーム');
    expect(payload.roomId).toBe('room-1');
    expect(payload.tag).toBe('join-room-1');
  });
});

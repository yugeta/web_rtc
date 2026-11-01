import { describe, it, expect, afterEach } from 'vitest';
import { buildEnvStatusReport } from '../adminEnvStatus';

describe('buildEnvStatusReport', () => {
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.JWT_SECRET;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    delete process.env.EXTERNAL_IP;
    delete process.env.TURN_REALM;
    delete process.env.TURN_USERNAME;
    delete process.env.TURN_PASSWORD;
  });

  it('reports missing required environment variables', () => {
    const report = buildEnvStatusReport(process.env);

    expect(report.missing).toContain('GOOGLE_CLIENT_ID');
    expect(report.missing).toContain('JWT_SECRET');
    expect(report.ok).not.toContain('GOOGLE_CLIENT_ID');
    expect(report.ok).not.toContain('JWT_SECRET');
  });

  it('marks configured variables as ok', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.JWT_SECRET = 'jwt-secret';
    process.env.VAPID_PUBLIC_KEY = 'vapid-public';
    process.env.VAPID_PRIVATE_KEY = 'vapid-private';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    process.env.EXTERNAL_IP = '203.0.113.10';
    process.env.TURN_REALM = 'stun.example.com';
    process.env.TURN_USERNAME = 'mynt';
    process.env.TURN_PASSWORD = 'secret';

    const report = buildEnvStatusReport(process.env);

    expect(report.ok).toContain('GOOGLE_CLIENT_ID');
    expect(report.ok).toContain('JWT_SECRET');
    expect(report.ok).toContain('VAPID_PUBLIC_KEY');
    expect(report.ok).toContain('VAPID_PRIVATE_KEY');
    expect(report.ok).toContain('VAPID_SUBJECT');
    expect(report.ok).toContain('EXTERNAL_IP');
    expect(report.missing).not.toContain('GOOGLE_CLIENT_ID');
    expect(report.missing).not.toContain('JWT_SECRET');
  });
});

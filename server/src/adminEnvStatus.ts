export type EnvStatusReport = {
  ok: string[];
  missing: string[];
  warning: string[];
};

const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'JWT_SECRET'] as const;
const optionalEnvVars = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'EXTERNAL_IP', 'TURN_REALM', 'TURN_USERNAME', 'TURN_PASSWORD'] as const;

export function buildEnvStatusReport(env: NodeJS.ProcessEnv): EnvStatusReport {
  const ok: string[] = [];
  const missing: string[] = [];
  const warning: string[] = [];

  for (const key of requiredEnvVars) {
    if (env[key] && env[key]!.trim() !== '') {
      ok.push(key);
    } else {
      missing.push(key);
    }
  }

  for (const key of optionalEnvVars) {
    if (env[key] && env[key]!.trim() !== '') {
      ok.push(key);
    } else {
      warning.push(key);
    }
  }

  return { ok, missing, warning };
}

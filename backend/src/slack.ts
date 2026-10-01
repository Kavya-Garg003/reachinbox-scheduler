import { config } from './config';
import { exec, query } from './db';
import { log } from './logger';

export const slackRedirectUri = () => `${config.appUrl}/api/slack/callback`;

export function slackAuthorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: 'incoming-webhook',
    redirect_uri: slackRedirectUri(),
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${p}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  team?: { name: string };
  incoming_webhook?: { url: string; channel: string };
}

export async function completeSlackOAuth(userId: number, code: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      redirect_uri: slackRedirectUri(),
    }),
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok || !data.incoming_webhook) throw new Error(`Slack OAuth failed: ${data.error ?? 'no webhook returned'}`);
  await exec(
    `INSERT INTO slack_connections (user_id, team_name, channel, webhook_url) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE team_name=VALUES(team_name), channel=VALUES(channel), webhook_url=VALUES(webhook_url), connected_at=NOW()`,
    [userId, data.team?.name ?? null, data.incoming_webhook.channel, data.incoming_webhook.url],
  );
}

export const getSlackConnection = async (userId: number) =>
  (await query<{ team_name: string; channel: string; webhook_url: string }>(
    'SELECT team_name, channel, webhook_url FROM slack_connections WHERE user_id = ?',
    [userId],
  ))[0];

export const disconnectSlack = (userId: number) => exec('DELETE FROM slack_connections WHERE user_id = ?', [userId]);

/** Sends a live Slack message. Silently does nothing if the user hasn't connected Slack. */
export async function sendSlack(userId: number, text: string): Promise<boolean> {
  const conn = await getSlackConnection(userId);
  if (!conn) return false;
  try {
    const res = await fetch(conn.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      log.warn('Slack webhook returned', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    log.warn('Slack send failed:', (e as Error).message);
    return false;
  }
}

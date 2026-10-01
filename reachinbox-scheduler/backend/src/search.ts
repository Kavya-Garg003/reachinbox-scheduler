import { Client } from '@elastic/elasticsearch';
import { config } from './config';
import { EmailRow, getEmail } from './emailRepo';
import { log } from './logger';

const INDEX = 'emails';
export const es = new Client({
  node: config.elasticUrl,
  auth: config.elasticApiKey
    ? { apiKey: config.elasticApiKey }
    : config.elasticUser
      ? { username: config.elasticUser, password: config.elasticPass }
      : undefined,
  requestTimeout: 5000,
  maxRetries: 1,
});
let available = false;
export const esAvailable = () => available;

export async function initSearch() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            userId: { type: 'keyword' },
            status: { type: 'keyword' },
            toEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
    }
    available = true;
    log.info('Elasticsearch ready');
  } catch (e) {
    available = false;
    log.warn('Elasticsearch unavailable, falling back to SQL search:', (e as Error).message);
  }
}

const toDoc = (r: EmailRow) => ({
  userId: String(r.user_id),
  status: r.status,
  toEmail: r.to_email,
  subject: r.subject,
  body: r.body.replace(/<[^>]+>/g, ' '),
  scheduledAt: r.scheduled_at,
  sentAt: r.sent_at,
});

export async function indexEmails(rows: EmailRow[]) {
  if (!available || rows.length === 0) return;
  try {
    const ops = rows.flatMap((r) => [{ index: { _index: INDEX, _id: String(r.id) } }, toDoc(r)]);
    const res = await es.bulk({ operations: ops, refresh: false });
    if (res.errors) log.warn('some emails failed to index');
  } catch (e) {
    log.warn('ES bulk index failed:', (e as Error).message);
  }
}

/** Re-index one email after a status change. Never throws. */
export async function reindex(emailId: number) {
  try {
    const row = await getEmail(emailId);
    if (row) await indexEmails([row]);
  } catch (e) {
    log.warn('reindex failed', (e as Error).message);
  }
}

/** Returns matching email ids (already filtered by user + status group), or null if ES is unusable. */
export async function searchIds(userId: number, q: string, statuses: string[], size: number, from: number) {
  if (!available) return null;
  try {
    const res = await es.search({
      index: INDEX,
      from,
      size,
      track_total_hits: true,
      query: {
        bool: {
          filter: [{ term: { userId: String(userId) } }, { terms: { status: statuses } }],
          must: [
            {
              bool: {
                should: [
                  { multi_match: { query: q, fields: ['toEmail^3', 'subject^2', 'body'], fuzziness: 'AUTO' } },
                  { wildcard: { 'toEmail.keyword': { value: `*${q.toLowerCase()}*` } } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    });
    const total = typeof res.hits.total === 'number' ? res.hits.total : res.hits.total?.value ?? 0;
    return { ids: res.hits.hits.map((h) => Number(h._id)), total };
  } catch (e) {
    log.warn('ES search failed:', (e as Error).message);
    return null;
  }
}

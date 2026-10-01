import { redis } from './redis';

const HOUR = 3600_000;

// Atomic "take a slot if under the limit" so concurrent workers/instances can't overshoot.
const CONSUME_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if c > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1`;

export interface Slot {
  allowed: boolean;
  window: number; // hour-window index
  nextWindowStart: number; // epoch ms when the next window opens
  release: () => Promise<void>; // give the slot back (e.g. SMTP failed)
}

export async function consumeSlot(senderId: number, limitPerHour: number, now = Date.now()): Promise<Slot> {
  const window = Math.floor(now / HOUR);
  const key = `rl:sender:${senderId}:${window}`;
  const ok = (await redis.eval(CONSUME_LUA, 1, key, limitPerHour, 2 * 3600)) === 1;
  return {
    allowed: ok,
    window,
    nextWindowStart: (window + 1) * HOUR,
    release: async () => {
      if (ok) await redis.decr(key);
    },
  };
}

/** True only for the first caller per sender+window (so Slack is pinged once, not 1000 times). */
export async function firstHitInWindow(senderId: number, window: number): Promise<boolean> {
  return (await redis.set(`rl:notified:${senderId}:${window}`, '1', 'EX', 2 * 3600, 'NX')) === 'OK';
}

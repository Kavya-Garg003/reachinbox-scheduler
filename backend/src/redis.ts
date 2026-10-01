import IORedis from 'ioredis';
import { config } from './config';

// BullMQ requires maxRetriesPerRequest: null. Workers need their OWN connection (blocking commands).
export const makeRedis = () => new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
export const redis = makeRedis();

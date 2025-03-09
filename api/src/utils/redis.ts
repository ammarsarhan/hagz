import Redis from "ioredis";

const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const host = process.env.REDIS_HOSTNAME || '127.0.0.1';

const redis = new Redis(port, host, { maxRetriesPerRequest: null });
export default redis;
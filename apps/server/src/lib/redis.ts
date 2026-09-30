import { Redis } from "ioredis";
import { env } from "@/config/env";

// family: 0 resolves both IPv4 and IPv6; Railway's private network can be IPv6 only.

// BullMQ only. This instance must run with maxmemory-policy noeviction.
export const queueConnection = new Redis(env.QUEUE_URL, { family: 0, maxRetriesPerRequest: null });

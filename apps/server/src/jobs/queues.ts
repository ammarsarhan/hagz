import { Queue, type QueueOptions } from "bullmq";
import { queueConnection } from "@/lib/redis";

export const createQueue = <Data>(name: string, options?: Omit<QueueOptions, "connection">) =>
  new Queue<Data>(name, { ...options, connection: queueConnection });

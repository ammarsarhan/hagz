import { AsyncLocalStorage } from "node:async_hooks";

// Follows one request (or one job) through every await, so logs and jobs can carry its id
// without passing it by hand.
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

export const currentContext = (): RequestContext | undefined => storage.getStore();

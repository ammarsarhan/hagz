// The platform itself: whether the server, worker, database and Redis are running.
export { startWorkerHeartbeat } from "./application/heartbeat";
export { startStatusSampler } from "./application/history";
export { systemRoutes } from "./http/routes";

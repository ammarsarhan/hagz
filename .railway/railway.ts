import { defineRailway, github, project, redis, service, volume } from "railway/iac";

// Railway Infrastructure as Code. Preview with `railway config plan`, apply with `railway config apply`.
// The same file describes every environment: staging deploys the staging branch, production deploys main.

const REPO = "ammarsarhan/hagz";
const REGION = "europe-west4-drams3a"; // EU West, closest to Neon (aws-eu-central-1)

// Anything that can change the server image triggers a server deploy; web and mobile changes don't.
const SERVER_WATCH = [
  "apps/server/**",
  "packages/**",
  "tooling/**",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".npmrc",
];

// Railway Redis template command, plus our flags.
const redisStart = (flags: string) =>
  `/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH ${flags}"`;

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";

  // BullMQ needs keys to never be evicted.
  const queue = redis("queue", { region: REGION });
  queue.deploy = { startCommand: redisStart("--maxmemory-policy noeviction --appendonly yes") };
  queue.networking = { privateNetworkEndpoint: "queue" };

  // Cache only: evicts least-recently-used keys when full.
  const cache = redis("cache", { region: REGION });
  cache.deploy = { startCommand: redisStart("--maxmemory 256mb --maxmemory-policy allkeys-lru") };
  cache.networking = { privateNetworkEndpoint: "cache" };

  const queueVolume = volume("queue-volume", { region: REGION, sizeMB: 500 });
  const cacheVolume = volume("redis-volume", { region: REGION, sizeMB: 500 });

  // One image, two processes. Neon URLs are shared variables set per environment, never stored here.
  const server = (name: string, deploy: { start: string; preDeploy?: string; healthcheck?: string }) =>
    service(name, {
      source: github(REPO, { branch: production ? "main" : "staging", checkSuites: true }),
      build: { builder: "DOCKERFILE", dockerfilePath: "apps/server/Dockerfile", watchPatterns: SERVER_WATCH },
      ...deploy,
      healthcheckTimeout: deploy.healthcheck ? 60 : undefined,
      replicas: { [REGION]: 1 },
      env: {
        APP_ENV: production ? "production" : "staging",
        NODE_ENV: "production",
        DATABASE_URL: ctx.shared.DATABASE_URL,
        ...(deploy.preDeploy ? { DIRECT_DATABASE_URL: ctx.shared.DIRECT_DATABASE_URL } : {}),
        QUEUE_URL: queue.env.REDIS_URL,
        CACHE_URL: cache.env.REDIS_URL,
      },
    });

  const api = server("api", {
    start: "node dist/app.js",
    preDeploy: "/app/node_modules/.bin/prisma migrate deploy",
    healthcheck: "/health",
  });

  const worker = server("worker", { start: "node dist/worker.js" });

  return project("hagz", {
    resources: [api, worker, queue, cache, queueVolume, cacheVolume],
  });
});

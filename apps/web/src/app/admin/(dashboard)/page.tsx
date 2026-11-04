"use client";

import { IconActivityHeartbeat } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

// Home: system status. The cards (server, worker, web, database, both Redis) need the admin status
// endpoint and the worker's heartbeat, which come next.
export default function AdminHome() {
  return (
    <EmptySection
      title="Home"
      subtitle="How every part of the platform is running right now."
      icon={IconActivityHeartbeat}
      phase="the next PR"
      description="Uptime and versions for the server, worker and web app, and whether the database and both Redis instances are answering."
    />
  );
}

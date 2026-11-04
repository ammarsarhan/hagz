"use client";

import { IconShieldCheck } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

export default function AdminModeration() {
  return (
    <EmptySection
      title="Moderation"
      subtitle="Reviews, reports and what Hagz sends to people."
      icon={IconShieldCheck}
      phase="Phase 7"
      description="Hiding reviews, removing unfair no-show reports, and the notification delivery logs."
    />
  );
}

"use client";

import { IconLifebuoy } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

export default function AdminSupport() {
  return (
    <EmptySection
      title="Support"
      icon={IconLifebuoy}
      phase="Phase 2.8"
      description="Find customers and staff by phone, suspend or reactivate them, and reset an owner’s password after checking who they are."
    />
  );
}

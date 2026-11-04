"use client";

import { IconBuildingStadium } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

export default function AdminVenues() {
  return (
    <EmptySection
      title="Venues"
      icon={IconBuildingStadium}
      phase="Phase 2"
      description="Every venue in any status, with filters (Submitted is the review queue). Opening one leads to its own dashboard."
    />
  );
}

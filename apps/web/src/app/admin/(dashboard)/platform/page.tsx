"use client";

import { IconWorldCog } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

export default function AdminPlatform() {
  return (
    <EmptySection
      title="Platform"
      subtitle="Locations, amenities and the settings every venue shares."
      icon={IconWorldCog}
      phase="Phase 2.1"
      description="The location tree, amenity options, marketplaces and global settings."
    />
  );
}

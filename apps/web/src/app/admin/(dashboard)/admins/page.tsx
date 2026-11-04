"use client";

import { IconUserShield } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

// Admins: the list and invitations, waiting on the user's design (the API is ready:
// GET /v1/admin/list and the invitation routes).
export default function Admins() {
  return (
    <EmptySection
      title="Admins"
      icon={IconUserShield}
      phase="the next design"
      description="Everyone with access to Hagz Admin, open invitations, and inviting someone new."
    />
  );
}

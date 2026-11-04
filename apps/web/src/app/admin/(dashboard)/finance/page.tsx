"use client";

import { IconCash } from "@tabler/icons-react";
import { EmptySection } from "@/admin/empty-section";

export default function AdminFinance() {
  return (
    <EmptySection
      title="Finance"
      icon={IconCash}
      phase="Phases 5 and 6"
      description="Payout requests, payments to resolve, refunds and ledger adjustments."
    />
  );
}

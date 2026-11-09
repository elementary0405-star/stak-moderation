"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="CASES & RECORDS"
      title="Ban & Sanction Records"
      description="Review temporary and permanent sanctions, reasons, issuing staff and expiry details."
      access="trailModerator"
      backHref="/cases-records"
      backLabel="Back to Cases & Records"
    />
  );
}

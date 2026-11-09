"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="CASES & RECORDS"
      title="Moderation Cases"
      description="Review moderation cases and their recorded actions."
      access="trailModerator"
      backHref="/cases-records"
      backLabel="Back to Cases & Records"
    />
  );
}

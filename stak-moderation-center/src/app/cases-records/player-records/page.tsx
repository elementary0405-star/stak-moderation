"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="CASES & RECORDS"
      title="Player Records"
      description="Review player identity information and relevant moderation history."
      access="trailModerator"
      backHref="/cases-records"
      backLabel="Back to Cases & Records"
    />
  );
}

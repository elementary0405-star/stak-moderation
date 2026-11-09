"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="CONFIDENTIAL STAFF TOOL"
      title="Feedback Box"
      description="Send confidential feedback to the STAK Owner. Submissions will only be visible to the Owner."
      access="staff"
    />
  );
}

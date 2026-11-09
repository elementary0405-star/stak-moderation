"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="OWNER ONLY"
      title="Feedback Inbox"
      description="Review confidential messages submitted through the Staff Feedback Box."
      access="owner"
    />
  );
}

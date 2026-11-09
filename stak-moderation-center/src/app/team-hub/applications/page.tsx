"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="RECRUITMENT"
      title="Staff Applications"
      description="Review incoming staff applications and record acceptance or rejection decisions."
      access="staffManager"
    />
  );
}

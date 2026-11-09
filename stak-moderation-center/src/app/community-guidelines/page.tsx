"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function CommunityGuidelinesPage() {
  return (
    <PortalFeaturePage
      eyebrow="STAK COMMUNITY"
      title="Community Guidelines"
      description="Read the standards and rules that apply to all members of the STAK community."
      access="any"
      backHref="/dashboard"
      backLabel="Back to Overview"
      statusNote="The final community guidelines will be placed here after the current rules have been reviewed and approved for publication."
    />
  );
}

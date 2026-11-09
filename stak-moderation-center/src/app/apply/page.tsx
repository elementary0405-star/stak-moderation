"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function ApplyPage() {
  return (
    <PortalFeaturePage
      eyebrow="COMMUNITY OPPORTUNITIES"
      title="Apply"
      description="Find out about joining the STAK team and submit an application when recruitment is open."
      access="community"
      backHref="/dashboard"
      backLabel="Back to Overview"
      statusNote="The application form, application review workflow and Discord bot notifications will be connected here. No application can be submitted from this page yet."
    />
  );
}

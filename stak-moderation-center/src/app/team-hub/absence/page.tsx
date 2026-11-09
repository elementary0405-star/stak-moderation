"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="PERSONAL WORKSPACE"
      title="Absence Management"
      description="Submit an absence with a start date, end date and reason, and review your own absence history."
      access="staff"
    />
  );
}

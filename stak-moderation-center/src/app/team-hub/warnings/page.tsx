"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="STAFF RECORDS"
      title="Warnings & History"
      description="Review staff warnings and the documented history of team members."
      access="staffManager"
    />
  );
}

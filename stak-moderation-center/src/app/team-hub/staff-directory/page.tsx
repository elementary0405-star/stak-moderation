"use client";

import PortalFeaturePage from "@/components/PortalFeaturePage";

export default function Page() {
  return (
    <PortalFeaturePage
      eyebrow="MANAGEMENT TOOLS"
      title="Staff Directory"
      description="Review staff members, ranks, absence status and their individual staff records."
      access="staffManager"
    />
  );
}

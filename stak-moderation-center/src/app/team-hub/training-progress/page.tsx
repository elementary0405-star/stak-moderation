"use client";

import PortalShell from "@/components/PortalShell";
import AcademyManagementClient from "./academy-management-client";

export default function TrainingProgressPage() {
  return (
    <PortalShell access="staffManager">
      <AcademyManagementClient />
    </PortalShell>
  );
}

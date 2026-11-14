import PortalShell from "@/components/PortalShell";
import StaffRecordClient from "./staff-record-client";

export default async function StaffRecordPage({ params }: { params: Promise<{ discordUserId: string }> }) {
  const { discordUserId } = await params;
  return <PortalShell access="staffManager">{() => <StaffRecordClient discordUserId={discordUserId} />}</PortalShell>;
}

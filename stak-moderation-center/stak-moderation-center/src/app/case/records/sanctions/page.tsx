import AccessGate from "@/components/portal/AccessGate";import {SanctionsWorkspace} from "@/components/portal/RecordsWorkspace";
export default function SanctionsPage(){return <AccessGate minimumRole="trail-moderator"><SanctionsWorkspace/></AccessGate>}

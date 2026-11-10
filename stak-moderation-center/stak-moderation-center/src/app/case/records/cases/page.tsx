import AccessGate from "@/components/portal/AccessGate";import {CasesWorkspace} from "@/components/portal/RecordsWorkspace";
export default function CasesPage(){return <AccessGate minimumRole="trail-moderator"><CasesWorkspace/></AccessGate>}

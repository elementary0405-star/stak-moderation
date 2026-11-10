import AccessGate from "@/components/portal/AccessGate";import {PlayersWorkspace} from "@/components/portal/RecordsWorkspace";
export default function PlayerRecordsPage(){return <AccessGate minimumRole="trail-moderator"><PlayersWorkspace/></AccessGate>}

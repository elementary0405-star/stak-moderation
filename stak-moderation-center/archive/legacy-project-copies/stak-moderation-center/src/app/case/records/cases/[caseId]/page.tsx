"use client";
import {useParams} from "next/navigation";import AccessGate from "@/components/portal/AccessGate";import {CaseDetailWorkspace} from "@/components/portal/RecordsWorkspace";
export default function CaseDetailPage(){const params=useParams<{caseId:string}>();return <AccessGate minimumRole="trail-moderator"><CaseDetailWorkspace caseId={params.caseId}/></AccessGate>}

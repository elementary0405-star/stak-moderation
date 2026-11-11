import { requireUser, type StakRole } from "./auth";
export { json, errorResponse, readJson, newId, audit, db } from "./db";
export async function guard(request: Request, access: "any" | "staff" | "trailModerator" | "staffManager" | "owner" = "any") {
  return requireUser(request, access);
}
export function stringValue(value: unknown, max = 4000): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function nullableString(value: unknown, max = 1000): string | null { const s = stringValue(value, max); return s || null; }
export function isStaffRole(role: StakRole): boolean { return role !== "community-member"; }

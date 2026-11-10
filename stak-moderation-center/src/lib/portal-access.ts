import type { StakRole } from "./discord-roles";

/**
 * Rollen-Reihenfolge: Ein höherer Rang darf grundsätzlich auch Bereiche
 * niedrigerer Ränge betreten. Einzelne sensible Funktionen können zusätzlich
 * auf eine exakte Rolle (z. B. Owner) beschränkt werden.
 */
const ROLE_PRIORITY: StakRole[] = [
  "owner",
  "co-owner",
  "management",
  "staff-manager",
  "moderator",
  "trail-moderator",
  "community-member",
];

export type PortalAccess =
  | "any"
  | "staff"
  | "community"
  | "trailModerator"
  | "staffManager"
  | "owner";

export const ROLE_LABELS: Record<StakRole, string> = {
  owner: "OWNER",
  "co-owner": "CO-OWNER",
  management: "MANAGEMENT",
  "staff-manager": "STAFF MANAGER",
  moderator: "MODERATOR",
  "trail-moderator": "TRAIL-MODERATOR",
  "community-member": "COMMUNITY MEMBER",
};

export function isStaffRole(role: StakRole | null | undefined): boolean {
  return Boolean(role && role !== "community-member");
}

export function hasMinimumRole(
  role: StakRole | null | undefined,
  minimumRole: StakRole
): boolean {
  if (!role || role === "community-member") return false;

  const userPriority = ROLE_PRIORITY.indexOf(role);
  const minimumPriority = ROLE_PRIORITY.indexOf(minimumRole);

  return (
    userPriority !== -1 &&
    minimumPriority !== -1 &&
    userPriority <= minimumPriority
  );
}

export function hasPortalAccess(
  role: StakRole | null | undefined,
  access: PortalAccess
): boolean {
  switch (access) {
    case "any":
      return Boolean(role);

    case "staff":
      return isStaffRole(role);

    case "community":
      return role === "community-member";

    case "trailModerator":
      return hasMinimumRole(role, "trail-moderator");

    case "staffManager":
      return hasMinimumRole(role, "staff-manager");

    case "owner":
      return role === "owner";

    default:
      return false;
  }
}
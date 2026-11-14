import type { StakRole } from "./discord-roles";

export type PortalAccess =
  | "any"
  | "staff"
  | "community"
  | "trailModerator"
  | "staffManager"
  | "owner";

export type PortalPermission =
  | "applications.review"
  | "applications.configure"
  | "applications.publish"
  | "recruitment.manage"
  | "announcements.manage"
  | "training.manage"
  | "staff.directory.read"
  | "staff.records.manage"
  | "staff.warnings.manage"
  | "staff.feedback.manage"
  | "player.records.read"
  | "player.records.write"
  | "system.permissions";

export const ROLE_LABELS: Record<StakRole, string> = {
  owner: "OWNER",
  "co-owner": "CO-OWNER",
  management: "MANAGEMENT",
  "staff-manager": "STAFF MANAGER",
  moderator: "MODERATOR",
  "trail-moderator": "TRAIL MODERATOR",
  "community-member": "COMMUNITY MEMBER",
};

/*
 * Central default access matrix.
 *
 * The area defaults preserve the current portal behavior. Sensitive policy
 * publication, recruitment opening and system permission changes are Owner-only.
 * STAK can revise this single matrix after confirming its final role policy.
 */
const ROLE_AREAS: Record<StakRole, readonly PortalAccess[]> = {
  owner: ["any", "community", "staff", "trailModerator", "staffManager", "owner"],
  "co-owner": ["any", "community", "staff", "trailModerator", "staffManager"],
  management: ["any", "community", "staff", "trailModerator", "staffManager"],
  "staff-manager": ["any", "community", "staff", "trailModerator", "staffManager"],
  moderator: ["any", "community", "staff", "trailModerator"],
  "trail-moderator": ["any", "community", "staff", "trailModerator"],
  "community-member": ["any", "community"],
};

const MANAGEMENT_PERMISSIONS: readonly PortalPermission[] = [
  "applications.review",
  "applications.configure",
  "announcements.manage",
  "training.manage",
  "staff.directory.read",
  "staff.records.manage",
  "staff.warnings.manage",
];

const STAFF_PERMISSIONS: readonly PortalPermission[] = [
  "player.records.read",
  "player.records.write",
];

export const ROLE_PERMISSIONS: Record<StakRole, readonly PortalPermission[]> = {
  owner: [
    ...MANAGEMENT_PERMISSIONS,
    ...STAFF_PERMISSIONS,
    "applications.publish",
    "recruitment.manage",
    "staff.feedback.manage",
    "system.permissions",
  ],
  "co-owner": [
    ...MANAGEMENT_PERMISSIONS,
    ...STAFF_PERMISSIONS,
  ],
  management: [
    ...MANAGEMENT_PERMISSIONS,
    ...STAFF_PERMISSIONS,
  ],
  "staff-manager": [
    ...MANAGEMENT_PERMISSIONS,
    ...STAFF_PERMISSIONS,
  ],
  moderator: [...STAFF_PERMISSIONS],
  "trail-moderator": [...STAFF_PERMISSIONS],
  "community-member": [],
};

export function isStaffRole(role: StakRole | null | undefined): boolean {
  return Boolean(role && role !== "community-member");
}

export function hasMinimumRole(
  role: StakRole | null | undefined,
  minimumRole: StakRole,
): boolean {
  const roleOrder: StakRole[] = [
    "owner",
    "co-owner",
    "management",
    "staff-manager",
    "moderator",
    "trail-moderator",
    "community-member",
  ];
  if (!role || role === "community-member") return false;
  const current = roleOrder.indexOf(role);
  const minimum = roleOrder.indexOf(minimumRole);
  return current >= 0 && minimum >= 0 && current <= minimum;
}

export function hasPortalAccess(
  role: StakRole | null | undefined,
  access: PortalAccess,
): boolean {
  return Boolean(role && ROLE_AREAS[role]?.includes(access));
}

export function hasPermission(
  role: StakRole | null | undefined,
  permission: PortalPermission,
): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}

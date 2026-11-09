export const STAK_DISCORD = {
  guildId: "1444719969773424713",

  roles: {
    owner: "1447207574582591560",
    coOwner: "1455529532227321857",
    management: "1458041990406082623",
    staffManager: "1455529458835656755",
    moderator: "1455529588737446031",
    trailModerator: "1479577845599572150",
    communityMember: "1450081814055096392",
  },
} as const;

export type StakRole =
  | "owner"
  | "co-owner"
  | "management"
  | "staff-manager"
  | "moderator"
  | "trail-moderator"
  | "community-member";

const ROLE_PRIORITY: {
  id: string;
  role: StakRole;
}[] = [
  {
    id: STAK_DISCORD.roles.owner,
    role: "owner",
  },
  {
    id: STAK_DISCORD.roles.coOwner,
    role: "co-owner",
  },
  {
    id: STAK_DISCORD.roles.management,
    role: "management",
  },
  {
    id: STAK_DISCORD.roles.staffManager,
    role: "staff-manager",
  },
  {
    id: STAK_DISCORD.roles.moderator,
    role: "moderator",
  },
  {
    id: STAK_DISCORD.roles.trailModerator,
    role: "trail-moderator",
  },
  {
    id: STAK_DISCORD.roles.communityMember,
    role: "community-member",
  },
];

export function getHighestStakRole(
  discordRoleIds: string[],
  isBot = false
): StakRole | null {
  if (isBot) {
    return null;
  }

  for (const entry of ROLE_PRIORITY) {
    if (discordRoleIds.includes(entry.id)) {
      return entry.role;
    }
  }

  return null;
}
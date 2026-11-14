export type PublicPolicyAcknowledgement = {
  key: string;
  label: string;
  explanation: string;
  isRequired: boolean;
  type: string;
  sortOrder: number;
};

const INTERNAL_ONLY_ACKNOWLEDGEMENTS = new Set(["staff_handbook", "server_rules"]);

export function getPublicPolicyAcknowledgements<T extends { key: string; type: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.type === "policy" && !INTERNAL_ONLY_ACKNOWLEDGEMENTS.has(row.key));
}

export function isPrivacyNoticeReady(notice: string | null | undefined): boolean {
  const normalized = notice?.trim() ?? "";
  if (normalized.length < 80) return false;
  return !/(\[[^\]]+\]|\bDRAFT\b|NOT READY FOR PUBLICATION|REPLACE EVERY|\bTBD\b)/i.test(normalized);
}

export async function hashPrivacyNotice(notice: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(notice.trim()));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

"use client";

import { useCallback, useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import styles from "./staff-directory.module.css";

type StaffMember = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  role: string;
  staffStatus: string;
  joinedAt: string | null;
  absenceId: string | null;
  absenceStart: string | null;
  absenceReturn: string | null;
  absenceStatus: string | null;
  warningCount: number;
};

type DirectoryResponse = {
  members: StaffMember[];
  total: number;
  active: number;
  absent: number;
  inactive: number;
};

type ApiError = {
  error?: string;
};

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: "Owner",
    "co-owner": "Co-Owner",
    management: "Management",
    "staff-manager": "Staff Manager",
    moderator: "Moderator",
    "trail-moderator": "Trial Moderator",
  };

  return labels[role] ?? role;
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorData = data as ApiError | null;

    throw new Error(
      errorData?.error || "Something went wrong.",
    );
  }

  return data as T;
}

function getMemberStatus(member: StaffMember): {
  label: string;
  className: string;
} {
  if (member.absenceId) {
    return {
      label: "Absent",
      className: styles.absent,
    };
  }

  if (member.staffStatus === "inactive") {
    return {
      label: "Inactive",
      className: styles.inactive,
    };
  }

  return {
    label: "Active",
    className: styles.active,
  };
}

function StaffDirectoryContent() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff/directory", {
        cache: "no-store",
      });

      const data = await readResponse<DirectoryResponse>(response);

      setMembers(data.members ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the staff directory.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDirectory(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDirectory]);

  const filteredMembers = members.filter((member) => {
    const searchValue = search.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      member.username.toLowerCase().includes(searchValue) ||
      (member.globalName ?? "").toLowerCase().includes(searchValue) ||
      member.discordUserId.includes(searchValue) ||
      roleLabel(member.role).toLowerCase().includes(searchValue);

    const status = getMemberStatus(member).label.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = members.filter(
    (member) =>
      member.staffStatus === "active" && !member.absenceId,
  ).length;

  const absentCount = members.filter(
    (member) => Boolean(member.absenceId),
  ).length;

  const inactiveCount = members.filter(
    (member) => member.staffStatus === "inactive",
  ).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>TEAM HUB</span>
          <h1>Staff Directory</h1>
          <p>
            Overview of staff members, their current availability
            and staff information.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void loadDirectory()}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <section className={styles.stats}>
        <article className={styles.statCard}>
          <span>Total Staff</span>
          <strong>{members.length}</strong>
        </article>

        <article className={styles.statCard}>
          <span>Active</span>
          <strong className={styles.activeText}>
            {activeCount}
          </strong>
        </article>

        <article className={styles.statCard}>
          <span>Currently Absent</span>
          <strong className={styles.absentText}>
            {absentCount}
          </strong>
        </article>

        <article className={styles.statCard}>
          <span>Inactive</span>
          <strong className={styles.inactiveText}>
            {inactiveCount}
          </strong>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff name, Discord ID or rank..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="absent">Absent</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {loading ? (
          <div className={styles.empty}>
            Loading staff members...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className={styles.empty}>
            <strong>No staff members found</strong>
            <span>
              Try changing your search or status filter.
            </span>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Rank</th>
                  <th>Status</th>
                  <th>Absence</th>
                  <th>Warnings</th>
                  <th>Joined</th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.map((member) => {
                  const status = getMemberStatus(member);

                  return (
                    <tr key={member.discordUserId}>
                      <td>
                        <div className={styles.member}>
                            <a className={styles.memberLink} href={`/team-hub/staff-directory/${encodeURIComponent(member.discordUserId)}`}>
                              {member.globalName || member.username}
                            </a>
                          <span>{member.username}</span>
                            <small><a className={styles.memberIdLink} href={`/team-hub/staff-directory/${encodeURIComponent(member.discordUserId)}`}>{member.discordUserId} · Open staff record</a></small>
                        </div>
                      </td>

                      <td>
                        <span className={styles.role}>
                          {roleLabel(member.role)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`${styles.status} ${status.className}`}
                        >
                          <span className={styles.statusDot} />
                          {status.label}
                        </span>
                      </td>

                      <td>
                        {member.absenceId ? (
                          <div className={styles.absence}>
                            <strong>
                              {formatDate(member.absenceStart)}
                            </strong>

                            <span>
                              Until{" "}
                              {formatDate(member.absenceReturn)}
                            </span>
                          </div>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            member.warningCount > 0
                              ? styles.warningCount
                              : styles.muted
                          }
                        >
                          {member.warningCount}
                        </span>
                      </td>

                      <td>
                        <span className={styles.muted}>
                          {formatDate(member.joinedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className={styles.footer}>
          Showing {filteredMembers.length} of {members.length} staff members
        </footer>
      </section>
    </main>
  );
}

export default function StaffDirectoryPage() {
  return (
    <PortalShell access="staffManager">
      {() => <StaffDirectoryContent />}
    </PortalShell>
  );
}

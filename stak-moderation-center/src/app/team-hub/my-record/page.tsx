"use client";

import { useCallback, useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import type { DiscordSessionUser } from "@/lib/auth";
import styles from "./my-record.module.css";

type StaffRecord = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  currentRole: string;
  status: string;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StaffWarning = {
  id: string;
  warning_type: string;
  reason: string;
  status: string;
  resolved_at: string | null;
  resolution_reason: string | null;
  created_at: string;
};

type StaffRecordResponse = {
  staffRecord: StaffRecord;
  warnings: StaffWarning[];
  summary: {
    totalWarnings: number;
    activeWarnings: number;
  };
};

type ApiResponse = Record<string, unknown>;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  "co-owner": "Co-Owner",
  management: "Management",
  "staff-manager": "Staff Manager",
  moderator: "Moderator",
  "trail-moderator": "Trial Moderator",
  "trial-moderator": "Trial Moderator",
};

const WARNING_LABELS: Record<string, string> = {
  notice: "Notice",
  warning: "Warning",
  final_warning: "Final Warning",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_leave: "On Leave",
  inactive: "Inactive",
  resolved: "Resolved",
  revoked: "Revoked",
  expired: "Expired",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readResponse(response: Response): Promise<ApiResponse> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!isRecord(payload)) {
    throw new Error("Unexpected server response.");
  }

  return payload;
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function StaffRecordContent() {
  const [record, setRecord] = useState<StaffRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecord = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      const payload = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to load your staff record.",
        );
      }

      if (
        !isRecord(payload.staffRecord) ||
        !isRecord(payload.summary)
      ) {
        throw new Error("The staff record is incomplete.");
      }

      const warnings = Array.isArray(payload.warnings)
        ? (payload.warnings as StaffWarning[])
        : [];

      setRecord({
        staffRecord: payload.staffRecord as unknown as StaffRecord,
        warnings,
        summary: {
          totalWarnings:
            typeof payload.summary.totalWarnings === "number"
              ? payload.summary.totalWarnings
              : 0,
          activeWarnings:
            typeof payload.summary.activeWarnings === "number"
              ? payload.summary.activeWarnings
              : 0,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  const staff = record?.staffRecord;

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            PERSONAL WORKSPACE
          </span>

          <h1>
            My Staff <span>Record</span>
          </h1>

          <p>
            Your personal staff profile and relevant internal
            staff information.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void loadRecord()}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </section>

      {loading ? (
        <div className={styles.loading}>
          <span className={styles.loader} />
          <p>Loading your staff record...</p>
        </div>
      ) : error ? (
        <div className={styles.errorNotice}>
          <strong>Unable to load staff record</strong>
          <p>{error}</p>

          <button
            type="button"
            className={styles.retryButton}
            onClick={() => void loadRecord()}
          >
            Try Again
          </button>
        </div>
      ) : staff && record ? (
        <>
          <section className={styles.profileHeader}>
            <div className={styles.profileIdentity}>
              <div className={styles.avatar}>
                {(staff.globalName || staff.username)
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <span className={styles.profileLabel}>
                  STAFF PROFILE
                </span>

                <h2>{staff.globalName || staff.username}</h2>

                <p>@{staff.username}</p>
              </div>
            </div>

            <div className={styles.profileBadges}>
              <span className={styles.roleBadge}>
                {getRoleLabel(staff.currentRole)}
              </span>

              <span
                className={`${styles.statusBadge} ${styles[staff.status] || ""}`}
              >
                <span />
                {getStatusLabel(staff.status)}
              </span>
            </div>
          </section>

          <section className={styles.statistics}>
            <div className={styles.statCard}>
              <span>TOTAL WARNINGS</span>
              <strong>{record.summary.totalWarnings}</strong>
            </div>

            <div className={styles.statCard}>
              <span>ACTIVE WARNINGS</span>
              <strong>{record.summary.activeWarnings}</strong>
            </div>

            <div className={styles.statCard}>
              <span>STAFF STATUS</span>
              <strong className={styles.statusValue}>
                {getStatusLabel(staff.status)}
              </strong>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>
                  ACCOUNT INFORMATION
                </span>

                <h2>Personal Information</h2>
              </div>
            </div>

            <div className={styles.informationGrid}>
              <div className={styles.informationItem}>
                <span>Discord Username</span>
                <strong>{staff.username}</strong>
              </div>

              <div className={styles.informationItem}>
                <span>Display Name</span>
                <strong>{staff.globalName || "Not set"}</strong>
              </div>

              <div className={styles.informationItem}>
                <span>Discord User ID</span>
                <strong className={styles.discordId}>
                  {staff.discordUserId}
                </strong>
              </div>

              <div className={styles.informationItem}>
                <span>Current Staff Rank</span>
                <strong>{getRoleLabel(staff.currentRole)}</strong>
              </div>

              <div className={styles.informationItem}>
                <span>Staff Since</span>
                <strong>{formatDate(staff.joinedAt)}</strong>
              </div>

              <div className={styles.informationItem}>
                <span>Profile Created</span>
                <strong>{formatDate(staff.createdAt)}</strong>
              </div>

              <div className={styles.informationItem}>
                <span>Last Profile Update</span>
                <strong>{formatDate(staff.updatedAt)}</strong>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>
                  DISCIPLINARY HISTORY
                </span>

                <h2>Warnings & Notices</h2>

                <p>
                  Your documented staff warnings and their current status.
                </p>
              </div>
            </div>

            {record.warnings.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>✓</span>

                <h3>No warnings recorded</h3>

                <p>
                  There are currently no staff warnings associated
                  with your record.
                </p>
              </div>
            ) : (
              <div className={styles.warningList}>
                {record.warnings.map((warning) => (
                  <article
                    className={styles.warningCard}
                    key={warning.id}
                  >
                    <div className={styles.warningHeader}>
                      <div>
                        <span className={styles.warningType}>
                          {WARNING_LABELS[warning.warning_type] ||
                            warning.warning_type}
                        </span>

                        <h3>Staff Warning</h3>
                      </div>

                      <span
                        className={`${styles.warningStatus} ${styles[warning.status] || ""}`}
                      >
                        {getStatusLabel(warning.status)}
                      </span>
                    </div>

                    <p>{warning.reason}</p>

                    <div className={styles.warningFooter}>
                      <span>
                        Issued: {formatDate(warning.created_at)}
                      </span>

                      {warning.resolved_at && (
                        <span>
                          Resolved: {formatDate(warning.resolved_at)}
                        </span>
                      )}
                    </div>

                    {warning.resolution_reason && (
                      <div className={styles.resolution}>
                        <strong>Resolution</strong>
                        <p>{warning.resolution_reason}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.informationNotice}>
            <span>i</span>

            <div>
              <strong>Personal record and internal information</strong>

              <p>
                This page displays information associated with
                your own staff account. Internal management notes
                and restricted administrative information are not
                included in this view.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default function MyStaffRecordPage() {
  return (
    <PortalShell access="staff">
      {() => <StaffRecordContent />}
    </PortalShell>
  );
}
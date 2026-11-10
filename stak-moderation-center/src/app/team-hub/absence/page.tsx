"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import PortalShell from "@/components/PortalShell";
import type { DiscordSessionUser } from "@/lib/auth";
import { hasPortalAccess } from "@/lib/portal-access";
import styles from "./absence.module.css";

type AbsenceRecord = {
  id: string;
  discord_user_id: string;
  username: string;
  global_name: string | null;
  start_date: string;
  expected_return_date: string | null;
  reason: string;
  status: string;
  management_note: string | null;
  reviewed_by_discord_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApiResponse = Record<string, unknown>;

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
  if (!value) return "Not specified";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  withdrawn: "Withdrawn",
  completed: "Completed",
};

function getStatusClass(status: string): string {
  switch (status) {
    case "submitted":
      return styles.submitted;
    case "reviewed":
      return styles.reviewed;
    case "withdrawn":
      return styles.withdrawn;
    case "completed":
      return styles.completed;
    default:
      return "";
  }
}

function AbsenceContent({ user }: { user: DiscordSessionUser }) {
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [startDate, setStartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [reason, setReason] = useState("");

  const [managementView, setManagementView] = useState(false);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState("");

  const isManagement = hasPortalAccess(
    user.stakRole,
    "staffManager",
  );

  const today = new Date().toLocaleDateString("en-CA");

  const loadAbsences = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const scope = managementView && isManagement
        ? "?scope=team"
        : "";

      const response = await fetch(
        `/api/staff/absences${scope}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      const payload = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to load absence records.",
        );
      }

      setAbsences(
        Array.isArray(payload.absences)
          ? (payload.absences as AbsenceRecord[])
          : [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load absence records.",
      );
    } finally {
      setLoading(false);
    }
  }, [managementView, isManagement]);

  useEffect(() => {
    void loadAbsences();
  }, [loadAbsences]);

  async function submitAbsence(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/staff/absences", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          expectedReturnDate: returnDate || null,
          reason,
        }),
      });

      const payload = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to submit absence notification.",
        );
      }

      setStartDate("");
      setReturnDate("");
      setReason("");

      setSuccess(
        "Your absence notification was submitted successfully.",
      );

      setManagementView(false);

      await loadAbsences();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit absence notification.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAbsence(
    id: string,
    action: "withdraw" | "review" | "complete",
  ): Promise<void> {
    const messages: Record<string, string> = {
      withdraw: "Withdraw this absence notification?",
      review: "Mark this notification as reviewed?",
      complete: "Mark this absence as completed?",
    };

    if (!window.confirm(messages[action])) {
      return;
    }

    setProcessingId(id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/staff/absences/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          managementNote: noteInputs[id] || null,
        }),
      });

      const payload = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to update absence notification.",
        );
      }

      setSuccess("Absence notification updated successfully.");

      setNoteInputs((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });

      await loadAbsences();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update absence notification.",
      );
    } finally {
      setProcessingId("");
    }
  }

  const pendingCount = absences.filter(
    (absence) => absence.status === "submitted",
  ).length;

  const reviewedCount = absences.filter(
    (absence) => absence.status === "reviewed",
  ).length;

  const activeRecords = absences.filter(
    (absence) =>
      absence.status === "submitted" ||
      absence.status === "reviewed",
  );

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            TEAM HUB / PERSONAL WORKSPACE
          </span>

          <h1>
            Absence <span>Management</span>
          </h1>

          <p>
            Submit absence notifications and keep track of
            your availability and previous absences.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={loading}
          onClick={() => void loadAbsences()}
        >
          ↻ Refresh
        </button>
      </section>

      {success && (
        <div className={styles.successNotice}>
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className={styles.errorNotice}>
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <section className={styles.policyCard}>
        <div className={styles.policyHeader}>
          <span className={styles.policyIcon}>i</span>

          <div>
            <span className={styles.eyebrow}>
              STAK ABSENCE POLICY
            </span>

            <h2>Absence Notification Requirements</h2>
          </div>
        </div>

        <div className={styles.policyGrid}>
          <div>
            <strong>Up to 2 days</strong>
            <p>
              No written absence notification is required
              for up to two consecutive missed days.
            </p>
          </div>

          <div>
            <strong>From the 3rd day</strong>
            <p>
              A written notification with a meaningful reason
              is required.
            </p>
          </div>

          <div>
            <strong>Private circumstances</strong>
            <p>
              Speak directly with management or arrange
              a temporary team break if necessary.
            </p>
          </div>
        </div>

        <p className={styles.policyFooter}>
          Formal approval is not automatically required.
          Absences lasting several months may require
          a discussion about continued team membership.
        </p>
      </section>

      <section className={styles.statistics}>
        <div className={styles.statCard}>
          <span>
            {managementView ? "TEAM ABSENCES" : "MY NOTIFICATIONS"}
          </span>

          <strong>{absences.length}</strong>
        </div>

        <div className={styles.statCard}>
          <span>AWAITING REVIEW</span>
          <strong>{pendingCount}</strong>
        </div>

        <div className={styles.statCard}>
          <span>REVIEWED / ACTIVE</span>
          <strong>{reviewedCount}</strong>
        </div>
      </section>

      <section className={styles.submissionSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>
              PERSONAL WORKSPACE
            </span>

            <h2>Submit an Absence</h2>

            <p>
              Provide your absence dates and a meaningful explanation.
            </p>
          </div>
        </div>

        <form className={styles.form} onSubmit={submitAbsence}>
          <div className={styles.dateGrid}>
            <label>
              First Day of Absence

              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(event) => setStartDate(event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <label>
              Expected Return Date

              <input
                type="date"
                value={returnDate}
                min={startDate || today}
                onChange={(event) => setReturnDate(event.target.value)}
                disabled={saving}
              />

              <small>
                Leave empty if your return date is currently unknown.
              </small>
            </label>
          </div>

          <label>
            Reason for Absence

            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={3000}
              rows={5}
              required
              disabled={saving}
              placeholder="Provide a meaningful explanation for your absence..."
            />

            <small>
              Your explanation is visible only to you and authorized management.
              Private circumstances can also be discussed directly with management.
            </small>
          </label>

          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit Notification"}
            </button>
          </div>
        </form>
      </section>

      {isManagement && (
        <section className={styles.managementSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>
                MANAGEMENT TOOLS
              </span>

              <h2>Team Overview</h2>

              <p>
                Review submitted notifications and manage their status.
              </p>
            </div>

            <button
              type="button"
              className={styles.viewToggle}
              onClick={() =>
                setManagementView((current) => !current)
              }
            >
              {managementView
                ? "My Absences"
                : "View Team Absences"}
            </button>
          </div>
        </section>
      )}

      <section className={styles.historySection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>
              {managementView ? "TEAM RECORDS" : "PERSONAL HISTORY"}
            </span>

            <h2>
              {managementView
                ? "Staff Absence Notifications"
                : "My Absence History"}
            </h2>
          </div>

          <span className={styles.recordCount}>
            {absences.length} RECORDS
          </span>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <span className={styles.loader} />
            Loading absence records...
          </div>
        ) : absences.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>✓</span>

            <h3>No absence notifications found</h3>

            <p>
              {managementView
                ? "There are currently no absence notifications in the team."
                : "You have not submitted any absence notifications yet."}
            </p>
          </div>
        ) : (
          <div className={styles.absenceList}>
            {absences.map((absence) => {
              const isOwn =
                absence.discord_user_id === user.discordUserId;

              const isProcessing =
                processingId === absence.id;

              const canWithdraw =
                isOwn &&
                (
                  absence.status === "submitted" ||
                  absence.status === "reviewed"
                );

              const canReview =
                managementView &&
                absence.status === "submitted";

              const canComplete =
                managementView &&
                absence.status === "reviewed";

              return (
                <article
                  className={styles.absenceCard}
                  key={absence.id}
                >
                  <div className={styles.absenceHeader}>
                    <div>
                      <span className={styles.absenceCategory}>
                        {managementView
                          ? absence.global_name || absence.username
                          : "PERSONAL ABSENCE"}
                      </span>

                      <h3>
                        {formatDate(absence.start_date)}
                      </h3>
                    </div>

                    <span
                      className={`${styles.status} ${getStatusClass(
                        absence.status,
                      )}`}
                    >
                      {STATUS_LABELS[absence.status] ||
                        absence.status}
                    </span>
                  </div>

                  <div className={styles.absenceDates}>
                    <div>
                      <span>START DATE</span>
                      <strong>
                        {formatDate(absence.start_date)}
                      </strong>
                    </div>

                    <div>
                      <span>EXPECTED RETURN</span>
                      <strong>
                        {formatDate(absence.expected_return_date)}
                      </strong>
                    </div>

                    {managementView && (
                      <div>
                        <span>DISCORD ID</span>
                        <strong className={styles.discordId}>
                          {absence.discord_user_id}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className={styles.reasonBlock}>
                    <span>REASON</span>
                    <p>{absence.reason}</p>
                  </div>

                  {absence.management_note && (
                    <div className={styles.managementNote}>
                      <strong>Management Note</strong>
                      <p>{absence.management_note}</p>
                    </div>
                  )}

                  {absence.reviewed_at && (
                    <div className={styles.reviewInfo}>
                      Last reviewed: {formatDate(
                        absence.reviewed_at.slice(0, 10),
                      )}
                    </div>
                  )}

                  {(canWithdraw || canReview || canComplete) && (
                    <div className={styles.cardActions}>
                      {canReview && (
                        <div className={styles.reviewControls}>
                          <input
                            type="text"
                            maxLength={2000}
                            placeholder="Optional management note..."
                            value={noteInputs[absence.id] || ""}
                            onChange={(event) =>
                              setNoteInputs((previous) => ({
                                ...previous,
                                [absence.id]: event.target.value,
                              }))
                            }
                            disabled={isProcessing}
                          />

                          <button
                            type="button"
                            className={styles.reviewButton}
                            disabled={isProcessing}
                            onClick={() =>
                              void updateAbsence(
                                absence.id,
                                "review",
                              )
                            }
                          >
                            {isProcessing
                              ? "Processing..."
                              : "Mark Reviewed"}
                          </button>
                        </div>
                      )}

                      {canComplete && (
                        <button
                          type="button"
                          className={styles.completeButton}
                          disabled={isProcessing}
                          onClick={() =>
                            void updateAbsence(
                              absence.id,
                              "complete",
                            )
                          }
                        >
                          {isProcessing
                            ? "Processing..."
                            : "Mark Completed"}
                        </button>
                      )}

                      {canWithdraw && (
                        <button
                          type="button"
                          className={styles.withdrawButton}
                          disabled={isProcessing}
                          onClick={() =>
                            void updateAbsence(
                              absence.id,
                              "withdraw",
                            )
                          }
                        >
                          {isProcessing
                            ? "Processing..."
                            : "Withdraw Notification"}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default function AbsencePage() {
  return (
    <PortalShell access="staff">
      {(user) => <AbsenceContent user={user} />}
    </PortalShell>
  );
}
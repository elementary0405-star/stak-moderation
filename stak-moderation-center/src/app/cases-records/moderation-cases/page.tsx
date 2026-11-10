"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import PortalShell from "@/components/PortalShell";
import styles from "./moderation-cases.module.css";

type CaseRecord = {
  id: string;
  case_number: string;
  player_id: string;
  player_name: string;
  discord_name: string | null;
  discord_id: string | null;
  game: string | null;
  sanction_type: string;
  reason: string;
  notes: string | null;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  expires_at: string | null;
  created_by_discord_id: string | null;
  created_at: string;
  updated_at: string;
};

type PlayerOption = {
  id: string;
  player_name: string;
  discord_name: string | null;
  discord_id: string | null;
};

type EvidenceRecord = {
  id: string;
  file_name: string | null;
  evidence_url: string | null;
  description: string | null;
  uploaded_by_discord_id: string | null;
  created_at: string;
};

type HistoryRecord = {
  id: string;
  actor_discord_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
};

type CaseDetails = {
  case: CaseRecord;
  evidence: EvidenceRecord[];
  history: HistoryRecord[];
};

type ApiResponse = Record<string, unknown>;

const SANCTION_LABELS: Record<string, string> = {
  permanent_ban: "Permanent Ban",
  temporary_ban: "Temporary Ban",
  unban: "Unban",
  kick: "Kick",
  timeout: "Timeout",
  warning: "Warning",
  project_exclusion: "Project Exclusion",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  lifted: "Lifted",
  completed: "Completed",
};

const SANCTION_TYPES = [
  "permanent_ban",
  "temporary_ban",
  "unban",
  "kick",
  "timeout",
  "warning",
  "project_exclusion",
  "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!isRecord(payload)) {
    throw new Error("The server returned an unexpected response.");
  }

  return payload;
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Permanent";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;

  return `${Math.floor(seconds / 60)}m`;
}

function getErrorMessage(
  payload: ApiResponse,
  fallback: string,
): string {
  return typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export default function ModerationCasesPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const limit = 25;

  const [selectedCase, setSelectedCase] =
    useState<CaseDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [playerId, setPlayerId] = useState("");
  const [sanctionType, setSanctionType] = useState("warning");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [game, setGame] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (typeFilter !== "all") {
        params.set("sanctionType", typeFilter);
      }

      const response = await fetch(`/api/cases?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      const payload = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to load moderation cases."),
        );
      }

      const caseList = Array.isArray(payload.cases)
        ? (payload.cases as CaseRecord[])
        : [];

      const pagination = isRecord(payload.pagination)
        ? payload.pagination
        : {};

      setCases(caseList);

      setTotal(
        typeof pagination.total === "number"
          ? pagination.total
          : 0,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, offset]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCases();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loadCases]);

  useEffect(() => {
    setOffset(0);
  }, [search, statusFilter, typeFilter]);

  async function loadPlayers(): Promise<void> {
    setPlayersLoading(true);
    setCreateError("");

    try {
      const response = await fetch("/api/players?limit=100", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      const payload = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to load player records."),
        );
      }

      const playerList = Array.isArray(payload.players)
        ? (payload.players as PlayerOption[])
        : [];

      setPlayers(playerList);
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to load players.",
      );
    } finally {
      setPlayersLoading(false);
    }
  }

  async function openCreateDialog(): Promise<void> {
    setCreateError("");
    setSuccessMessage("");

    setPlayerId("");
    setSanctionType("warning");
    setReason("");
    setNotes("");
    setGame("");
    setDurationHours("24");

    setCreateOpen(true);

    await loadPlayers();
  }

  async function createCase(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setCreating(true);
    setCreateError("");

    try {
      const requestBody: Record<string, unknown> = {
        playerId,
        sanctionType,
        reason,
        notes: notes || null,
        game: game || null,
      };

      if (
        sanctionType === "temporary_ban" ||
        sanctionType === "timeout"
      ) {
        const hours = Number(durationHours);

        if (!Number.isFinite(hours) || hours <= 0) {
          throw new Error("Please enter a valid duration.");
        }

        requestBody.durationSeconds = Math.round(hours * 3600);
      }

      const response = await fetch("/api/cases", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to create case."),
        );
      }

      const createdCase = isRecord(payload.case)
        ? payload.case
        : {};

      const caseNumber =
        typeof createdCase.caseNumber === "string"
          ? createdCase.caseNumber
          : "New case";

      setCreateOpen(false);

      setSuccessMessage(
        `Case ${caseNumber} was created successfully.`,
      );

      setOffset(0);

      await loadCases();
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function openCase(id: string): Promise<void> {
    setSelectedCase(null);
    setDetailsError("");
    setDetailsLoading(true);

    try {
      const response = await fetch(`/api/cases/${id}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      const payload = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to open case."),
        );
      }

      if (!isRecord(payload.case)) {
        throw new Error("The case information is incomplete.");
      }

      const evidenceList = Array.isArray(payload.evidence)
        ? (payload.evidence as EvidenceRecord[])
        : [];

      const historyList = Array.isArray(payload.history)
        ? (payload.history as HistoryRecord[])
        : [];

      setSelectedCase({
        case: payload.case as unknown as CaseRecord,
        evidence: evidenceList,
        history: historyList,
      });
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to open moderation case.",
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <PortalShell access="trailModerator">
      {() => (
        <main className={styles.page}>
          <section className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>
                MODERATION DATABASE
              </span>

              <h1>
                Moderation <span>Cases</span>
              </h1>

              <p>
                Search, review and manage player-related
                moderation incidents.
              </p>
            </div>

            <button
              type="button"
              className={styles.createButton}
              onClick={() => void openCreateDialog()}
            >
              <span>+</span> Create Case
            </button>
          </section>

          {successMessage && (
            <div className={styles.successNotice}>
              {successMessage}

              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          <section className={styles.statistics}>
            <div className={styles.statCard}>
              <span>TOTAL CASES</span>
              <strong>{total}</strong>
            </div>

            <div className={styles.statCard}>
              <span>DISPLAYED</span>
              <strong>{cases.length}</strong>
            </div>

            <div className={styles.statCard}>
              <span>CURRENT PAGE</span>
              <strong>{currentPage}</strong>
            </div>
          </section>

          <section className={styles.recordsSection}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>
                  RECORD MANAGEMENT
                </span>

                <h2>All Moderation Cases</h2>
              </div>

              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => void loadCases()}
              >
                ↻ Refresh
              </button>
            </div>

            <div className={styles.filters}>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Case ID, player or Discord ID..."
                aria-label="Search moderation cases"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="lifted">Lifted</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
                aria-label="Filter by sanction type"
              >
                <option value="all">All sanction types</option>

                {SANCTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SANCTION_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className={styles.errorNotice}>
                {error}
              </div>
            )}

            {loading ? (
              <div className={styles.loading}>
                <span className={styles.loader} />
                Loading moderation cases...
              </div>
            ) : cases.length === 0 ? (
              <div className={styles.empty}>
                <span>⌕</span>
                <h3>No moderation cases found</h3>
                <p>
                  No records match your current search or filters.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>CASE ID</th>
                        <th>PLAYER</th>
                        <th>SANCTION</th>
                        <th>STATUS</th>
                        <th>CREATED</th>
                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {cases.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <strong className={styles.caseNumber}>
                              {record.case_number}
                            </strong>
                          </td>

                          <td>
                            <strong>{record.player_name}</strong>

                            <small>
                              {record.discord_name ||
                                record.discord_id ||
                                "No Discord information"}
                            </small>
                          </td>

                          <td>
                            {SANCTION_LABELS[record.sanction_type] ||
                              record.sanction_type}
                          </td>

                          <td>
                            <span
                              className={`${styles.status} ${styles[record.status] || ""}`}
                            >
                              {STATUS_LABELS[record.status] ||
                                record.status}
                            </span>
                          </td>

                          <td>
                            {formatDate(record.created_at)}
                          </td>

                          <td>
                            <button
                              type="button"
                              className={styles.viewButton}
                              onClick={() => void openCase(record.id)}
                            >
                              View →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <span>
                    Showing {total === 0 ? 0 : offset + 1}–
                    {Math.min(offset + cases.length, total)} of {total}
                  </span>

                  <div>
                    <button
                      type="button"
                      disabled={offset === 0}
                      onClick={() =>
                        setOffset(Math.max(0, offset - limit))
                      }
                    >
                      Previous
                    </button>

                    <strong>
                      {currentPage} / {totalPages}
                    </strong>

                    <button
                      type="button"
                      disabled={offset + limit >= total}
                      onClick={() => setOffset(offset + limit)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {detailsLoading && (
            <div className={styles.modalBackdrop}>
              <div className={styles.loading}>
                <span className={styles.loader} />
                Loading case details...
              </div>
            </div>
          )}

          {detailsError && (
            <div className={styles.modalBackdrop}>
              <section className={styles.modal}>
                <h2>Unable to open case</h2>
                <p>{detailsError}</p>

                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setDetailsError("")}
                >
                  Close
                </button>
              </section>
            </div>
          )}

          {selectedCase && (
            <div
              className={styles.modalBackdrop}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedCase(null);
                }
              }}
            >
              <section
                className={`${styles.modal} ${styles.detailsModal}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="case-details-title"
              >
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.eyebrow}>
                      MODERATION RECORD
                    </span>

                    <h2 id="case-details-title">
                      {selectedCase.case.case_number}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setSelectedCase(null)}
                    aria-label="Close case details"
                  >
                    ×
                  </button>
                </div>

                <div className={styles.detailGrid}>
                  <div>
                    <span>PLAYER</span>
                    <strong>
                      {selectedCase.case.player_name}
                    </strong>
                  </div>

                  <div>
                    <span>SANCTION</span>
                    <strong>
                      {SANCTION_LABELS[
                        selectedCase.case.sanction_type
                      ] || selectedCase.case.sanction_type}
                    </strong>
                  </div>

                  <div>
                    <span>STATUS</span>
                    <strong>
                      {STATUS_LABELS[selectedCase.case.status] ||
                        selectedCase.case.status}
                    </strong>
                  </div>

                  <div>
                    <span>DURATION</span>
                    <strong>
                      {formatDuration(
                        selectedCase.case.duration_seconds,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>STARTED</span>
                    <strong>
                      {formatDate(selectedCase.case.started_at)}
                    </strong>
                  </div>

                  <div>
                    <span>EXPIRES</span>
                    <strong>
                      {formatDate(selectedCase.case.expires_at)}
                    </strong>
                  </div>
                </div>

                <div className={styles.detailBlock}>
                  <h3>Reason</h3>
                  <p>{selectedCase.case.reason}</p>
                </div>

                {selectedCase.case.notes && (
                  <div className={styles.detailBlock}>
                    <h3>Internal Notes</h3>
                    <p>{selectedCase.case.notes}</p>
                  </div>
                )}

                <div className={styles.detailBlock}>
                  <h3>
                    Evidence ({selectedCase.evidence.length})
                  </h3>

                  {selectedCase.evidence.length === 0 ? (
                    <p>No evidence attached.</p>
                  ) : (
                    selectedCase.evidence.map((item) => (
                      <div
                        key={item.id}
                        className={styles.evidenceItem}
                      >
                        <strong>
                          {item.file_name || "Evidence link"}
                        </strong>

                        {item.description && (
                          <p>{item.description}</p>
                        )}

                        {item.evidence_url && (
                          <a
                            href={item.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open evidence →
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.detailBlock}>
                  <h3>
                    History ({selectedCase.history.length})
                  </h3>

                  {selectedCase.history.length === 0 ? (
                    <p>No history available.</p>
                  ) : (
                    selectedCase.history.map((entry) => (
                      <div
                        key={entry.id}
                        className={styles.historyItem}
                      >
                        <strong>{entry.action}</strong>

                        <span>
                          {formatDate(entry.created_at)}
                        </span>

                        {entry.reason && <p>{entry.reason}</p>}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {createOpen && (
            <div
              className={styles.modalBackdrop}
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !creating
                ) {
                  setCreateOpen(false);
                }
              }}
            >
              <section
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-case-title"
              >
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.eyebrow}>
                      NEW RECORD
                    </span>

                    <h2 id="create-case-title">
                      Create Moderation Case
                    </h2>
                  </div>

                  <button
                    type="button"
                    className={styles.closeButton}
                    disabled={creating}
                    onClick={() => setCreateOpen(false)}
                    aria-label="Close form"
                  >
                    ×
                  </button>
                </div>

                {createError && (
                  <div className={styles.errorNotice}>
                    {createError}
                  </div>
                )}

                <form onSubmit={createCase}>
                  <label>
                    Player

                    <select
                      required
                      value={playerId}
                      onChange={(event) =>
                        setPlayerId(event.target.value)
                      }
                      disabled={playersLoading || creating}
                    >
                      <option value="">
                        {playersLoading
                          ? "Loading players..."
                          : "Select a player"}
                      </option>

                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.player_name}
                          {player.discord_name
                            ? ` – ${player.discord_name}`
                            : ""}
                        </option>
                      ))}
                    </select>

                    {!playersLoading && players.length === 0 && (
                      <small>
                        No player records found. Create a player record first.
                      </small>
                    )}
                  </label>

                  <label>
                    Sanction Type

                    <select
                      value={sanctionType}
                      onChange={(event) =>
                        setSanctionType(event.target.value)
                      }
                      disabled={creating}
                    >
                      {SANCTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {SANCTION_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {(sanctionType === "temporary_ban" ||
                    sanctionType === "timeout") && (
                    <label>
                      Duration (hours)

                      <input
                        type="number"
                        min="1"
                        max="87600"
                        value={durationHours}
                        onChange={(event) =>
                          setDurationHours(event.target.value)
                        }
                        required
                        disabled={creating}
                      />
                    </label>
                  )}

                  <label>
                    Game / Platform

                    <input
                      type="text"
                      maxLength={100}
                      value={game}
                      onChange={(event) =>
                        setGame(event.target.value)
                      }
                      placeholder="Optional"
                      disabled={creating}
                    />
                  </label>

                  <label>
                    Reason

                    <textarea
                      value={reason}
                      onChange={(event) =>
                        setReason(event.target.value)
                      }
                      maxLength={5000}
                      rows={4}
                      required
                      disabled={creating}
                      placeholder="Describe the incident and reason for the action..."
                    />
                  </label>

                  <label>
                    Internal Notes

                    <textarea
                      value={notes}
                      onChange={(event) =>
                        setNotes(event.target.value)
                      }
                      maxLength={10000}
                      rows={3}
                      disabled={creating}
                      placeholder="Optional internal information..."
                    />
                  </label>

                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      disabled={creating}
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={styles.createButton}
                      disabled={
                        creating ||
                        playersLoading ||
                        players.length === 0
                      }
                    >
                      {creating ? "Creating..." : "Create Case"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </main>
      )}
    </PortalShell>
  );
}
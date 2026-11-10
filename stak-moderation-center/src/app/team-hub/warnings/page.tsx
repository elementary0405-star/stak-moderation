"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import PortalShell from "@/components/PortalShell";
import styles from "./warnings.module.css";

type WarningStatus = "active" | "resolved" | "revoked" | "expired";

type WarningItem = {
  id: string;
  discordUserId: string;
  username: string | null;
  globalName: string | null;
  warningType: string;
  reason: string;
  internalNotes: string | null;
  issuedByDiscordId: string;
  status: WarningStatus;
  resolvedAt: string | null;
  resolvedByDiscordId: string | null;
  resolutionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type WarningResponse = {
  warnings: WarningItem[];
};

type ApiError = {
  error?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorData = data as ApiError | null;
    throw new Error(errorData?.error || "Request failed.");
  }

  return data as T;
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function warningLabel(value: string): string {
  const labels: Record<string, string> = {
    notice: "Notice",
    warning: "Warning",
    final_warning: "Final Warning",
  };

  return labels[value] ?? value;
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    resolved: "Resolved",
    revoked: "Revoked",
    expired: "Expired",
  };

  return labels[value] ?? value;
}

function StaffWarningsContent() {
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [selected, setSelected] = useState<WarningItem | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [discordUserId, setDiscordUserId] = useState("");
  const [warningType, setWarningType] = useState("warning");
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [resolutionReason, setResolutionReason] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadWarnings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        status: filter,
        search,
      });

      const response = await fetch(
        `/api/staff/warnings?${params.toString()}`,
        { cache: "no-store" },
      );

      const data = await readResponse<WarningResponse>(response);
      setWarnings(data.warnings ?? []);

      setSelected((current) => {
        if (!current) return null;
        return data.warnings.find((item) => item.id === current.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load warnings.");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadWarnings();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadWarnings]);

  async function createWarning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/staff/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordUserId,
          warningType,
          reason,
          internalNotes,
        }),
      });

      await readResponse<{ message: string; id: string }>(response);

      setSuccess("Staff warning created.");
      setDiscordUserId("");
      setWarningType("warning");
      setReason("");
      setInternalNotes("");
      setShowCreate(false);

      await loadWarnings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create warning.");
    } finally {
      setSaving(false);
    }
  }

  async function updateWarning(action: "resolve" | "revoke") {
    if (!selected) return;

    if (resolutionReason.trim().length < 5) {
      setError("Please provide a reason for this change.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/staff/warnings/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, resolutionReason }),
        },
      );

      await readResponse<{ message: string; status: string }>(response);

      setSuccess(`Warning ${action === "resolve" ? "resolved" : "revoked"}.`);
      setResolutionReason("");
      await loadWarnings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update warning.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = warnings.filter((item) => item.status === "active").length;
  const resolvedCount = warnings.filter((item) => item.status === "resolved").length;
  const revokedCount = warnings.filter((item) => item.status === "revoked").length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>MANAGEMENT TOOLS</span>
          <h1>Warnings & History</h1>
          <p>Internal staff notices and disciplinary records.</p>
        </div>

        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => setShowCreate((value) => !value)}
        >
          {showCreate ? "Close form" : "Issue warning"}
        </button>
      </header>

      <section className={styles.stats}>
        <article><span>Loaded records</span><strong>{warnings.length}</strong></article>
        <article><span>Active</span><strong>{activeCount}</strong></article>
        <article><span>Resolved</span><strong>{resolvedCount}</strong></article>
        <article><span>Revoked</span><strong>{revokedCount}</strong></article>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {showCreate && (
        <form className={styles.createPanel} onSubmit={createWarning}>
          <div className={styles.panelHeading}>
            <h2>Issue staff warning</h2>
            <p>The Discord ID must belong to an existing staff profile.</p>
          </div>

          <div className={styles.formGrid}>
            <label>
              Discord User ID
              <input
                value={discordUserId}
                onChange={(event) => setDiscordUserId(event.target.value)}
                placeholder="Discord ID"
                required
              />
            </label>

            <label>
              Warning type
              <select
                value={warningType}
                onChange={(event) => setWarningType(event.target.value)}
              >
                <option value="notice">Notice</option>
                <option value="warning">Warning</option>
                <option value="final_warning">Final Warning</option>
              </select>
            </label>
          </div>

          <label>
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={3000}
              rows={4}
              required
            />
          </label>

          <label>
            Internal notes
            <textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              maxLength={3000}
              rows={3}
            />
          </label>

          <button className={styles.primaryButton} disabled={saving}>
            {saving ? "Saving..." : "Create warning"}
          </button>
        </form>
      )}

      <div className={styles.toolbar}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search staff member, Discord ID or reason..."
        />

        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className={styles.layout}>
        <section className={styles.listPanel}>
          <div className={styles.panelHeading}>
            <h2>Warning records</h2>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading records...</div>
          ) : warnings.length === 0 ? (
            <div className={styles.empty}>No warning records found.</div>
          ) : (
            <div className={styles.list}>
              {warnings.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.listItem} ${
                    selected?.id === item.id ? styles.selected : ""
                  }`}
                  onClick={() => {
                    setSelected(item);
                    setResolutionReason("");
                    setError("");
                  }}
                >
                  <div className={styles.itemTop}>
                    <span className={styles.type}>{warningLabel(item.warningType)}</span>
                    <span className={`${styles.status} ${styles[item.status]}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <strong>{item.globalName || item.username || item.discordUserId}</strong>
                  <span className={styles.muted}>{item.discordUserId}</span>
                  <span className={styles.muted}>{formatDate(item.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.detailPanel}>
          {!selected ? (
            <div className={styles.empty}>Select a warning record to view details.</div>
          ) : (
            <>
              <span className={styles.eyebrow}>WARNING DETAILS</span>
              <h2>{warningLabel(selected.warningType)}</h2>

              <div className={styles.detailMeta}>
                <div><span>Staff member</span><strong>{selected.globalName || selected.username || "Unknown"}</strong></div>
                <div><span>Discord ID</span><strong>{selected.discordUserId}</strong></div>
                <div><span>Issued by</span><strong>{selected.issuedByDiscordId}</strong></div>
                <div><span>Created</span><strong>{formatDate(selected.createdAt)}</strong></div>
                <div><span>Status</span><strong>{statusLabel(selected.status)}</strong></div>
              </div>

              <div className={styles.messageBox}>
                <h3>Reason</h3>
                <p>{selected.reason}</p>
              </div>

              {selected.internalNotes && (
                <div className={styles.messageBox}>
                  <h3>Internal notes</h3>
                  <p>{selected.internalNotes}</p>
                </div>
              )}

              {selected.status !== "active" && (
                <div className={styles.messageBox}>
                  <h3>Resolution history</h3>
                  <p>{selected.resolutionReason || "No resolution reason recorded."}</p>
                  <span className={styles.muted}>
                    {formatDate(selected.resolvedAt)} · {selected.resolvedByDiscordId || "—"}
                  </span>
                </div>
              )}

              {selected.status === "active" && (
                <div className={styles.actionPanel}>
                  <h3>Update warning status</h3>

                  <label>
                    Resolution reason
                    <textarea
                      value={resolutionReason}
                      onChange={(event) => setResolutionReason(event.target.value)}
                      minLength={5}
                      maxLength={2000}
                      rows={3}
                    />
                  </label>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.resolveButton}
                      disabled={saving}
                      onClick={() => void updateWarning("resolve")}
                    >
                      Resolve warning
                    </button>

                    <button
                      type="button"
                      className={styles.revokeButton}
                      disabled={saving}
                      onClick={() => void updateWarning("revoke")}
                    >
                      Revoke warning
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function StaffWarningsPage() {
  return (
    <PortalShell access="staffManager">
      {() => <StaffWarningsContent />}
    </PortalShell>
  );
}
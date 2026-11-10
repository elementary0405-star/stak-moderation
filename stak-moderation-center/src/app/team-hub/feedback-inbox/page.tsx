"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import PortalShell from "@/components/PortalShell";
import styles from "./feedback-inbox.module.css";

type FeedbackStatus =
  | "new"
  | "under_review"
  | "addressed"
  | "archived";

type FeedbackItem = {
  id: string;
  discordUserId: string;
  category: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  ownerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FeedbackListResponse = {
  feedback: FeedbackItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type FeedbackUpdateResponse = {
  message: string;
  feedback: FeedbackItem;
};

type ApiError = {
  error?: string;
};

const statuses: { value: string; label: string }[] = [
  { value: "all", label: "All messages" },
  { value: "new", label: "New" },
  { value: "under_review", label: "Under review" },
  { value: "addressed", label: "Addressed" },
  { value: "archived", label: "Archived" },
];

const statusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  under_review: "Under review",
  addressed: "Addressed",
  archived: "Archived",
};

function formatDate(value: string): string {
  if (!value) return "—";

  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T") + "Z";

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function FeedbackInboxContent() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [ownerNote, setOwnerNote] = useState("");
  const [newStatus, setNewStatus] = useState<FeedbackStatus>("new");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        status: filter,
        search,
        limit: "100",
      });

      const response = await fetch(
        `/api/staff/feedback/inbox?${params.toString()}`,
        { cache: "no-store" },
      );

      const data = await readResponse<FeedbackListResponse>(response);
      const feedback = data.feedback ?? [];

      setItems(feedback);

      setSelected((current) => {
        if (!current) return null;

        return (
          feedback.find((item) => item.id === current.id) ?? null
        );
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load feedback.",
      );
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFeedback();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadFeedback]);

  function selectItem(item: FeedbackItem) {
    setSelected(item);
    setOwnerNote(item.ownerNote ?? "");
    setNewStatus(item.status);
    setSuccess("");
    setError("");
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/staff/feedback/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
            ownerNote,
          }),
        },
      );

      const data =
        await readResponse<FeedbackUpdateResponse>(response);

      const updated = data.feedback;

      setItems((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      setSelected(updated);
      setOwnerNote(updated.ownerNote ?? "");
      setNewStatus(updated.status);

      setSuccess("Feedback has been updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update feedback.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OWNER AREA</span>
          <h1>Feedback Inbox</h1>
          <p>
            Review confidential messages submitted by staff members.
          </p>
        </div>

        <div className={styles.accessBadge}>
          <span className={styles.accessDot} />
          Owner access
        </div>
      </header>

      <div className={styles.notice}>
        This inbox is restricted to the Owner. Other staff roles cannot
        access these messages or their internal notes.
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search subject, message or Discord ID..."
        />

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => void loadFeedback()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className={styles.layout}>
        <section className={styles.listPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Messages</h2>
              <p>{items.length} loaded messages</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>
              Loading feedback...
            </div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              No feedback messages found.
            </div>
          ) : (
            <div className={styles.list}>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.listItem} ${
                    selected?.id === item.id ? styles.selected : ""
                  }`}
                  onClick={() => selectItem(item)}
                >
                  <div className={styles.listTop}>
                    <span className={styles.category}>
                      {item.category}
                    </span>

                    <span
                      className={`${styles.status} ${styles[item.status]}`}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>

                  <strong>{item.subject}</strong>

                  <span className={styles.sender}>
                    Discord ID: {item.discordUserId}
                  </span>

                  <span className={styles.date}>
                    {formatDate(item.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.detailPanel}>
          {!selected ? (
            <div className={styles.emptyDetail}>
              <strong>Select a message</strong>
              <span>
                Choose a feedback message from the list to review it.
              </span>
            </div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    FEEDBACK DETAILS
                  </span>
                  <h2>{selected.subject}</h2>
                </div>

                <span
                  className={`${styles.status} ${styles[selected.status]}`}
                >
                  {statusLabels[selected.status] ?? selected.status}
                </span>
              </div>

              <div className={styles.metadata}>
                <div>
                  <span>Submitted by</span>
                  <strong>{selected.discordUserId}</strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>{selected.category}</strong>
                </div>

                <div>
                  <span>Submitted</span>
                  <strong>{formatDate(selected.createdAt)}</strong>
                </div>
              </div>

              <div className={styles.messageBox}>
                <h3>Message</h3>
                <p>{selected.message}</p>
              </div>

              <form
                className={styles.editForm}
                onSubmit={saveChanges}
              >
                <h3>Owner management</h3>

                <label>
                  Status

                  <select
                    value={newStatus}
                    onChange={(event) =>
                      setNewStatus(
                        event.target.value as FeedbackStatus,
                      )
                    }
                  >
                    {statuses
                      .filter((status) => status.value !== "all")
                      .map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Internal note

                  <textarea
                    value={ownerNote}
                    onChange={(event) =>
                      setOwnerNote(event.target.value)
                    }
                    placeholder="Private notes for the Owner..."
                    rows={5}
                    maxLength={3000}
                  />

                  <span className={styles.counter}>
                    {ownerNote.length}/3000 characters
                  </span>
                </label>

                {error && (
                  <div className={styles.error}>{error}</div>
                )}

                {success && (
                  <div className={styles.success}>{success}</div>
                )}

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function FeedbackInboxPage() {
  return (
    <PortalShell access="owner">
      {() => <FeedbackInboxContent />}
    </PortalShell>
  );
}
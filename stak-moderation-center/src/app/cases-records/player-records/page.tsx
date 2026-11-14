"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import PortalShell from "@/components/PortalShell";
import type { DiscordSessionUser } from "@/lib/auth";
import styles from "./player-records.module.css";

type PlayerIdentity = {
  id: string;
  game: string;
  gamePlayerId: string;
  gamePlayerName: string | null;
  createdAt: string;
};

type PlayerRecord = {
  id: string;
  playerName: string;
  discordName: string | null;
  discordId: string | null;
  internalNotes: string | null;
  createdByDiscordId: string | null;
  createdAt: string;
  updatedAt: string;
  identities: PlayerIdentity[];
};

type ModerationCase = {
  id: string;
  caseNumber: string;
  playerId: string;
  game: string | null;
  sanctionType: string;
  reason: string;
  notes: string | null;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  expiresAt: string | null;
  createdByDiscordId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlayerDetails = {
  player: PlayerRecord;
  identities: PlayerIdentity[];
  cases: ModerationCase[];
};

type ApiResponse = Record<string, unknown>;

const LIMIT = 25;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function readResponse(payload: unknown): ApiResponse {
  if (!isRecord(payload)) {
    throw new Error("Unexpected server response.");
  }

  return payload;
}

async function fetchPayload(
  response: Response,
): Promise<ApiResponse> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  return readResponse(payload);
}

function getError(
  payload: ApiResponse,
  fallback: string,
): string {
  return typeof payload.error === "string"
    ? payload.error
    : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "—";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

function getStatusClass(status: string): string {
  switch (status) {
    case "active":
      return styles.active;
    case "expired":
      return styles.expired;
    case "lifted":
      return styles.lifted;
    case "completed":
      return styles.completed;
    default:
      return "";
  }
}

function normalizeIdentity(value: unknown): PlayerIdentity | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const game = readString(value.game);
  const gamePlayerId = readString(
    value.gamePlayerId ?? value.game_player_id,
  );

  if (!id || !game || !gamePlayerId) return null;

  return {
    id,
    game,
    gamePlayerId,
    gamePlayerName: readNullableString(
      value.gamePlayerName ?? value.game_player_name,
    ),
    createdAt: readString(
      value.createdAt ?? value.created_at,
    ),
  };
}

function normalizePlayer(value: unknown): PlayerRecord | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const playerName = readString(
    value.playerName ?? value.player_name,
  );

  if (!id || !playerName) return null;

  const rawIdentities = Array.isArray(value.identities)
    ? value.identities
    : [];

  return {
    id,
    playerName,
    discordName: readNullableString(
      value.discordName ?? value.discord_name,
    ),
    discordId: readNullableString(
      value.discordId ?? value.discord_id,
    ),
    internalNotes: readNullableString(
      value.internalNotes ?? value.internal_notes,
    ),
    createdByDiscordId: readNullableString(
      value.createdByDiscordId ?? value.created_by_discord_id,
    ),
    createdAt: readString(
      value.createdAt ?? value.created_at,
    ),
    updatedAt: readString(
      value.updatedAt ?? value.updated_at,
    ),
    identities: rawIdentities
      .map(normalizeIdentity)
      .filter((identity): identity is PlayerIdentity => identity !== null),
  };
}

function normalizeCase(value: unknown): ModerationCase | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const caseNumber = readString(
    value.caseNumber ?? value.case_number,
  );

  if (!id || !caseNumber) return null;

  return {
    id,
    caseNumber,
    playerId: readString(value.playerId ?? value.player_id),
    game: readNullableString(value.game),
    sanctionType: readString(
      value.sanctionType ?? value.sanction_type,
    ),
    reason: readString(value.reason),
    notes: readNullableString(value.notes),
    status: readString(value.status),
    startedAt: readString(
      value.startedAt ?? value.started_at,
    ),
    durationSeconds: readNumber(
      value.durationSeconds ?? value.duration_seconds,
    ),
    expiresAt: readNullableString(
      value.expiresAt ?? value.expires_at,
    ),
    createdByDiscordId: readNullableString(
      value.createdByDiscordId ?? value.created_by_discord_id,
    ),
    createdAt: readString(
      value.createdAt ?? value.created_at,
    ),
    updatedAt: readString(
      value.updatedAt ?? value.updated_at,
    ),
  };
}

function PlayerFormFields({
  playerName,
  setPlayerName,
  discordName,
  setDiscordName,
  discordId,
  setDiscordId,
  internalNotes,
  setInternalNotes,
  saving,
}: {
  playerName: string;
  setPlayerName: (value: string) => void;
  discordName: string;
  setDiscordName: (value: string) => void;
  discordId: string;
  setDiscordId: (value: string) => void;
  internalNotes: string;
  setInternalNotes: (value: string) => void;
  saving: boolean;
}) {
  return (
    <>
      <label>
        Player Name
        <input
          type="text"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          maxLength={100}
          required
          disabled={saving}
          placeholder="Enter player name"
        />
      </label>

      <label>
        Discord Name
        <input
          type="text"
          value={discordName}
          onChange={(event) => setDiscordName(event.target.value)}
          maxLength={100}
          disabled={saving}
          placeholder="Optional"
        />
      </label>

      <label>
        Discord ID
        <input
          type="text"
          value={discordId}
          onChange={(event) => setDiscordId(event.target.value)}
          maxLength={20}
          disabled={saving}
          placeholder="Optional Discord user ID"
        />
      </label>

      <label>
        Internal Notes
        <textarea
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          maxLength={5000}
          rows={4}
          disabled={saving}
          placeholder="Optional internal information..."
        />
      </label>
    </>
  );
}

function PlayerRecordsContent({
  user,
}: {
  user: DiscordSessionUser;
}) {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [discordName, setDiscordName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [identityGame, setIdentityGame] = useState("");
  const [identityPlayerId, setIdentityPlayerId] = useState("");
  const [identityPlayerName, setIdentityPlayerName] = useState("");

  const [createInitialCase, setCreateInitialCase] = useState(false);
  const [initialGame, setInitialGame] = useState("");
  const [initialSanctionType, setInitialSanctionType] =
    useState("warning");
  const [initialReason, setInitialReason] = useState("");
  const [initialCaseNotes, setInitialCaseNotes] = useState("");
  const [initialDuration, setInitialDuration] = useState("");

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(
        `/api/records/players?${params.toString()}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      const payload = await fetchPayload(response);

      if (!response.ok) {
        throw new Error(
          getError(payload, "Unable to load player records."),
        );
      }

      const rawPlayers = Array.isArray(payload.players)
        ? payload.players
        : [];

      setPlayers(
        rawPlayers
          .map(normalizePlayer)
          .filter((player): player is PlayerRecord => player !== null),
      );

      const pagination = isRecord(payload.pagination)
        ? payload.pagination
        : {};

      setTotal(
        typeof pagination.total === "number"
          ? pagination.total
          : 0,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load player records.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, offset]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlayers();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loadPlayers]);

  function resetPlayerForm() {
    setPlayerName("");
    setDiscordName("");
    setDiscordId("");
    setInternalNotes("");
    setIdentityGame("");
    setIdentityPlayerId("");
    setIdentityPlayerName("");
    setCreateInitialCase(false);

    setInitialGame("");
    setInitialSanctionType("warning");
    setInitialReason("");
    setInitialCaseNotes("");
    setInitialDuration("");

    setFormError("");
  }

  async function fetchPlayerDetails(
    player: PlayerRecord,
  ): Promise<PlayerDetails> {
    const params = new URLSearchParams({
      playerId: player.id,
      limit: "100",
      offset: "0",
    });

    const response = await fetch(
      `/api/records/cases?${params.toString()}`,
      {
        credentials: "include",
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      window.location.replace("/");
      throw new Error("Authentication required.");
    }

    const payload = await fetchPayload(response);

    if (!response.ok) {
      throw new Error(
        getError(payload, "Unable to retrieve moderation history."),
      );
    }

    const rawCases = Array.isArray(payload.cases)
      ? payload.cases
      : [];

    const cases = rawCases
      .map(normalizeCase)
      .filter((caseRecord): caseRecord is ModerationCase => caseRecord !== null);

    return {
      player,
      identities: player.identities,
      cases,
    };
  }

  async function openPlayer(player: PlayerRecord) {
    setSelectedPlayer(null);
    setDetailsError("");
    setDetailsLoading(true);

    try {
      const details = await fetchPlayerDetails(player);
      setSelectedPlayer(details);
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to open player record.",
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshPlayerList() {
    await loadPlayers();
  }

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!identityGame.trim() || !identityPlayerId.trim()) {
      setFormError("Game Name and Player ID are required to identify this player record.");
      return;
    }

    setSaving(true);
    setFormError("");

    const sanctionNeedsDuration = createInitialCase && (
      initialSanctionType === "temporary_ban" ||
      initialSanctionType === "timeout");

    const durationValue = initialDuration.trim()
      ? Number(initialDuration)
      : null;

    if (
      sanctionNeedsDuration &&
      (!durationValue ||
        !Number.isInteger(durationValue) ||
        durationValue <= 0)
    ) {
      setFormError("A valid duration in seconds is required for this sanction.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/records/players", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName,
          discordName: discordName || null,
          discordId: discordId || null,
          internalNotes: internalNotes || null,
          identities: [{ game: identityGame, gamePlayerId: identityPlayerId, gamePlayerName: identityPlayerName || null }],
          ...(createInitialCase ? { initialCase: {
            game: initialGame || null,
            sanctionType: initialSanctionType,
            reason: initialReason,
            notes: initialCaseNotes || null,
            durationSeconds: durationValue,
          } } : {}),
        }),
      });

      const payload = await fetchPayload(response);

      if (!response.ok) {
        throw new Error(
          getError(payload, "Unable to create player record."),
        );
      }

      const createdPlayer = isRecord(payload.player)
        ? payload.player
        : {};

      const name = readString(
        createdPlayer.playerName ?? createdPlayer.player_name,
        playerName,
      );

      setCreateOpen(false);
      setSuccessMessage(payload.case
        ? `Player record for ${name} and its initial moderation case were created.`
        : `Player record for ${name} was created.`);

      resetPlayerForm();
      setOffset(0);

      await loadPlayers();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
      );
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>MODERATION DATABASE</span>

          <h1>
            Player <span>Records</span>
          </h1>

          <p>
            Manage player profiles, Discord identities and
            associated moderation history.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            resetPlayerForm();
            setCreateOpen(true);
          }}
        >
          <span>+</span> Create Player
        </button>
      </section>

      {successMessage && (
        <div className={styles.successNotice}>
          <span>{successMessage}</span>

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
          <span>TOTAL PLAYER RECORDS</span>
          <strong>{total}</strong>
        </div>

        <div className={styles.statCard}>
          <span>DISPLAYED RECORDS</span>
          <strong>{players.length}</strong>
        </div>

        <div className={styles.statCard}>
          <span>CURRENT PAGE</span>
          <strong>{currentPage}</strong>
        </div>
      </section>

      <section className={styles.recordsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>PLAYER DATABASE</span>
            <h2>All Player Records</h2>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void refreshPlayerList()}
          >
            ↻ Refresh
          </button>
        </div>

        <div className={styles.searchBar}>
          <span>⌕</span>

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search player name, Discord name or ID..."
            aria-label="Search player records"
          />
        </div>

        {error && (
          <div className={styles.errorNotice}>{error}</div>
        )}

        {loading ? (
          <div className={styles.loading}>
            <span className={styles.loader} />
            Loading player records...
          </div>
        ) : players.length === 0 ? (
          <div className={styles.empty}>
            <span>⌕</span>
            <h3>No player records found</h3>
            <p>
              Create a new player record or change your search.
            </p>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                resetPlayerForm();
                setCreateOpen(true);
              }}
            >
              Create Player
            </button>
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>PLAYER</th>
                    <th>DISCORD NAME</th>
                    <th>DISCORD ID</th>
                    <th>LAST UPDATED</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {players.map((player) => (
                    <tr key={player.id}>
                      <td>
                        <strong>{player.playerName}</strong>
                        <small>
                          Record ID: {player.id.slice(0, 8)}
                        </small>
                      </td>

                      <td>{player.discordName || "—"}</td>

                      <td>
                        <span className={styles.discordId}>
                          {player.discordId || "—"}
                        </span>
                      </td>

                      <td>{formatDate(player.updatedAt)}</td>

                      <td>
                        <button
                          type="button"
                          className={styles.viewButton}
                          onClick={() => void openPlayer(player)}
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
                {Math.min(offset + players.length, total)} of {total}
              </span>

              <div>
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() =>
                    setOffset(Math.max(0, offset - LIMIT))
                  }
                >
                  Previous
                </button>

                <strong>
                  {currentPage} / {totalPages}
                </strong>

                <button
                  type="button"
                  disabled={offset + LIMIT >= total}
                  onClick={() => setOffset(offset + LIMIT)}
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
            Loading player profile...
          </div>
        </div>
      )}

      {detailsError && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <h2>Unable to open player</h2>
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

      {selectedPlayer && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPlayer(null);
            }
          }}
        >
          <section
            className={`${styles.modal} ${styles.detailsModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-details-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>PLAYER PROFILE</span>

                <h2 id="player-details-title">
                  {selectedPlayer.player.playerName}
                </h2>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setSelectedPlayer(null)}
                aria-label="Close player profile"
              >
                ×
              </button>
            </div>

            <div className={styles.detailGrid}>
              <div>
                <span>PLAYER NAME</span>
                <strong>{selectedPlayer.player.playerName}</strong>
              </div>

              <div>
                <span>DISCORD NAME</span>
                <strong>
                  {selectedPlayer.player.discordName || "—"}
                </strong>
              </div>

              <div>
                <span>DISCORD ID</span>
                <strong className={styles.detailDiscordId}>
                  {selectedPlayer.player.discordId || "—"}
                </strong>
              </div>

              <div>
                <span>CREATED</span>
                <strong>
                  {formatDate(selectedPlayer.player.createdAt)}
                </strong>
              </div>

              <div>
                <span>LAST UPDATED</span>
                <strong>
                  {formatDate(selectedPlayer.player.updatedAt)}
                </strong>
              </div>

              <div>
                <span>MODERATION CASES</span>
                <strong>{selectedPlayer.cases.length}</strong>
              </div>
            </div>

            {selectedPlayer.player.internalNotes && (
              <div className={styles.detailBlock}>
                <h3>Internal Notes</h3>
                <p>{selectedPlayer.player.internalNotes}</p>
              </div>
            )}

            <div className={styles.detailBlock}>
              <div className={styles.subsectionHeader}>
                <div>
                  <h3>Game Identities</h3>
                  <span>
                    {selectedPlayer.identities.length} registered identities
                  </span>
                </div>
              </div>

              {selectedPlayer.identities.length === 0 ? (
                <div className={styles.emptySubsection}>
                  No additional game identities registered.
                </div>
              ) : (
                selectedPlayer.identities.map((identity) => (
                  <div className={styles.identityCard} key={identity.id}>
                    <div className={styles.identityInfo}>
                      <strong>
                        {identity.gamePlayerName || identity.gamePlayerId}
                      </strong>

                      <span>{identity.game}</span>

                      <small>{identity.gamePlayerId}</small>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.detailBlock}>
              <h3>
                Moderation History ({selectedPlayer.cases.length})
              </h3>

              {selectedPlayer.cases.length === 0 ? (
                <div className={styles.emptySubsection}>
                  No moderation cases recorded.
                </div>
              ) : (
                selectedPlayer.cases.map((caseRecord) => (
                  <div
                    className={styles.caseItem}
                    key={caseRecord.id}
                  >
                    <div>
                      <strong>{caseRecord.caseNumber}</strong>

                      <span>
                        {SANCTION_LABELS[caseRecord.sanctionType] ||
                          caseRecord.sanctionType}
                      </span>
                    </div>

                    <span
                      className={`${styles.status} ${getStatusClass(
                        caseRecord.status,
                      )}`}
                    >
                      {caseRecord.status}
                    </span>

                    <p>{caseRecord.reason}</p>

                    {caseRecord.game && (
                      <small>Game: {caseRecord.game}</small>
                    )}

                    <small>
                      {formatDate(caseRecord.createdAt)}
                      {caseRecord.durationSeconds !== null
                        ? ` · ${formatDuration(caseRecord.durationSeconds)}`
                        : ""}
                    </small>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {createOpen && (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-player-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>NEW PLAYER</span>
                <h2 id="create-player-title">Create Player Record</h2>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                disabled={saving}
                onClick={() => setCreateOpen(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className={styles.errorNotice}>{formError}</div>
            )}

            <form onSubmit={createPlayer}>
              <PlayerFormFields
                playerName={playerName}
                setPlayerName={setPlayerName}
                discordName={discordName}
                setDiscordName={setDiscordName}
                discordId={discordId}
                setDiscordId={setDiscordId}
                internalNotes={internalNotes}
                setInternalNotes={setInternalNotes}
                saving={saving}
              />

              <div className={styles.detailBlock}>
                <h3>Primary Game Identity</h3>
                <p>The player record is matched by the normalized game name and Player ID. Discord details remain optional contact information.</p>
              </div>
              <label>Game Name<input value={identityGame} onChange={(event) => setIdentityGame(event.target.value)} maxLength={100} required disabled={saving} placeholder="e.g. FiveM" /></label>
              <label>Player ID<input value={identityPlayerId} onChange={(event) => setIdentityPlayerId(event.target.value)} maxLength={120} required disabled={saving} placeholder="Exact in-game identifier" /></label>
              <label>In-game Name (optional)<input value={identityPlayerName} onChange={(event) => setIdentityPlayerName(event.target.value)} maxLength={100} disabled={saving} placeholder="Current in-game display name" /></label>

              <label className={styles.checkLabel}><input type="checkbox" checked={createInitialCase} onChange={(event) => setCreateInitialCase(event.target.checked)} disabled={saving} />Create an initial moderation case now</label>

              {createInitialCase && <>
              <div className={styles.detailBlock}>
                <h3>Initial Moderation Case</h3>
                <p>Use this when a case is ready to be documented. Player records can also be created without a sanction.</p>
              </div>
              <label>
                Game / Platform
                <input
                  type="text"
                  value={initialGame}
                  onChange={(event) => setInitialGame(event.target.value)}
                  maxLength={100}
                  disabled={saving}
                  placeholder="Optional, e.g. FiveM"
                />
              </label>

              <label>
                Sanction Type
                <select
                  value={initialSanctionType}
                  onChange={(event) =>
                    setInitialSanctionType(event.target.value)
                  }
                  disabled={saving}
                  required
                >
                  {Object.entries(SANCTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Reason
                <textarea
                  value={initialReason}
                  onChange={(event) => setInitialReason(event.target.value)}
                  maxLength={5000}
                  rows={3}
                  required
                  disabled={saving}
                  placeholder="Explain the reason for this moderation case..."
                />
              </label>

              {(initialSanctionType === "temporary_ban" ||
                initialSanctionType === "timeout") && (
                <label>
                  Duration (seconds)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={initialDuration}
                    onChange={(event) =>
                      setInitialDuration(event.target.value)
                    }
                    required
                    disabled={saving}
                    placeholder="e.g. 86400"
                  />
                </label>
              )}

              <label>
                Case Notes
                <textarea
                  value={initialCaseNotes}
                  onChange={(event) =>
                    setInitialCaseNotes(event.target.value)
                  }
                  maxLength={5000}
                  rows={3}
                  disabled={saving}
                  placeholder="Optional internal case notes..."
                />
              </label>
              </>}

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  disabled={saving}
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={saving}
                >
                  {saving ? "Creating..." : createInitialCase ? "Create Player & Case" : "Create Player Record"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default function PlayerRecordsPage() {
  return (
    <PortalShell access="trailModerator">
      {(user) => <PlayerRecordsContent user={user} />}
    </PortalShell>
  );
}

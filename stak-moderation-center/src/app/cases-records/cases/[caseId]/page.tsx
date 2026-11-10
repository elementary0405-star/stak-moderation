"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";

type ModerationCase = {
  id: string;
  caseNumber: string;
  playerId: string;
  playerName: string;
  discordName: string | null;
  discordId: string | null;
  game: string | null;
  sanctionType: string;
  reason: string;
  notes: string | null;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  expiresAt: string | null;
  liftedAt: string | null;
  liftedByDiscordId: string | null;
  liftedReason: string | null;
  createdByDiscordId: string | null;
  createdAt: string;
  identities: Array<{
    id: string;
    game: string;
    gamePlayerId: string;
    gamePlayerName: string | null;
  }>;
  evidence: Evidence[];
};

type Evidence = {
  id: string;
  fileName: string | null;
  evidenceUrl: string | null;
  description: string | null;
  uploadedByDiscordId: string | null;
  createdAt: string;
};

const SANCTION_LABELS: Record<string, string> = {
  permanent_ban: "Permanenter Bann",
  temporary_ban: "Temporärer Bann",
  unban: "Entbannung",
  kick: "Kick",
  timeout: "Timeout",
  warning: "Verwarnung",
  project_exclusion: "Projektausschluss",
  other: "Sonstige Maßnahme",
};

function formatDate(value: string | null): string {
  if (!value) return "–";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "–";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Unbegrenzt";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];

  if (days) parts.push(`${days} Tag${days !== 1 ? "e" : ""}`);
  if (hours) parts.push(`${hours} Std.`);
  if (minutes) parts.push(`${minutes} Min.`);

  return parts.length ? parts.join(", ") : "Unter einer Minute";
}

function normalizeCase(value: Record<string, unknown>): ModerationCase {
  const identities = Array.isArray(value.identities)
    ? value.identities
    : [];

  const evidence = Array.isArray(value.evidence)
    ? value.evidence
    : [];

  return {
    id: String(value.id ?? ""),
    caseNumber: String(value.caseNumber ?? value.case_number ?? ""),
    playerId: String(value.playerId ?? value.player_id ?? ""),
    playerName: String(value.playerName ?? value.player_name ?? ""),
    discordName: (value.discordName ?? value.discord_name ?? null) as string | null,
    discordId: (value.discordId ?? value.discord_id ?? null) as string | null,
    game: (value.game ?? null) as string | null,
    sanctionType: String(value.sanctionType ?? value.sanction_type ?? ""),
    reason: String(value.reason ?? ""),
    notes: (value.notes ?? null) as string | null,
    status: String(value.status ?? ""),
    startedAt: String(value.startedAt ?? value.started_at ?? ""),
    durationSeconds: (value.durationSeconds ?? value.duration_seconds ?? null) as number | null,
    expiresAt: (value.expiresAt ?? value.expires_at ?? null) as string | null,
    liftedAt: (value.liftedAt ?? value.lifted_at ?? null) as string | null,
    liftedByDiscordId: (value.liftedByDiscordId ?? value.lifted_by_discord_id ?? null) as string | null,
    liftedReason: (value.liftedReason ?? value.lifted_reason ?? null) as string | null,
    createdByDiscordId: (value.createdByDiscordId ?? value.created_by_discord_id ?? null) as string | null,
    createdAt: String(value.createdAt ?? value.created_at ?? ""),
    identities: identities.map((item: Record<string, unknown>) => ({
      id: String(item.id ?? ""),
      game: String(item.game ?? ""),
      gamePlayerId: String(item.gamePlayerId ?? item.game_player_id ?? ""),
      gamePlayerName: (item.gamePlayerName ?? item.game_player_name ?? null) as string | null,
    })),
    evidence: evidence.map((item: Record<string, unknown>) => ({
      id: String(item.id ?? ""),
      fileName: (item.fileName ?? item.file_name ?? null) as string | null,
      evidenceUrl: (item.evidenceUrl ?? item.evidence_url ?? null) as string | null,
      description: (item.description ?? null) as string | null,
      uploadedByDiscordId: (item.uploadedByDiscordId ?? item.uploaded_by_discord_id ?? null) as string | null,
      createdAt: String(item.createdAt ?? item.created_at ?? ""),
    })),
  };
}

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [caseRecord, setCaseRecord] = useState<ModerationCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [game, setGame] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [addingEvidence, setAddingEvidence] = useState(false);

  const loadCase = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/records/cases/${encodeURIComponent(caseId)}`,
        { cache: "no-store" },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Der Moderationsfall konnte nicht geladen werden.",
        );
      }

      const rawCase = payload.case ?? payload;

      const normalized = normalizeCase(
        rawCase as Record<string, unknown>,
      );

      setCaseRecord(normalized);
      setGame(normalized.game ?? "");
      setReason(normalized.reason);
      setNotes(normalized.notes ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ein unbekannter Fehler ist aufgetreten.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!caseRecord) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/records/cases/${encodeURIComponent(caseId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            game,
            reason,
            notes,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Der Moderationsfall konnte nicht gespeichert werden.",
        );
      }

      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Der Moderationsfall konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!evidenceUrl.trim()) return;

    setAddingEvidence(true);
    setError("");

    try {
      const response = await fetch("/api/records/evidence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId,
          evidenceUrl: evidenceUrl.trim(),
          description: evidenceDescription.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Der Nachweis konnte nicht hinzugefügt werden.",
        );
      }

      setEvidenceUrl("");
      setEvidenceDescription("");

      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Der Nachweis konnte nicht hinzugefügt werden.",
      );
    } finally {
      setAddingEvidence(false);
    }
  }

  if (loading) {
    return (
      <PortalShell access="trailModerator">
        <main className="mx-auto max-w-6xl p-6">
          <p className="text-sm text-gray-400">
            Moderationsfall wird geladen ...
          </p>
        </main>
      </PortalShell>
    );
  }

  if (!caseRecord) {
    return (
      <PortalShell access="trailModerator">
        <main className="mx-auto max-w-6xl space-y-4 p-6">
          <h1 className="text-2xl font-semibold">
            Moderationsfall
          </h1>
          <p className="text-sm text-red-300">
            {error || "Der Moderationsfall wurde nicht gefunden."}
          </p>
          <a
            href="/case/records/cases"
            className="inline-block rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
          >
            Zurück zur Übersicht
          </a>
        </main>
      </PortalShell>
    );
  }

  return (
    <PortalShell access="trailModerator">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a
              href="/case/records/cases"
              className="text-sm text-gray-400 hover:text-white"
            >
              ← Moderationsfälle
            </a>
            <h1 className="mt-2 text-2xl font-semibold">
              {caseRecord.caseNumber}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Moderationsfall für {caseRecord.playerName}
            </p>
          </div>

          <span className="rounded-full border border-white/10 px-3 py-1.5 text-sm">
            {caseRecord.status}
          </span>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-5">
            <h2 className="mb-4 text-lg font-semibold">
              Spielerinformationen
            </h2>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Spielername</dt>
                <dd>{caseRecord.playerName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Discord-Name</dt>
                <dd>{caseRecord.discordName || "–"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Discord-Kennung</dt>
                <dd>{caseRecord.discordId || "–"}</dd>
              </div>
            </dl>

            {caseRecord.identities.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <h3 className="mb-3 text-sm font-medium">
                  Spielidentitäten
                </h3>

                <div className="space-y-2">
                  {caseRecord.identities.map((identity) => (
                    <div
                      key={identity.id}
                      className="rounded-lg bg-white/5 p-3 text-sm"
                    >
                      <div className="font-medium">{identity.game}</div>
                      <div className="text-gray-400">
                        {identity.gamePlayerName || identity.gamePlayerId}
                      </div>
                      <div className="text-xs text-gray-500">
                        {identity.gamePlayerId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 p-5">
            <h2 className="mb-4 text-lg font-semibold">
              Falldetails
            </h2>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Maßnahme</dt>
                <dd>
                  {SANCTION_LABELS[caseRecord.sanctionType] ??
                    caseRecord.sanctionType}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Beginn</dt>
                <dd>{formatDate(caseRecord.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Dauer</dt>
                <dd>{formatDuration(caseRecord.durationSeconds)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Ablaufdatum</dt>
                <dd>{formatDate(caseRecord.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Erstellt am</dt>
                <dd>{formatDate(caseRecord.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Erstellt von</dt>
                <dd>{caseRecord.createdByDiscordId || "–"}</dd>
              </div>
            </dl>

            {caseRecord.liftedAt && (
              <div className="mt-5 border-t border-white/10 pt-4 text-sm">
                <h3 className="mb-2 font-medium">Aufhebung</h3>
                <p className="text-gray-400">
                  Aufgehoben am: {formatDate(caseRecord.liftedAt)}
                </p>
                <p className="mt-1 text-gray-400">
                  Aufgehoben von: {caseRecord.liftedByDiscordId || "–"}
                </p>
                {caseRecord.liftedReason && (
                  <p className="mt-2">{caseRecord.liftedReason}</p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 p-5">
          <h2 className="mb-4 text-lg font-semibold">
            Moderationsdokumentation
          </h2>

          <form onSubmit={saveCase} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-gray-400">Spiel / Plattform</span>
              <input
                value={game}
                onChange={(event) => setGame(event.target.value)}
                maxLength={50}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-gray-400">Begründung</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                maxLength={5000}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-gray-400">Interne Notizen</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={10000}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !reason.trim()}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {saving ? "Wird gespeichert ..." : "Änderungen speichern"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-white/10 p-5">
          <h2 className="mb-4 text-lg font-semibold">
            Nachweise
          </h2>

          {caseRecord.evidence.length === 0 ? (
            <p className="text-sm text-gray-400">
              Für diesen Fall wurden noch keine Nachweise hinterlegt.
            </p>
          ) : (
            <div className="mb-5 space-y-3">
              {caseRecord.evidence.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 p-3"
                >
                  <a
                    href={item.evidenceUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-blue-300 hover:underline"
                  >
                    {item.fileName || item.evidenceUrl || "Nachweis"}
                  </a>

                  {item.description && (
                    <p className="mt-2 text-sm text-gray-400">
                      {item.description}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-500">
                    Hinzugefügt: {formatDate(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={addEvidence}
            className="space-y-3 border-t border-white/10 pt-5"
          >
            <h3 className="text-sm font-medium">
              Nachweis hinzufügen
            </h3>

            <input
              type="url"
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              required
              placeholder="HTTPS-Link zum Nachweis"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />

            <input
              value={evidenceDescription}
              onChange={(event) =>
                setEvidenceDescription(event.target.value)
              }
              maxLength={2000}
              placeholder="Beschreibung (optional)"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingEvidence || !evidenceUrl.trim()}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {addingEvidence ? "Wird hinzugefügt ..." : "Nachweis hinzufügen"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </PortalShell>
  );
}
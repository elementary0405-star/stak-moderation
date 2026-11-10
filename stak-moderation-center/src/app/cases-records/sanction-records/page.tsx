"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import PortalShell from "@/components/portal/PortalShell";

type Sanction = {
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
  effectiveStatus: string;
  startedAt: string;
  expiresAt: string | null;
  durationSeconds: number | null;
  createdByDiscordId: string | null;
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
  if (!seconds) return "Unbegrenzt";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];

  if (days) parts.push(`${days} Tag${days !== 1 ? "e" : ""}`);
  if (hours) parts.push(`${hours} Std.`);
  if (minutes) parts.push(`${minutes} Min.`);

  return parts.length ? parts.join(", ") : "Unter einer Minute";
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Aktiv";
    case "expired":
      return "Abgelaufen";
    case "lifted":
      return "Aufgehoben";
    case "completed":
      return "Abgeschlossen";
    default:
      return status;
  }
}

export default function SanctionsPage() {
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sanctionType, setSanctionType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSanction, setSelectedSanction] =
    useState<Sanction | null>(null);
  const [liftReason, setLiftReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSanctions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: "100",
        offset: "0",
      });

      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (sanctionType) params.set("sanctionType", sanctionType);

      const response = await fetch(
        `/api/records/sanctions?${params.toString()}`,
        { cache: "no-store" },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Sanktionen konnten nicht geladen werden.",
        );
      }

      setSanctions(Array.isArray(payload.sanctions) ? payload.sanctions : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ein unbekannter Fehler ist aufgetreten.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, sanctionType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSanctions();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadSanctions]);

  async function liftSanction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSanction || !liftReason.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/records/sanctions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: selectedSanction.id,
          reason: liftReason.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Die Sanktion konnte nicht aufgehoben werden.",
        );
      }

      setSelectedSanction(null);
      setLiftReason("");

      await loadSanctions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Die Sanktion konnte nicht aufgehoben werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell access="trailModerator">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Sanktionsverwaltung
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Übersicht aller erfassten Moderationsmaßnahmen.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSanctions()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
          >
            Aktualisieren
          </button>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Fallnummer, Spieler oder Grund suchen ..."
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm outline-none"
          >
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="expired">Abgelaufen</option>
            <option value="lifted">Aufgehoben</option>
            <option value="completed">Abgeschlossen</option>
          </select>

          <select
            value={sanctionType}
            onChange={(event) => setSanctionType(event.target.value)}
            className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm outline-none"
          >
            <option value="">Alle Maßnahmen</option>
            {Object.entries(SANCTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </section>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-white/10">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">
              Sanktionen werden geladen ...
            </p>
          ) : sanctions.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">
              Keine passenden Sanktionen gefunden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fallnummer</th>
                    <th className="px-4 py-3 font-medium">Spieler</th>
                    <th className="px-4 py-3 font-medium">Maßnahme</th>
                    <th className="px-4 py-3 font-medium">Beginn</th>
                    <th className="px-4 py-3 font-medium">Dauer</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Aktion</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {sanctions.map((sanction) => (
                    <tr key={sanction.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono">
                        {sanction.caseNumber}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {sanction.playerName}
                        </div>
                        {sanction.discordName && (
                          <div className="text-xs text-gray-500">
                            {sanction.discordName}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {SANCTION_LABELS[sanction.sanctionType] ??
                          sanction.sanctionType}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(sanction.startedAt)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDuration(sanction.durationSeconds)}
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 px-2 py-1 text-xs">
                          {statusLabel(
                            sanction.effectiveStatus || sanction.status,
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {sanction.effectiveStatus === "active" &&
                          sanction.status === "active" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSanction(sanction);
                                setLiftReason("");
                              }}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                            >
                              Aufheben
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedSanction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form
              onSubmit={liftSanction}
              className="w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-gray-950 p-6 shadow-2xl"
            >
              <div>
                <h2 className="text-lg font-semibold">
                  Sanktion aufheben
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {selectedSanction.caseNumber} · {selectedSanction.playerName}
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-gray-300">
                  Begründung für die Aufhebung
                </span>
                <textarea
                  value={liftReason}
                  onChange={(event) => setLiftReason(event.target.value)}
                  required
                  maxLength={5000}
                  rows={4}
                  placeholder="Begründung eingeben ..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setSelectedSanction(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                >
                  Abbrechen
                </button>

                <button
                  type="submit"
                  disabled={submitting || !liftReason.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Wird gespeichert ..." : "Sanktion aufheben"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </PortalShell>
  );
}
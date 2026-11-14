"use client";

import { useCallback, useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { getApiError, getApiArray, readApiObject } from "@/lib/client-api";

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
  createdByDiscordId: string | null;
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

export default function CasesPage() {
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sanctionType, setSanctionType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCases = useCallback(async () => {
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
        `/api/records/cases?${params.toString()}`,
        { cache: "no-store" },
      );

      const payload = await readApiObject(response);

      if (!response.ok) {
        throw new Error(
          getApiError(payload, "Moderationsfälle konnten nicht geladen werden."),
        );
      }

      setCases(getApiArray<ModerationCase>(payload, "cases"));
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
      void loadCases();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadCases]);

  return (
    <PortalShell access="trailModerator">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Moderationsfälle
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Übersicht aller dokumentierten Moderationsfälle.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadCases()}
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
              Moderationsfälle werden geladen ...
            </p>
          ) : cases.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">
              Keine Moderationsfälle gefunden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fallnummer</th>
                    <th className="px-4 py-3 font-medium">Spieler</th>
                    <th className="px-4 py-3 font-medium">Maßnahme</th>
                    <th className="px-4 py-3 font-medium">Grund</th>
                    <th className="px-4 py-3 font-medium">Beginn</th>
                    <th className="px-4 py-3 font-medium">Dauer</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {cases.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-4 py-3 font-mono">
                        {item.caseNumber}
                        <a className="ml-2 text-blue-300 hover:underline" href={`/cases-records/cases/${encodeURIComponent(item.id)}`}>Open</a>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{item.playerName}</div>
                        {item.discordName && (
                          <div className="text-xs text-gray-500">
                            {item.discordName}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {SANCTION_LABELS[item.sanctionType] ??
                          item.sanctionType}
                      </td>

                      <td className="max-w-xs px-4 py-3">
                        <span className="block truncate" title={item.reason}>
                          {item.reason}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(item.startedAt)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDuration(item.durationSeconds)}
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 px-2 py-1 text-xs">
                          {statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500">
          Angezeigt werden maximal 100 Fälle pro Abfrage.
        </p>
      </main>
    </PortalShell>
  );
}
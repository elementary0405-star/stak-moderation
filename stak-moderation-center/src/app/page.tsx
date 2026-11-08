"use client";

import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-[#090d16] text-white flex">

      {/* Linke Informationsseite */}
      <section className="hidden lg:flex w-1/2 min-h-screen flex-col justify-between p-16 border-r border-white/10 relative overflow-hidden">

        <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] top-20 left-10" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-600/20">
              S
            </div>

            <div>
              <h1 className="font-bold text-lg tracking-wide">
                STAK
              </h1>
              <p className="text-xs text-gray-500 tracking-[0.2em]">
                MODERATION CENTER
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Zentrale Moderationsverwaltung
          </div>

          <h2 className="text-5xl font-bold leading-tight mb-6">
            Alles im Blick.
            <br />
            <span className="text-blue-500">
              Alles dokumentiert.
            </span>
          </h2>

          <p className="text-gray-400 text-lg leading-8 max-w-lg">
            Verwalte Spielerprofile, dokumentiere Moderationsfälle
            und behalte sämtliche Aktivitäten deiner Projekte
            zentral an einem Ort im Überblick.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-12">

            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-blue-400 text-2xl mb-3">01</div>
              <h3 className="font-semibold mb-1">Spielerprofile</h3>
              <p className="text-sm text-gray-500">
                Zentrale Verwaltung aller Spielerdaten.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-blue-400 text-2xl mb-3">02</div>
              <h3 className="font-semibold mb-1">Moderationsfälle</h3>
              <p className="text-sm text-gray-500">
                Nachvollziehbare Dokumentation aller Maßnahmen.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-blue-400 text-2xl mb-3">03</div>
              <h3 className="font-semibold mb-1">Teamverwaltung</h3>
              <p className="text-sm text-gray-500">
                Individuelle Rollen und Berechtigungen.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-blue-400 text-2xl mb-3">04</div>
              <h3 className="font-semibold mb-1">Aktivitätsprotokoll</h3>
              <p className="text-sm text-gray-500">
                Änderungen und Vorgänge nachvollziehen.
              </p>
            </div>

          </div>
        </div>

        <div className="relative z-10 text-xs text-gray-600">
          STAK Moderation Center · Zentrale Projektverwaltung
        </div>

      </section>

      {/* Rechte Anmeldeseite */}
      <section className="flex-1 min-h-screen flex items-center justify-center p-6 relative">

        <div className="absolute w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[130px] bottom-0 right-0" />

        <div className="relative z-10 w-full max-w-md">

          <div className="lg:hidden flex items-center gap-3 mb-16">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl">
              S
            </div>

            <div>
              <h1 className="font-bold text-lg">STAK</h1>
              <p className="text-xs text-gray-500 tracking-[0.2em]">
                MODERATION CENTER
              </p>
            </div>
          </div>

          <div className="mb-10">
            <div className="text-sm text-blue-400 font-medium mb-3">
              WILLKOMMEN ZURÜCK
            </div>

            <h2 className="text-3xl font-bold mb-3">
              Anmeldung
            </h2>

            <p className="text-gray-400 leading-6">
              Melde dich mit deinen persönlichen Zugangsdaten
              an, um auf das Moderation Center zuzugreifen.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
            }}
            className="space-y-6"
          >

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Benutzername
              </label>

              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Dein Benutzername"
                autoComplete="username"
                className="w-full h-13 px-4 rounded-xl bg-[#111827] border border-white/10 text-white placeholder:text-gray-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-300">
                  Passwort
                </label>
              </div>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Dein Passwort"
                autoComplete="current-password"
                className="w-full h-13 px-4 rounded-xl bg-[#111827] border border-white/10 text-white placeholder:text-gray-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full h-13 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-semibold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              Anmelden
              <span>→</span>
            </button>

          </form>

          <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <div className="flex items-start gap-3">
              <div className="text-blue-400 mt-0.5">ⓘ</div>

              <p className="text-xs text-gray-500 leading-5">
                Der Zugang ist ausschließlich für autorisierte
                Teammitglieder vorgesehen. Deine Zugangsdaten
                dürfen nicht an andere Personen weitergegeben werden.
              </p>
            </div>
          </div>

          <div className="mt-12 flex justify-between text-xs text-gray-600">
            <span>STAK Moderation Center</span>
            <span>Geschützter Teamzugang</span>
          </div>

        </div>
      </section>

    </main>
  );
}
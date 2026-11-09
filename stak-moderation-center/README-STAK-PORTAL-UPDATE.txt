STAK Moderation Center – Portal Update

ZIELORDNER
Entpacke diesen Ordnerinhalt in:
C:\Users\hagen\Documents\GitHub\stak-moderation\stak-moderation-center

WICHTIG
- Die vorhandenen Dateien src/lib/auth.ts, src/app/api/auth/me/route.ts,
  src/app/dashboard/page.tsx und src/app/dashboard/dashboard.module.css werden ersetzt.
- Die übrigen Dateien werden neu angelegt.
- Andere Projektdateien (package.json, wrangler.jsonc, Vinext-Konfiguration,
  OAuth-Callback, Logout-Route, discord-roles.ts usw.) bleiben unverändert.
- Das Paket enthält die neue Portal-Oberfläche, Navigation, Rollenansichten,
  Unterseiten-Platzhalter, die Live-Rollenprüfung gegen Discord und die
  Bestätigungsabfrage vor dem Abmelden.

ROLLEN
- Community Member: Apply und Community Guidelines.
- Staff: Team Hub, Cases & Records und Staff Resources.
- Trail-Moderator und höhere Staff-Ränge: zusätzlich Staff Training und Cases & Records.
- Staff Manager und höhere Ränge: Verwaltungsbereiche im Team Hub.
- Feedback Inbox: exakt Owner.
- Die bestehende Rollen-Priorität bleibt erhalten.

SICHERHEIT / LIVE-SYNC
Die API /api/auth/me fragt bei jedem Aufruf die aktuelle Mitgliedschaft und
STAK-Rollen beim Discord-Server ab. Wenn das Konto nicht mehr Mitglied ist
oder keine STAK-Rolle besitzt, wird die lokale Session widerrufen. Wenn
Discord vorübergehend nicht erreichbar ist, wird keine alte Rolle als
verifiziert ausgegeben; das Portal zeigt stattdessen einen Prüfungsfehler.

NOCH NICHT FUNKTIONSFERTIG
Die neuen Team Hub-, Cases-, Applications-, Absence-, Feedback-, Warning-,
Growth- und Staff-Ticket-Seiten sind derzeit bewusst gekennzeichnete
Struktur-/Designseiten. Sie speichern noch keine Daten und senden noch keine
Discord-Nachrichten. Dafür werden als nächster Entwicklungsschritt sichere
D1-Tabellen, geschützte API-Routen und die Bot-Anbindung eingerichtet.
Für neue Daten-APIs ist der Helfer authorizePortalRequest in
src/lib/portal-api-auth.ts vorgesehen. Er soll vor jedem Lesen oder Schreiben
vertraulicher Daten aufgerufen werden.
Die Staff Training Seite wartet auf die bestätigte Moodle/Gnomio-Kursadresse.
Die Community Guidelines müssen noch mit dem tatsächlichen Regelwerk befüllt
werden.

NACH DEM ENTPACKEN
1. Speichere alle Dateien.
2. Öffne PowerShell im Projektordner.
3. Führe npm run build:vinext aus.
4. Schicke mir die vollständige Ausgabe, falls Build-Fehler erscheinen.
5. Noch nicht deployen, bevor der lokale Build geprüft wurde.

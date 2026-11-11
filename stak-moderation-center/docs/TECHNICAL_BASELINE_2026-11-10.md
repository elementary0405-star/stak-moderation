# STAK Moderation Center – technische Bestandsaufnahme

**Prüfdatum:** 10. November 2026  
**Grundlage:** `STAK-Moderation-Projekt.zip` und `STAK_Staff_Qualification_Masterpaket(1).zip`  
**Status:** Analyse des gelieferten Quellstands; noch kein Deployment und keine Änderung an einer Cloudflare-Datenbank.

## 1. Eingegangene Pakete

- Das Website-Archiv ist lesbar und enthält 224 Einträge. Die ZIP-Prüfsumme/CRC-Prüfung ist erfolgreich; die Ordnerpfade sind grundsätzlich erhalten.
- Das Ausbildungs-Masterpaket enthält 18 Dateien. README, Manifest, Curriculum und die Einzelunterlagen wurden ausgewertet.
- In der Website-ZIP befindet sich kein `.env`-Dateiinhalt. Zugangsdaten sollten weiterhin ausschließlich lokal bzw. als Cloudflare-Secrets liegen.

## 2. Welcher Projektordner ist die aktive Grundlage?

Die aktive Website liegt im Archiv unter `stak-moderation-center/`. Dort befindet sich die aktuelle Next-/React-Anwendung mit den bestehenden Portal-Seiten und API-Routen.

Innerhalb dieses Ordners liegen außerdem zwei weitere verschachtelte Projektkopien (`stak-moderation-center/stak-moderation-center/` und `stak moderation-center/stak-moderation-center/`). Diese haben eigene `package.json`-Dateien und andere Projektstände. Sie sollten nicht versehentlich als zweite aktive Website weiterentwickelt werden. Vor der Bereinigung werden sie als Alt-/Referenzstände behandelt und nicht stillschweigend gelöscht.

## 3. Bereits vorhandene Bereiche

Im aktiven Projekt gibt es bereits umfangreiche Grundlagen für:

- Discord-OAuth-Anmeldung und Rollenmodell;
- Dashboard, Team Hub und Staff-Verzeichnis;
- Abwesenheiten, Staff-Warnungen und Feedback;
- Cases & Records, Player Records, Sanktionen und Belegverweise;
- Handbook-/Ticket-Guide-Verweise und Staff Resources;
- vorbereitete Staff-Training-Seite.

Ein Teil davon enthält bereits echte UI- und API-Logik. Andere Seiten sind ausdrücklich nur Struktur- oder Platzhalterseiten. Diese Unterscheidung muss bei der Umsetzung beachtet werden; eine vorhandene Seite ist nicht automatisch ein fertiges System.

## 4. Kritische Befunde, die vor einem größeren Ausbau behoben werden müssen

### A. Öffentliche Bewerbung und Richtlinien sind aktuell nicht öffentlich nutzbar

`/apply` und `/community-guidelines` werden derzeit über `PortalShell` geschützt. `PortalShell` verlangt eine Discord-Sitzung und leitet nicht angemeldete Besucher zurück zur Startseite. Das widerspricht dem geplanten öffentlichen Ablauf, bei dem Besucher zuerst die Richtlinien lesen und akzeptieren und danach die Bewerbung öffnen können.

Beide Seiten sind außerdem noch Platzhalter. Es gibt im aktiven `schema.sql` keine Tabellen für Bewerbungen, Antworten, Richtlinienversionen oder dokumentierte Bestätigungen.

### B. Discord-Rollen werden nicht live neu geprüft

`getFreshDiscordSession()` ruft derzeit nur `getDiscordSession()` auf. Die gespeicherte Rolle stammt daher vom Zeitpunkt der Anmeldung und bleibt während der bis zu 30-tägigen Sitzung unverändert. Das passt nicht zur Aussage in `README-STAK-PORTAL-UPDATE.txt`, dass aktuelle Mitgliedschaft und STAK-Rollen bei `/api/auth/me` live geprüft werden.

Das ist ein sicherheitsrelevanter Widerspruch: Wird eine Rolle entzogen oder ein Konto aus dem Server entfernt, kann die alte Portalberechtigung bis zum Ablauf der Sitzung weiterbestehen. Die Aktualisierung muss zentral, rate-limit-bewusst und fehlersicher umgesetzt werden.

### C. Zwei API-Dateien sind auffällig

- `src/app/api/auth/login/route.ts` ist vollständig leer.
- Die Logik für `GET` und `POST` unter `src/app/api/staff/warnings/` liegt in einer Datei namens `warnings` statt in `route.ts`. Next.js erkennt diese Datei damit nicht als Route Handler. Die Oberfläche kann dadurch beim Abrufen oder Anlegen von Staff-Warnungen auf eine nicht vorhandene API treffen.

### D. Datenbank- und Migrationsstand ist nicht konsistent dokumentiert

- `schema.sql` lässt sich als SQLite-Schema syntaktisch ausführen.
- Die API zum Anlegen von Fällen verwendet `case_counters`; diese Tabelle ist im gelieferten `schema.sql` nicht enthalten.
- Die Migrationen `0002` bis `0004` liegen unter `migrations/migrations/`, während die aktive `wrangler.jsonc` keinen passenden `migrations_dir`-/`migrations_pattern`-Eintrag enthält.
- `0002_update_roles.sql` erwartet Spalten der älteren `staff_users`-Tabelle, die nicht zum gelieferten `schema.sql` passen. Diese Migration darf daher nicht blind auf eine bestehende Datenbank angewandt werden.
- `wrangler.jsonc` und `cloudflare.config.ts` enthalten unterschiedliche Worker-/Asset-Konfigurationen. Die produktive Build- und Deployment-Route muss eindeutig festgelegt und getestet werden.

**Wichtig:** Es wurde keine Remote-Datenbank angesprochen, keine Migration ausgeführt und kein Deployment gestartet.

### E. Buildprüfung ist mit dem Archiv allein noch nicht möglich

Das Archiv enthält kein `node_modules` und keinen `.cloudflare/types`-Generierungsordner. Eine lokale TypeScript-Prüfung konnte deshalb fehlende Projektabhängigkeiten und generierte Cloudflare-Typen nicht auflösen. Das ist kein erfolgreicher Buildnachweis und auch kein Beweis für einen Quellcodefehler. Vor einem finalen Paket müssen Abhängigkeiten installiert, Cloudflare-Typen generiert und der vorgesehene Vinext-/Cloudflare-Build tatsächlich ausgeführt werden.

## 5. Ausbildungs-Masterpaket – verbindliche Architektur

Das Masterpaket empfiehlt eine eigenständige Moodle-/Gnomio-Ausbildung mit:

- einem gemeinsamen Pflichtkern;
- rollenbezogenen Lernpfaden;
- Moodle Book für zusammenhängende Lerntexte;
- Quiz und Fragenbank für Wissensprüfungen;
- Assignment für manuell bewertete Praxisfälle;
- Trainer-/Staff-Manager-Bestätigung vor der vollständigen Einsatzfreigabe.

Die Website sollte Moodle nicht nachbauen. Sie sollte die Academy sauber verlinken und – sofern Gnomio und Moodle-Webservices es zulassen – nur bestätigte Statusinformationen übernehmen. Ohne eingerichtete Moodle-Schnittstelle darf die Website keinen Kursabschluss vortäuschen.

Das Masterpaket kennzeichnet außerdem mehrere STAK-Details als „zu bestätigen“: konkrete Sanktionsmatrix, Rechte je Rolle, Staff-Report-Eskalation, interne Klickwege, Warnfolgen und Datenschutz-/Aufbewahrungsregeln. Diese Punkte werden nicht als feste Regeln in die Plattform eingebaut, solange sie nicht bestätigt sind.

## 6. Geplanter Bewerbungsablauf

1. Besucher öffnet den öffentlichen Bereich.
2. Die Richtlinien sind vollständig lesbar und in einer klaren Version gekennzeichnet.
3. Alle verbindlichen Richtlinienbestätigungen müssen einzeln markiert werden.
4. Erst nach erfolgreicher serverseitiger Prüfung wird die Bewerbung freigegeben.
5. Die Bewerbung speichert eine unveränderliche Referenz auf die akzeptierte Richtlinienversion und den Zeitpunkt.
6. Der Managementbereich zeigt Bewerbungen, Antworten, Statusverlauf und interne Notizen mit rollenbasiertem Zugriff.
7. Nach Annahme kann ein Bewerber dem Moodle-Kurs zugewiesen und nach bestandener Praxis durch eine berechtigte Person freigegeben werden.

Eine Bestätigung, dass jemand die Regeln gelesen hat, wird technisch von einer datenschutzrechtlichen Einwilligung getrennt. Eine Datenschutzhinweis-Kenntnisnahme ist keine pauschale Zustimmung zu beliebiger Verarbeitung. Vor Veröffentlichung müssen insbesondere Verantwortlicher/Kontakt, Zwecke, Rechtsgrundlagen, Empfänger, Speicherdauer und Betroffenenrechte korrekt angegeben werden.

## 7. Bewerbungsformular: aktueller Informationsstand

Der öffentliche Tally-Link liefert über die verfügbare Darstellung derzeit nur die erste von 17 Formularseiten. Die Einleitung ist lesbar; die übrigen Felder und Seitenlogiken sind daraus nicht zuverlässig rekonstruierbar. Sie werden deshalb nicht erfunden oder als vollständig übernommen ausgegeben.

Die vom Nutzer bestätigte Geräteanforderung wird als harte Eignungsprüfung vorgesehen: Für die primäre Staff-Arbeitsumgebung sind ausschließlich PC oder Laptop zulässig. Smartphone, Tablet, PlayStation, Xbox oder andere Geräte erfüllen die Anforderung nicht. Die konkrete Frage soll als eindeutige Auswahl des hauptsächlich verwendeten Staff-Geräts gestaltet werden, damit die Prüfung nicht durch Mehrfachauswahl missverständlich wird.

## 8. Empfohlene Umsetzungsreihenfolge

1. Aktiven Projektstamm festlegen, Alt-Kopien isolieren, Build-/Deployment-Pfad eindeutig bestimmen.
2. Authentifizierung, Rollenprüfung, zentrale API-Autorisierung, Audit-Logging und D1-Migrationen absichern.
3. Öffentliche Richtlinien- und Bewerbungsstrecke mit serverseitiger Versions-/Bestätigungsprüfung erstellen.
4. Bewerbungsverwaltung, Statusverlauf, Bewertung, interne Notizen und fein abgestufte Managementrechte ergänzen.
5. Moodle/Gnomio-Verknüpfung mit konfigurierbarer Kursadresse und klarer Trennung von lokalem und tatsächlich bestätigtem Kursfortschritt umsetzen.
6. Gesamtes Portal testen: Rollen, Datenzugriff, Formularvalidierung, Mobil-/Desktopdarstellung, Migrationen, Fehlerfälle und Backup-/Restore-Ablauf.

## 9. Externe technische und fachliche Leitlinien

- Next.js empfiehlt serverseitige, zentrale Autorisierungsprüfungen für Route Handler und sensible Datenzugriffe; reine UI-Sichtbarkeit ist keine Zugriffskontrolle.
- Cloudflare D1 stellt versionierte Migrationen bereit; die Dateien und die in Wrangler konfigurierte Migrationsstruktur müssen zusammenpassen.
- OWASP empfiehlt serverseitige Sessionkontrollen, explizite Cookie-Sicherheitsattribute und CSRF-Schutz für zustandsändernde Requests.
- Der GDPR-Grundsatz verlangt Zweckbindung, Datenminimierung, Speicherbegrenzung und Transparenz. Die konkreten Angaben können nicht ohne STAK-Verantwortlichen und Aufbewahrungsentscheidungen erfunden werden.
- Für Formulare werden beschriftete Eingabefelder, verständliche Anweisungen und klar zugeordnete Fehlermeldungen vorgesehen.

## 10. Nicht ausgeführt

- Keine Änderungen an der Cloudflare-Produktivumgebung;
- keine Migration auf eine vorhandene D1-Datenbank;
- kein Discord-Bot- oder Discord-Server-Aktionsaufruf;
- keine Veröffentlichung von Richtlinien oder rechtlichen Texten;
- keine Annahme, dass die noch nicht sichtbaren 16 Tally-Seiten bekannt sind.

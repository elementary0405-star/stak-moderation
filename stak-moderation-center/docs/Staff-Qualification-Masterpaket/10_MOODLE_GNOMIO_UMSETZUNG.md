# 10 – Umsetzung mit Moodle auf Gnomio

## Grundempfehlung: modularer Moodle-Kurs statt einer riesigen Lesson

Der Kurs bleibt zentral: **STAK Staff Qualification**. Innerhalb dieses Kurses werden Module als Moodle-Kursabschnitte angelegt. Diese Architektur unterstützt Übersicht, freie Wiederholung, Fortschritt, eigene Prüfungen, praktische Aufgaben und spätere Änderungen.

### Empfohlene Moodle-Bordmittel

| Moodle-Funktion | STAK-Verwendung |
|---|---|
| Kursabschnitte | sichtbare Module in sinnvoller Reihenfolge |
| Book | mehrseitige Lernkapitel mit Inhaltsverzeichnis sowie Vor-/Zurück-Navigation |
| Page | kurze Hinweise, Startseite oder kompakte Einzelinformation |
| Quiz | Mini-Checks und Abschlussprüfung mit Question bank |
| Assignment | praktische Fallbearbeitung, schriftliche Entscheidung, Upload oder Trainerbewertung |
| Lesson | optionale verzweigte Simulation, wenn eine Entscheidung den weiteren Weg verändern soll |
| Activity completion | sichtbar machen, was abgeschlossen ist |
| Restrict access | nächste Aktivität/Module erst nach Abschluss oder Bestehen freigeben |
| Course completion | formaler Kursabschluss anhand definierter Kriterien |
| Groups/Groupings | rollenbezogene Zusatzpfade, sofern in der Gnomio-Installation verfügbar und passend konfigurierbar |

## Warum Book für Lerntexte?

Das Moodle Book ist ein mehrseitiges Lernmaterial mit Inhaltsverzeichnis. Lernende können Kapitel über Pfeile, Textlinks oder das Inhaltsverzeichnis öffnen und navigieren. Bilder, Videos und andere Medien können in Kapitel eingebettet werden. Das passt besser zu einem lesbaren Handbook-/Kapitelaufbau mit Vor- und Zurücknavigation als eine strikt lineare Mega-Lektion.

## Warum Quiz für Prüfungen?

Die Moodle Quiz-Aktivität bietet freie Navigation zwischen Fragen als Standard, eine Übersichtsseite vor dem endgültigen Absenden und konfigurierbare Review-Optionen. Fragen können in einer Question bank gespeichert und in mehreren Tests wiederverwendet werden.

Für Wissenschecks ist meist sinnvoll:
- mehrere Fragen in einem Quiz nach dem Modul;
- kein Zwang, bei jeder falschen Antwort die gesamte Lektion erneut zu starten;
- freie Navigation im Test (nicht „Sequential“, wenn Zurückgehen erlaubt sein soll);
- Feedback/korrekte Antworten erst in dem Zeitraum anzeigen, in dem es didaktisch sinnvoll ist;
- Versuche, Bestehensgrenze und Frageverhalten bewusst festlegen.

## Lesson: wann nutzen?

Moodle Lesson eignet sich für verzweigte Übungen, in denen Antworten zu unterschiedlichen Seiten führen. Die Sprungziele steuern den Ablauf. Lesson kann eine Fortschrittsleiste, ein Inhaltsmenü und eine Wiederholungsfunktion bieten. Die Option „Allow student review“ setzt eine Wiederholung am Ende; laut Moodle-Dokumentation können Antworten dabei nur angesehen, nicht verändert werden.

Lesson kann für ein oder zwei interaktive Simulationen genutzt werden, sollte aber nicht automatisch der komplette Kurs sein, wenn freie Navigation und frei navigierbare Prüfungen erwünscht sind.

## Vor-/Zurück-Navigation und Wiederaufnahme

- **Book:** Kapitel können über Pfeile und Inhaltsverzeichnis vor und zurück geöffnet werden.
- **Quiz:** bei freier Navigation können Teilnehmende zwischen Fragen wechseln und vor dem Absenden zur Übersicht/zurück.
- **Kursnavigation:** Moodle-Versionen ab 5.2 führen eine lineare Previous/Next-Navigation für Aktivitäten ein; ob sie in der konkreten Gnomio-Installation aktiviert ist, muss geprüft werden.
- **Lesson:** Seiten folgen den konfigurierten Jumps; „Previous page“ kann als Sprungziel verwendet werden, ist aber kein Ersatz für eine freie Buchnavigation.
- **Wiederaufnahme:** In der bisherigen STAK-Ansicht erschien die Meldung „You have seen more than one page of this lesson already. Do you want to start at the last page you saw?“ Bei diesem Prompt bedeutet „Yes“: an der zuletzt besuchten Stelle fortsetzen; „No“: wieder von vorn beginnen. Mit einem Testkonto prüfen.

## Fortschritt und Freischaltung

Empfohlene Kombination:
1. Activity completion für Lernressourcen, Quizzes und Assignments aktivieren.
2. Quiz-Abschluss an Versuch/erforderliche Bewertung koppeln.
3. Nächsten Abschnitt oder Rollenpfad über Restrict access freigeben.
4. Course completion anhand der tatsächlich notwendigen Aktivitäten konfigurieren.
5. als Trainer die Completion- und Grade-Reports testen.

Course completion ist vor allem ein Fortschritts-/Abschlussreport und ersetzt nicht selbst die Zugriffsbeschränkung. Für die Zugangskontrolle wird Restrict access verwendet.

## Rolle / Gruppierung

Wenn alle Teilnehmer denselben Kurs belegen, können gemeinsame Pflichtmodule offen bleiben. Rollenbezogene Module können – nach Prüfung der konkreten Funktion – über Groups/Groupings und Restrict access nur den passenden Teilnehmenden angezeigt werden. Alternativ können getrennte Rollen-Kurse angelegt werden, falls das im Betrieb übersichtlicher ist.

## Gnomio-Hinweise

Die öffentliche Gnomio-Seite nennt Moodle 5.3 und veröffentlicht für den kostenlosen Shared-Hosting-Tarif u. a. 500 registrierte Benutzer, 50 gleichzeitig aktive Benutzer, 50 Kurse, 2 GB Speicher und 100 MB maximale Uploadgröße. Diese Angaben können sich ändern und sind kein Ersatz für die Anzeige im eigenen Administrationsbereich.

Die Gnomio-Seite enthält widersprüchliche Angaben zur Installation eigener Plugins/Themes: Die Tarifübersicht scheint entsprechende Möglichkeiten zu nennen, während der allgemeine Plugin-Hinweis sagt, dass eigene Plugins/Themes auf basic shared hosting aus Sicherheitsgründen nicht installiert werden können. Daher: **keine Plugin-Abhängigkeit planen** und tatsächliche Möglichkeiten im eigenen Konto/bei Gnomio prüfen.

Gnomio weist darauf hin, dass Betreiber ihre Kurse manuell sichern und herunterladen sollen; die serverseitigen Backups seien für Disaster Recovery und nicht zur Reparatur eigener Bedienfehler gedacht. Vor jeder größeren Kursänderung und in regelmäßigen Abständen Moodle-Kurs-Backup herunterladen.

## Vor dem finalen Aufbau im Gnomio-Konto testen

- Ist Book in der Aktivitäts-/Materialauswahl verfügbar?
- Ist Quiz verfügbar und lässt sich die Question bank nutzen?
- Sind Assignment und Essay-Fragen erlaubt?
- Ist Activity completion auf Kurs- und Websiteebene aktiviert?
- Ist Restrict access verfügbar?
- Sind Groups/Groupings und die entsprechende Einschränkung vorhanden?
- Welche Theme-/Kursnavigation zeigt Previous/Next?
- Wie genau funktioniert „Yes – start at last page“ mit einem echten Trainee-Testkonto?
- Welche Dateigrößen/Uploads sind zulässig?

## Empfohlene Kurseinstellungen (zu prüfen)

- Fortschrittsverfolgung einschalten.
- Kursformat mit klaren Themenabschnitten wählen.
- Abschnittsnamen und Aktivitätsnamen kurz und eindeutig halten.
- Keine unnötige Zeitsperre auf die Gesamtqualifikation legen.
- Versuche und Fristen nur bei tatsächlicher Policy festlegen.
- Course completion sauber definieren.
- nicht benötigte Kursaktivitäten nicht löschen, bevor die Funktion des Kurses getestet wurde.

## Offizielle Moodle- und Gnomio-Dokumentation

- Moodle Book resource: https://docs.moodle.org/503/en/mod/book/index
- Moodle Quiz: https://docs.moodle.org/503/en/quiz
- Using Quiz: https://docs.moodle.org/503/en/Using_Quiz
- Question behaviours: https://docs.moodle.org/503/en/Question_behaviours
- Lesson activity: https://docs.moodle.org/503/en/Lessons
- Lesson settings: https://docs.moodle.org/503/en/mod/lesson/lesson
- Lesson question types: https://docs.moodle.org/503/en/Lesson_question_types
- Lesson jumps: https://docs.moodle.org/503/en/Jumps
- Activity completion: https://docs.moodle.org/503/en/Activity_completion
- Course completion: https://docs.moodle.org/503/en/Course_completion
- Restrict access: https://docs.moodle.org/503/en/Restrict_access
- Gnomio: https://www.gnomio.com/

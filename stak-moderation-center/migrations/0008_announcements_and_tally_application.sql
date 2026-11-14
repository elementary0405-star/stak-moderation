-- Staff announcements with optional acknowledgement due exactly 48 hours after
-- publication. Acknowledgements are recorded only; no automatic warning is issued.
CREATE TABLE IF NOT EXISTS staff_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  acknowledgement_required INTEGER NOT NULL DEFAULT 0 CHECK (acknowledgement_required IN (0,1)),
  acknowledgement_due_at TEXT,
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (acknowledgement_required = 0 AND acknowledgement_due_at IS NULL)
    OR (acknowledgement_required = 1 AND acknowledgement_due_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_staff_announcements_created
ON staff_announcements(created_at DESC);

CREATE TABLE IF NOT EXISTS staff_announcement_acknowledgements (
  announcement_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, discord_user_id),
  FOREIGN KEY (announcement_id) REFERENCES staff_announcements(id) ON DELETE CASCADE
);

ALTER TABLE application_questions ADD COLUMN page_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE application_questions ADD COLUMN depends_on_question_key TEXT;
ALTER TABLE application_questions ADD COLUMN depends_on_value TEXT;
CREATE INDEX IF NOT EXISTS idx_application_questions_page_order
ON application_questions(is_active, page_number, sort_order);

-- Retire only the four known starter rows; do not touch manager-created questions.
UPDATE application_questions
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE id IN ('stak-q-experience','stak-q-availability','stak-q-scenario-1','stak-q-scenario-2');

-- Full public question set reconciled from the 17-page Tally form. The identifying
-- fields (Discord username, Discord ID and preferred name) remain the fixed
-- application fields so they are stored in the dedicated searchable columns.
INSERT OR IGNORE INTO application_questions
(id, question_key, section_title, prompt, help_text, question_type, options_json,
 is_required, is_active, sort_order, page_number, depends_on_question_key, depends_on_value)
VALUES
('stak-tally-age','age','Persönliche Angaben','Wie alt bist du?','', 'text','[]',1,1,201,2,NULL,NULL),
('stak-tally-community-time','community_time','Persönliche Angaben','Seit wann bist du Teil der STAK-Community?','Zum Beispiel: Seit 2023.', 'text','[]',1,1,202,2,NULL,NULL),
('stak-tally-platform','primary_platform','Plattform und Aktivität','Auf welcher Plattform spielst bzw. moderierst du hauptsächlich?','', 'single_choice','["PC / Laptop","PlayStation","Xbox","Smartphone","Tablet","Sonstige"]',1,1,301,3,NULL,NULL),
('stak-tally-hours','daily_availability','Verfügbarkeit und Aktivität','Wie viel Zeit kannst du durchschnittlich täglich für STAK aufbringen?','', 'single_choice','["Unter 1 Stunde","1–2 Stunden","2–3 Stunden","3–5 Stunden","Mehr als 5 Stunden"]',1,1,401,4,NULL,NULL),
('stak-tally-days','available_days','Verfügbarkeit und Aktivität','An welchen Tagen bist du normalerweise verfügbar?','', 'multiple_choice','["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]',1,1,402,4,NULL,NULL),
('stak-tally-time-of-day','available_times','Verfügbarkeit und Aktivität','Zu welchen Tageszeiten bist du normalerweise überwiegend verfügbar?','', 'multiple_choice','["Vormittags","Mittags","Nachmittags","Abends","Nachts"]',1,1,403,4,NULL,NULL),
('stak-tally-commitments','recurring_commitments','Verfügbarkeit und Aktivität','Gibt es regelmäßige Verpflichtungen oder Umstände, die deine Aktivität bei STAK beeinflussen können?','Falls ja, erläutere bitte kurz, zu welchen Zeiten oder in welchem Umfang dies normalerweise der Fall ist. Keine sensiblen Details notwendig.', 'textarea','[]',1,1,404,4,NULL,NULL),
('stak-tally-has-experience','has_staff_experience','Erfahrung und Qualifikationen','Hast du bereits Erfahrungen in einem Moderations-, Support-, Administrations- oder Leitungsteam gesammelt?','Vorherige Staff-Erfahrung ist kein zwingendes Kriterium.', 'single_choice','["Ja","Nein"]',1,1,501,5,NULL,NULL),
('stak-tally-previous-teams','previous_teams','Erfahrung und Qualifikationen','In welchen Teams, Projekten oder Communities warst du bisher tätig und welche Positionen hattest du dort?','Nenne Projekt/Server, Position und ca. Dauer.', 'textarea','[]',1,1,502,5,'has_staff_experience','Ja'),
('stak-tally-previous-duties','previous_duties','Erfahrung und Qualifikationen','Welche konkreten Aufgaben und Verantwortlichkeiten hast du dort übernommen?','', 'textarea','[]',1,1,503,5,'has_staff_experience','Ja'),
('stak-tally-transferable-experience','transferable_experience','Erfahrung und Qualifikationen','Welche Erfahrungen aus diesen Tätigkeiten könnten dir bei STAK helfen?','', 'textarea','[]',1,1,504,5,'has_staff_experience','Ja'),
('stak-tally-strengths','strengths','Erfahrung und Qualifikationen','Welche Fähigkeiten, Erfahrungen oder persönlichen Stärken bringst du für eine verantwortungsvolle Tätigkeit im STAK-Staff mit?','Vorherige Staff-Erfahrung ist kein zwingendes Kriterium. Entscheidend sind persönliche Reife, Verantwortungsbewusstsein, Kommunikationsfähigkeit und Lernbereitschaft.', 'textarea','[]',1,1,505,5,NULL,NULL),
('stak-tally-motivation','motivation','Motivation und Erwartungen','Warum möchtest du Teil des STAK-Staffs werden?','', 'textarea','[]',1,1,601,6,NULL,NULL),
('stak-tally-contribution','contribution','Motivation und Erwartungen','Welchen konkreten Beitrag möchtest du zur Community und zum Team leisten?','', 'textarea','[]',1,1,602,6,NULL,NULL),
('stak-tally-role-expectation','role_expectation','Motivation und Erwartungen','Was bedeutet eine Staff-Position für dich, und warum sollte eine solche Position deiner Meinung nach nicht ausschließlich aufgrund von Rechten oder einem höheren Rang angestrebt werden?','', 'textarea','[]',1,1,603,6,NULL,NULL),
('stak-tally-three-traits','three_traits','Persönlichkeit und Verantwortungsbewusstsein','Welche drei Eigenschaften beschreiben dich am besten? Begründe deine Auswahl.','', 'textarea','[]',1,1,701,7,NULL,NULL),
('stak-tally-weakness','weakness','Persönlichkeit und Verantwortungsbewusstsein','Welche persönliche Schwäche könnte dir in einer Staff-Position zum Problem werden und wie gehst du damit um?','', 'textarea','[]',1,1,702,7,NULL,NULL),
('stak-tally-criticism','handling_criticism','Persönlichkeit und Verantwortungsbewusstsein','Wie gehst du damit um, wenn deine eigene Entscheidung von einem Nutzer oder einem anderen Teammitglied kritisiert wird?','', 'textarea','[]',1,1,703,7,NULL,NULL),
('stak-tally-own-error','correcting_own_error','Persönlichkeit und Verantwortungsbewusstsein','Was tust du, wenn du im Nachhinein erkennst, dass eine eigene Entscheidung falsch oder auf unvollständigen Informationen basiert?','', 'textarea','[]',1,1,704,7,NULL,NULL),
('stak-tally-fairness','fairness','Regelverständnis und Fairness','Was bedeutet für dich neutrales, faires und objektives Verhalten gegenüber der Community?','Die folgenden Fragen dienen dazu, das Verständnis von Fairness, Neutralität, Verantwortung und professionellem Verhalten zu beurteilen. Entscheidend sind Qualität der Begründung, nachvollziehbares Vorgehen und sachliche Einschätzung.', 'textarea','[]',1,1,801,8,NULL,NULL),
('stak-tally-friend-violation','friend_violation','Regelverständnis und Fairness','Ein guter Freund von dir verstößt gegen eine Regel und du bist das einzige Staff-Mitglied, das den Vorfall bemerkt. Wie gehst du mit dieser Situation um?','Beschreibe dein konkretes Vorgehen und begründe deine Entscheidung.', 'textarea','[]',1,1,802,8,NULL,NULL),
('stak-tally-disagree-senior','disagree_with_senior','Regelverständnis und Fairness','Du bist mit der Entscheidung eines höhergestellten Teammitglieds nicht einverstanden. Wie gehst du damit um?','Beschreibe, wie du deine eigene Meinung sachlich einbringst und gleichzeitig professionell mit der Situation umgehst.', 'textarea','[]',1,1,803,8,NULL,NULL),
('stak-tally-scenario-disrespect','scenario_disrespect','Praxis- und Situationsbeurteilung','Szenario 1 – Wiederholt respektloser Nutzer','Ein Nutzer verhält sich wiederholt respektlos und provoziert andere Mitglieder. Mehrere Personen fordern das Staff-Mitglied auf, ihn sofort zu sanktionieren. Der Nutzer behauptet gleichzeitig, selbst provoziert worden zu sein. Beschreibe dein Vorgehen Schritt für Schritt. Welche Informationen würdest du zunächst prüfen? Wie würdest du zwischen den Aussagen der beteiligten Personen unterscheiden? Wie würdest du anschließend über eine angemessene Reaktion entscheiden? Begründe dein Vorgehen.', 'textarea','[]',1,1,901,9,NULL,NULL),
('stak-tally-scenario-error','scenario_own_error','Praxis- und Situationsbeurteilung','Szenario 2 – Eigene Fehlentscheidung','Du hast als Staff-Mitglied eine Entscheidung getroffen. Kurz darauf stellst du fest, dass du wichtige Informationen übersehen hast und deine Entscheidung möglicherweise falsch war. Wie gehst du mit der Situation um? Was würdest du gegenüber dem betroffenen Nutzer tun? Was würdest du intern gegenüber deinem Team tun?', 'textarea','[]',1,1,902,9,NULL,NULL),
('stak-tally-scenario-staff','scenario_staff_conduct','Praxis- und Situationsbeurteilung','Szenario 3 – Verhalten eines Teammitglieds','Du bemerkst, dass ein anderes Teammitglied einen Nutzer deiner Meinung nach unangemessen behandelt. Gleichzeitig bist du dir nicht sicher, ob du alle Hintergründe kennst. Wie gehst du vor? Wie stellst du sicher, dass du nicht vorschnell urteilst, aber einen möglicherweise problematischen Vorgang trotzdem angemessen behandelst?', 'textarea','[]',1,1,903,9,NULL,NULL),
('stak-tally-scenario-unsure','scenario_uncertainty','Praxis- und Situationsbeurteilung','Szenario 4 – Unsicherheit und Eskalation','Du bist dir bei einem Vorfall unsicher und weißt nicht genau, welche Regel anzuwenden ist oder welche Maßnahme angemessen wäre. Wie gehst du vor, bevor du eine Entscheidung triffst? Wann würdest du ein höhergestelltes Teammitglied hinzuziehen?', 'textarea','[]',1,1,904,9,NULL,NULL),
('stak-tally-scenario-conflict','scenario_staff_conflict','Praxis- und Situationsbeurteilung','Szenario 5 – Konflikt zwischen Staff-Mitgliedern','Zwei Staff-Mitglieder haben unterschiedliche Auffassungen über einen Vorfall. Wie gehst du vor, um den Konflikt sachlich zu lösen? Wie stellst du Zusammenarbeit sicher, ohne öffentlich zu eskalieren?', 'textarea','[]',1,1,905,9,NULL,NULL),
('stak-tally-scenario-pressure','scenario_community_pressure','Praxis- und Situationsbeurteilung','Szenario 6 – Druck aus der Community','Mehrere Community-Mitglieder üben Druck aus und fordern eine sofortige Sanktion gegen jemanden, während die Sachlage noch nicht eindeutig geklärt ist. Wie gehst du mit diesem Druck um? Wie bewahrst du Neutralität und triffst eine fundierte Entscheidung?', 'textarea','[]',1,1,906,9,NULL,NULL),
('stak-tally-angry-user','angry_user_response','Kommunikation unter Druck','Staff-Mitglieder müssen auch in angespannten Situationen sachlich und professionell kommunizieren können. Formuliere eine professionelle Antwort auf diese Nachricht: „Was ist das bitte für ein Müll? Ihr seid komplett unfähig. Ich wurde einfach bestraft, obwohl ich nichts gemacht habe. Entfernt die Strafe sofort, sonst bin ich weg.“','Die Antwort sollte ruhig, sachlich, respektvoll, deeskalierend und nachvollziehbar sein.', 'textarea','[]',1,1,1001,10,NULL,NULL),
('stak-tally-confidentiality','confidentiality','Vertraulichkeit und interne Informationen','Wie gehst du mit Informationen um, die du innerhalb des Staff-Teams erhältst und die nicht für die Öffentlichkeit bestimmt sind?','', 'textarea','[]',1,1,1101,11,NULL,NULL),
('stak-tally-friend-asks-info','friend_asks_internal_info','Vertraulichkeit und interne Informationen','Ein Freund oder Community-Mitglied fragt dich nach internen Informationen über eine Staff-Entscheidung, ein Ticket oder einen internen Vorgang. Wie gehst du damit um?','', 'textarea','[]',1,1,1102,11,NULL,NULL),
('stak-tally-permissions','permissions_responsibility','Umgang mit Berechtigungen','Was bedeutet für dich der verantwortungsvolle Umgang mit Staff- oder Verwaltungsberechtigungen?','', 'textarea','[]',1,1,1201,12,NULL,NULL),
('stak-tally-permissions-scope','permissions-scope','Umgang mit Berechtigungen','Du besitzt eine Berechtigung, mit der du etwas verändern könntest, bist dir aber nicht sicher, ob diese Änderung zu deinem Aufgabenbereich gehört. Wie gehst du vor?','', 'textarea','[]',1,1,1202,12,NULL,NULL),
('stak-tally-self-qualified','self_assessment','Persönliche Einschätzung','Was spricht aus deiner Sicht dafür, dass du eine verantwortungsvolle Position innerhalb des STAK-Staffs übernehmen kannst?','', 'textarea','[]',1,1,1301,13,NULL,NULL),
('stak-tally-growth','development_area','Persönliche Einschätzung','Was glaubst du, woran du als neues Staff-Mitglied zunächst arbeiten müsstest?','', 'textarea','[]',1,1,1302,13,NULL,NULL),
('stak-tally-anything-else','anything_else','Persönliche Einschätzung','Gibt es noch etwas, das wir über dich, deine Erfahrungen oder deine Bewerbung wissen sollten?','', 'textarea','[]',1,1,1303,13,NULL,NULL);

-- Retain the old form's agreement language and confirmations in the unpublished
-- draft. They remain hidden from applicants until an authorized owner publishes
-- a reviewed policy and privacy notice.
UPDATE policy_versions
SET policy_content = policy_content || char(10) || char(10) ||
  'STAK Staff- und Berechtigungsvereinbarung (Version 1.0)' || char(10) ||
  'Mit der Aufnahme in das STAK-Staff-Team können dir je nach Aufgabenbereich besondere Berechtigungen übertragen werden. Diese Berechtigungen werden ausschließlich zur Erfüllung deiner vorgesehenen Aufgaben innerhalb des STAK-Teams erteilt.' || char(10) ||
  'Die übertragenen Rechte dürfen nicht zu privaten Zwecken, zum persönlichen Vorteil, zur Durchsetzung eigener Interessen oder zum Nachteil anderer Mitglieder, des Teams oder des Servers genutzt werden. Insbesondere ist es untersagt, Berechtigungen eigenmächtig zu erweitern, weiterzugeben, auszunutzen oder Sicherheitsvorkehrungen zu umgehen. Ebenso sind unberechtigte Änderungen, Löschungen oder sonstige Eingriffe in wichtige Serverstrukturen untersagt.' || char(10) ||
  'Ein vorsätzlicher oder grob fahrlässiger Missbrauch von Staff- oder Verwaltungsberechtigungen kann zum sofortigen Entzug der entsprechenden Berechtigungen sowie zu weiteren internen Maßnahmen führen. STAK behält sich bei vorsätzlichem oder möglicherweise rechtswidrigem Verhalten außerdem vor, vorhandene Nachweise und relevante Informationen zu sichern und, soweit rechtlich zulässig und erforderlich, weitere rechtliche Schritte zu prüfen bzw. einzuleiten.'
WHERE id = 'stak-policy-draft-1' AND status = 'draft'
  AND instr(policy_content, 'STAK Staff- und Berechtigungsvereinbarung (Version 1.0)') = 0;

INSERT OR IGNORE INTO policy_acknowledgements
(id, policy_version_id, acknowledgement_key, label, explanation, sort_order, is_required, acknowledgement_type)
VALUES
('stak-tally-ack-authority','stak-policy-draft-1','staff_authority','Ich habe verstanden, dass mir übertragene Staff- und Verwaltungsberechtigungen ausschließlich für meinen vorgesehenen Aufgabenbereich zur Verfügung stehen und dass ein Missbrauch dieser Berechtigungen zu Konsequenzen bis hin zum Ausschluss aus dem STAK-Team sowie – soweit rechtlich zulässig und erforderlich – zu weiteren rechtlichen Schritten führen kann.','Ja, ich bestätige.',10,1,'policy'),
('stak-tally-ack-rules','stak-policy-draft-1','server_rules','Ich habe die STAK Serverregeln gelesen und verstanden.','Ja, ich bestätige.',11,1,'policy'),
('stak-tally-ack-handbook','stak-policy-draft-1','staff_handbook','Ich habe das STAK Staff-Handbuch gelesen und verstanden.','Ja, ich bestätige.',12,1,'policy'),
('stak-tally-ack-agreement','stak-policy-draft-1','staff_agreement','Ich habe diese Staff- und Berechtigungsvereinbarung vollständig gelesen und verstanden.','Ja, ich bestätige.',13,1,'policy'),
('stak-tally-ack-duties','stak-policy-draft-1','accept_duties','Ich akzeptiere die darin festgelegten Pflichten und Regeln.','Ja, ich bestätige.',14,1,'policy'),
('stak-tally-ack-no-misuse','stak-policy-draft-1','no_permission_misuse','Ich verpflichte mich, meine übertragenen Staff-Berechtigungen ausschließlich bestimmungsgemäß zu verwenden und nicht zu missbrauchen.','Ja, ich bestätige.',15,1,'policy'),
('stak-tally-ack-internal-measures','stak-policy-draft-1','internal_measures','Ich akzeptiere, dass Verstöße gegen interne Regelungen zum Entzug von Berechtigungen und zu weiteren internen Maßnahmen führen können.','Ja, ich bestätige.',16,1,'policy'),
('stak-tally-ack-accuracy','stak-policy-draft-1','application_accuracy','Ich bestätige die Richtigkeit meiner angegebenen Daten.','Ja, ich bestätige.',17,1,'policy');

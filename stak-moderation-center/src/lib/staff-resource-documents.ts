export type StaffResourceSection = {
  title: string;
  paragraphs: string[];
};

export type StaffResourceDocument = {
  slug: string;
  title: string;
  subtitle: string;
  intro: string;
  sections: StaffResourceSection[];
};

export const STAFF_RESOURCE_DOCUMENTS: Record<string, StaffResourceDocument> = {
  handbook: {
    slug: "handbook",
    title: "STAK — STAFF HANDBOOK",
    subtitle: "Internal Staff Standard • 2026 · Nur für interne Nutzung",
    intro: "",
    sections: [
      {
        title: "01 — GRUNDLAGEN & VERANTWORTUNG",
        paragraphs: [
          "Mit der Aufnahme in das STAK Staff-Team übernimmt jedes Mitglied Verantwortung für die Community und das Vertrauen, das mit der Staff-Rolle verbunden ist. Staff zu sein bedeutet nicht, über anderen Nutzern zu stehen oder besondere persönliche Vorteile zu besitzen. Die übertragenen Rechte dienen ausschließlich dazu, die eigenen Aufgaben zuverlässig und im Interesse der Community erfüllen zu können.",
          "Von jedem Teammitglied wird ein professionelles, respektvolles und zuverlässiges Auftreten erwartet. Persönliche Freundschaften, Bekanntschaften, Streitigkeiten oder Abneigungen dürfen keine moderativen Entscheidungen beeinflussen. Auch bei Provokationen oder Konflikten bleibt ein Staff sachlich und nutzt seine Position niemals für persönliche Auseinandersetzungen, Einschüchterung oder Bevorzugung.",
          "Jedes Staff-Mitglied muss sich mit seinem gesamten Zuständigkeitsbereich auskennen. Dazu gehören insbesondere die geltenden Server- und Projektregeln, die relevanten Spielregeln, die Struktur der zugehörigen Discords sowie die wichtigsten Bereiche und Systeme von STAK. Ein Staff sollte Nutzern bei allgemeinen Fragen weiterhelfen und sie zuverlässig an die richtige Stelle verweisen können.",
          "Das Staff-Team arbeitet gemeinsam. Nicht jeder Fall muss alleine gelöst werden. Wenn eine Situation unklar ist, außerhalb der eigenen Zuständigkeit liegt oder eine Entscheidung besondere Verantwortung erfordert, wird ein zuständiges Teammitglied hinzugezogen. Fehler werden nicht verschwiegen, sondern offen angesprochen und korrigiert.",
          "Neue Teammitglieder werden im Rahmen der Staff-Einführung und gegebenenfalls einer Trial-Phase an ihre Aufgaben herangeführt. Die praktische Ausbildung, Schulungen und detaillierten Abläufe werden in der Staff-Einführung behandelt und müssen nicht Bestandteil dieses Handbuchs sein.",
        ],
      },
      {
        title: "02 — DISCORD & COMMUNITY",
        paragraphs: [
          "Die Moderationszuständigkeit umfasst den gesamten jeweiligen STAK-Discord sowie die Discords der betreuten Projekte. Jeder Bereich, für den das Staff-Team verantwortlich ist, muss entsprechend der eigenen Zuständigkeit moderiert werden. Dabei geht es nicht nur darum, Regelverstöße zu sanktionieren, sondern auch darum, Ordnung, einen funktionierenden Ablauf und einen angemessenen Umgang innerhalb der Community sicherzustellen.",
          "Staff-Mitglieder sollen die zugehörigen Discords vollständig kennen. Dazu gehört beispielsweise zu wissen, wo Regeln zu finden sind, wie Nutzer zu den verschiedenen Projekten gelangen, wo Rollen und Pings über Role Select ausgewählt werden oder wo weitere Informationen über das Community Network zu finden sind. Nutzer sollen möglichst direkt zur richtigen Information oder zum richtigen Bereich geführt werden können.",
          "Moderation erfolgt auf Grundlage der geltenden Regeln und der verfügbaren Informationen. Persönliche Vermutungen oder Sympathien ersetzen keine ausreichende Grundlage für eine moderative Entscheidung. Maßnahmen müssen angemessen und nachvollziehbar sein.",
          "Die vorhandenen Discord-Berechtigungen dürfen ausschließlich für Staff-Aufgaben verwendet werden. Sie dürfen weder für persönliche Vorteile noch zur Bevorzugung von Freunden, zur Einschüchterung anderer Nutzer oder zur Austragung privater Konflikte eingesetzt werden.",
          "Die Kommunikation mit Nutzern bleibt jederzeit sachlich und professionell. Auch außerhalb einer konkreten Moderationssituation repräsentiert jedes Teammitglied STAK und sollte sich entsprechend seiner Verantwortung verhalten.",
        ],
      },
      {
        title: "03 — INGAME & PROJEKTE",
        paragraphs: [
          "Die Staff-Zuständigkeit endet nicht beim Discord. Alle Projekte und Ingame-Bereiche, die dem Staff-Team zur Moderation zugewiesen sind, gehören ebenfalls zum Verantwortungsbereich. Jedes Teammitglied muss die Regeln des jeweiligen Projekts kennen und darauf achten, dass Spieler diese einhalten.",
          "Ingame umfasst die Moderation insbesondere Verstöße gegen die jeweiligen Spielregeln und Serverregeln. Staff-Mitglieder greifen ein, wenn Spieler gegen geltende Vorgaben verstoßen, und verwenden ihre administrativen Möglichkeiten ausschließlich für die vorgesehenen moderativen oder organisatorischen Aufgaben.",
          "Administrative Rechte stellen keinen Spielvorteil dar. Sie dürfen niemals genutzt werden, um sich selbst oder anderen Vorteile zu verschaffen, normale Spielsituationen ohne moderativen Grund zu beeinflussen oder persönliche Konflikte auszutragen.",
          "Während aktiver Ingame-Staff-Tätigkeit sind die dafür vorgesehenen Staff-Funktionen und internen Kommunikationswege zu verwenden. Dazu gehört insbesondere der korrekte Staff-Status. Dieser muss bei Beginn der Tätigkeit aktiviert und nach Beendigung wieder deaktiviert werden.",
          "Moderative Maßnahmen und relevante Spielerakten müssen entsprechend der internen Vorgaben dokumentiert werden. Staff Cases beziehungsweise Spielerakten sind vollständig und korrekt zu führen, damit spätere Entscheidungen nachvollziehbar bleiben und andere Teammitglieder auf die notwendigen Informationen zugreifen können.",
        ],
      },
      {
        title: "04 — INTERNE SYSTEME & ARBEITSWEISE",
        paragraphs: [
          "Für die Staff-Arbeit stehen verschiedene interne Systeme zur Verfügung. Das Staff Handbook beschreibt die allgemeinen Anforderungen und Verantwortlichkeiten. Die praktische Bedienung einzelner Systeme wird in den dafür vorgesehenen Leitfäden und der Staff-Einführung erklärt.",
          "Das Staff Overview beziehungsweise die interne Übersicht dient als Orientierung für den Staff-Bereich und die vorhandenen Zuständigkeiten. Das Team-Dashboard wird für organisatorische Funktionen verwendet, beispielsweise für Abmeldungen und andere interne Vorgänge. Diese Systeme sind entsprechend ihrer vorgesehenen Funktion zu verwenden.",
          "Für Tickets und den Discord-Support gilt der separate Ticket-Leitfaden. Alle Teamleiter und Support-Mitglieder sind dafür verantwortlich, Tickets innerhalb ihres Zuständigkeitsbereichs vollständig und ordnungsgemäß zu bearbeiten. Die konkreten Bearbeitungsschritte werden ausschließlich im Ticket-Leitfaden geregelt.",
          "Neben Tickets gehören auch die korrekte Dokumentation von Staff Cases, die Beachtung interner Ankündigungen und die zuverlässige Nutzung der vorgesehenen Staff-Systeme zur normalen Staff-Arbeit.",
          "Ankündigungen und wichtige interne Informationen müssen eigenständig verfolgt werden. Wird bei einer verpflichtenden Ankündigung eine Bestätigung durch einen grünen Haken verlangt, muss diese innerhalb von zwei Tagen erfolgen. Das Nichtbeachten solcher verpflichtenden Rückmeldungen kann zu einem Team-Warn führen.",
          "Von jedem Teammitglied werden angemessene Aktivität, zuverlässige Kommunikation und die Teilnahme an verpflichtenden Teamterminen oder Schulungen erwartet. Längere Abwesenheiten sind über das vorgesehene Team-System ordnungsgemäß zu melden.",
        ],
      },
      {
        title: "05 — STAFF-RECHTE, PFLICHTEN & ENTWICKLUNG",
        paragraphs: [
          "Mit den Rechten eines Staff-Mitglieds gehen entsprechende Pflichten einher. Berechtigungen dürfen niemals weitergegeben, missbraucht oder außerhalb der eigenen Zuständigkeit eingesetzt werden. Jeder Staff ist selbst dafür verantwortlich, seine Aufgaben zuverlässig auszuführen und die für seine Position geltenden Vorgaben einzuhalten.",
          "Zu den grundlegenden Anforderungen gehören insbesondere Zuverlässigkeit, angemessene Aktivität, Teamfähigkeit, Verantwortungsbewusstsein, ausreichende Kenntnis der relevanten Regeln und die Fähigkeit, die übertragenen Aufgaben selbstständig und korrekt auszuführen.",
          "Beförderungen und zusätzliche Verantwortlichkeiten richten sich nicht allein nach Dienstzeit oder persönlicher Beziehung. Entscheidend sind insbesondere Leistung, Zuverlässigkeit, Verhalten, Kompetenz, Zusammenarbeit und der verantwortungsvolle Umgang mit den eigenen Aufgaben und Rechten.",
          "Mit zunehmender Verantwortung steigen auch die Anforderungen. Höhere Teammitglieder haben zusätzlich eine Vorbildfunktion und unterstützen andere Staff-Mitglieder bei ihrer Arbeit und Entwicklung.",
        ],
      },
      {
        title: "06 — SICHERHEIT, VERTRAULICHKEIT & KONSEQUENZEN",
        paragraphs: [
          "Interne Informationen, Staff-Gespräche, Logs, Staff Cases, Moderationsdaten und andere nicht öffentliche Inhalte sind vertraulich zu behandeln. Sie dürfen nicht ohne entsprechende Berechtigung an Nutzer oder andere Außenstehende weitergegeben werden. Die Pflicht zur Vertraulichkeit gilt auch nach dem Ausscheiden aus dem Staff-Team.",
          "Staff-Zugänge und Berechtigungen dürfen niemals an andere Personen weitergegeben werden. Die Sicherheit des eigenen Accounts gehört zur Verantwortung jedes Teammitglieds; 2FA auf Discord ist verpflichtend. Bei einem verdächtigen Zugriff oder einem möglicherweise kompromittierten Account ist unverzüglich ein zuständiges höheres Staff-Mitglied oder die Administration zu informieren.",
          "Verstöße gegen die Staff-Vorgaben können abhängig von ihrer Schwere zu einem Team-Warn, dem Entzug von Berechtigungen, einer Rückstufung oder dem Ausschluss aus dem Staff-Team führen. Team-Warns können unter anderem bei Missbrauch von Rechten, unzuverlässiger Staff-Arbeit, falscher oder fehlender Bearbeitung von Aufgaben, nicht ordnungsgemäß geführten Staff Cases, wiederholtem Nichtbeachten interner Vorgaben oder einem nicht korrekt verwendeten Staff-Status ausgesprochen werden.",
          "Bei drei Team-Warns kann der Ausschluss aus dem Staff-Team erfolgen. Schwerwiegendes Fehlverhalten kann unabhängig von vorherigen Warns unmittelbare Konsequenzen haben. Dazu gehören insbesondere Machtmissbrauch, bewusste Schädigung der Community, Weitergabe vertraulicher Informationen oder vorsätzlicher Missbrauch administrativer Rechte.",
          "Staff bei STAK zu sein bedeutet nicht, mehr zu dürfen. Es bedeutet, mehr Verantwortung zu tragen.",
        ],
      },
    ],
  },
  ticketGuide: {
    slug: "ticket-guide",
    title: "STAK — TICKET-LEITFADEN",
    subtitle: "Internal Support Standard • 2026 · Originalsprache: Deutsch",
    intro: "Jedes Ticket wird von einem zuständigen Teammitglied übernommen und vollständig bearbeitet. Wer ein Ticket übernimmt, ist dafür verantwortlich, dass das Anliegen nicht einfach liegen bleibt, sondern entweder selbst gelöst oder an die richtige Stelle weitergegeben wird. Dabei ist immer sachlich, freundlich und professionell zu kommunizieren. Auch bei unfreundlichen Nutzern, Provokationen oder wiederholten Anfragen bleibt der Support ruhig und konzentriert sich auf die Lösung des eigentlichen Anliegens. Nach der Übernahme wird zunächst geprüft, um welche Art von Anliegen es sich handelt und ob alle notwendigen Informationen vorhanden sind. Fehlen Angaben, werden diese gezielt beim Nutzer erfragt. Das Ticket soll dabei möglichst vollständig bearbeitet werden, ohne unnötige Rückfragen zu stellen. Ist ein Anliegen außerhalb des eigenen Zuständigkeitsbereichs, wird es mit allen bisher vorhandenen Informationen an die zuständige Stelle weitergeleitet. Der Nutzer sollte dabei wissen, dass sein Anliegen weitergegeben wurde.",
    sections: [
      {
        title: "GENERAL SUPPORT",
        paragraphs: [
          "Bei General-Support-Tickets handelt es sich um allgemeine Fragen oder Probleme rund um STAK, die nicht bereits durch eine andere Ticketart abgedeckt werden. Zuerst wird geprüft, was der Nutzer genau benötigt und ob die Antwort bereits über die vorhandenen Informationen, Regeln oder Bereiche des Discords nachvollziehbar ist.",
          "Ein Staff-Mitglied sollte sich deshalb mit dem eigenen Discord, den Projekt-Discords, den Regeln und den wichtigsten Bereichen auskennen. Dazu gehört beispielsweise, Nutzern erklären zu können, wo sie Regeln finden, wie sie zu einem Projekt gelangen, wo sie Rollen und Pings über Role Select auswählen oder wo sie weitere Informationen im Community Network finden.",
          "Kann die Frage selbst beantwortet werden, erhält der Nutzer eine klare und verständliche Antwort. Kann das Anliegen nicht selbst gelöst werden, wird es an die zuständige Stelle weitergegeben.",
        ],
      },
      {
        title: "PLAYER REPORT",
        paragraphs: [
          "Bei einem Player Report wird geprüft, ob ein anderer Spieler gegen die geltenden Spiel- oder Serverregeln verstoßen hat. Zunächst werden die Angaben des Meldenden und vorhandene Beweise geprüft. Je nach Fall können Screenshots, Videos, Chatverläufe, Zeitpunkte, Spielernamen oder andere Informationen relevant sein.",
          "Anschließend wird der gemeldete Sachverhalt mit den entsprechenden Regeln abgeglichen. Liegt ein Regelverstoß vor und besteht eine ausreichende Grundlage für eine Maßnahme, wird diese entsprechend den geltenden Vorgaben durchgeführt und – sofern erforderlich – dokumentiert.",
          "Sind die Informationen nicht ausreichend, werden gezielt weitere Angaben oder Beweise angefragt. Ist der Fall nicht im eigenen Zuständigkeitsbereich, wird er an die zuständige Stelle weitergeleitet.",
          "Ein Player Report wird nicht aufgrund persönlicher Beziehungen oder eigener Vermutungen entschieden. Entscheidend sind die vorhandenen Informationen und die geltenden Regeln.",
        ],
      },
      {
        title: "UNBAN REQUEST",
        paragraphs: [
          "Bei einem Unban Request werden die Angaben des Nutzers zunächst geprüft. Durch die Fragen im Ticket liegen normalerweise bereits das betroffene Spiel, der Ingame-Name und die Begründung für den gewünschten Unban vor.",
          "Zuerst wird der entsprechende Spieler im vorgesehenen Case-System gesucht. Dabei wird geprüft, ob ein Ban beziehungsweise ein entsprechender Staff Case vorhanden ist und aus welchem Grund die Maßnahme ausgesprochen wurde.",
          "Ist ein Case vorhanden, wird der dort dokumentierte Ban-Grund geprüft und mit den geltenden Vorgaben für Unbans abgeglichen. Je nach Grund kann ein Unban möglich sein, zu einem späteren Zeitpunkt möglich werden oder abgelehnt werden. Dem Nutzer wird die Entscheidung verständlich mitgeteilt. Besteht beispielsweise weiterhin ein berechtigter Ban, wird der Grund kurz erklärt, anstatt lediglich „abgelehnt“ zu schreiben.",
          "Ist kein entsprechender Case auffindbar, darf daraus nicht automatisch geschlossen werden, dass der Ban unberechtigt ist. In diesem Fall wird zunächst geprüft, ob weitere Informationen vorhanden sind oder eine zuständige höhere Stelle den Fall überprüfen muss.",
          "Bei einem bestätigten Unban wird der Spieler anhand der vorgesehenen Ingame-Daten eindeutig identifiziert und anschließend über das dafür vorgesehene System entbannt. Bei Roblox kann hierfür beispielsweise der genaue Ingame-Name beziehungsweise die dazugehörige User-ID benötigt werden. Die Identität des Spielers muss vor der Durchführung eindeutig überprüft werden.",
          "Wenn ein Nutzer die Ticketfragen falsch oder unvollständig beantwortet hat, werden die fehlenden Informationen freundlich nachgefragt. Sprachliche Schwierigkeiten ändern nichts daran, dass die notwendigen Angaben vor einer Entscheidung vollständig vorliegen müssen.",
        ],
      },
      {
        title: "WEITERLEITUNG",
        paragraphs: [
          "Nicht jedes Ticket muss vom übernehmenden Teammitglied selbst gelöst werden. Wenn ein Anliegen einen anderen Zuständigkeitsbereich betrifft, technische oder administrative Eingriffe benötigt oder nicht mit den eigenen Berechtigungen beziehungsweise Kenntnissen bearbeitet werden kann, wird das Ticket an die zuständige Person oder Stelle weitergeleitet.",
          "Vor der Weiterleitung wird sichergestellt, dass die bisher gesammelten Informationen im Ticket vorhanden sind. Eine Weiterleitung soll nicht dazu führen, dass der Nutzer sein Anliegen erneut vollständig erklären muss.",
        ],
      },
      {
        title: "TICKET-FUNKTIONEN",
        paragraphs: [
          "Die Funktionen von GalaxyBot werden entsprechend ihrer vorgesehenen Aufgabe verwendet.",
          "Ticket übernehmen übernimmt die Zuständigkeit für das Ticket.",
          "Ticket freigeben gibt ein übernommenes Ticket wieder für andere zuständige Teammitglieder frei.",
          "Nutzer hinzufügen fügt bei Bedarf weitere Personen zur Bearbeitung hinzu.",
          "Ticket weiterleiten / Forward übergibt das Ticket an einen anderen zuständigen Bereich oder Supporter.",
          "Schließungsanfrage wird verwendet, wenn die Bearbeitung abgeschlossen ist und ein Ticket geschlossen werden kann beziehungsweise eine Schließung bestätigt werden soll.",
          "Ticket schließen beendet das Ticket nach abgeschlossener Bearbeitung.",
          "Nachrichten löschen darf nur verwendet werden, wenn dies für die Bearbeitung tatsächlich erforderlich und zulässig ist.",
          "Ticket im Namen eines Nutzers erstellen kann verwendet werden, wenn ein Nutzer selbst kein Ticket erstellen kann.",
          "Weist ein Ticket länger als zwei Tage keine Aktivität auf, wird die vorgesehene Ticket-Alert-Funktion verwendet, damit der Nutzer an die ausstehende Rückmeldung erinnert wird.",
        ],
      },
      {
        title: "ABSCHLUSS",
        paragraphs: [
          "Ein Ticket wird erst geschlossen, wenn das Anliegen vollständig bearbeitet wurde, keine offenen Fragen mehr bestehen oder eine weitere Bearbeitung aufgrund fehlender Rückmeldung beziehungsweise fehlender Informationen nicht möglich ist.",
          "Vor der Schließung wird dem Nutzer kurz mitgeteilt, was mit seinem Anliegen passiert ist. Bei einer gelösten Anfrage kann der Nutzer bestätigen, dass keine weiteren Probleme bestehen. Bei fehlenden Informationen wird erklärt, warum das Ticket nicht weiter bearbeitet werden kann.",
          "Beispiel:",
          "Ein Nutzer erstellt einen Unban Request und gibt an, dass sein Ban grundlos sei. Das Ticket wird übernommen und der angegebene Spieler im Case-System überprüft. Wird ein Case gefunden, wird der dokumentierte Ban-Grund geprüft und anhand der geltenden Vorgaben entschieden. Ist der Ban weiterhin berechtigt, wird dies dem Nutzer erklärt. Ist ein Unban zulässig, wird der Spieler eindeutig identifiziert und die entsprechende Maßnahme durchgeführt. Anschließend wird der Nutzer über das Ergebnis informiert und das Ticket ordnungsgemäß geschlossen.",
          "Grundsatz: Ein Ticket wird nicht einfach beantwortet, weitergeschoben oder geschlossen. Es wird übernommen, verstanden, vollständig bearbeitet und erst dann abgeschlossen, wenn für den Nutzer klar ist, was mit seinem Anliegen passiert ist.",
        ],
      },
    ],
  },
};


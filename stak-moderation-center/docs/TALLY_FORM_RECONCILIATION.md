# Tally application form — reconciliation note

Source: <https://tally.so/r/XxXPxO>

The accessible page reader currently returns only **page 1 of 17**. It exposes this introduction:

> Internes Auswahlverfahren · STAK

The introduction explains that the application is intended to assess the applicant's experience, motivation, judgement in situations, handling of responsibility and interaction with other people and the team. It asks applicants to answer honestly and in their own words, says that situation questions should be evaluated on reasoning rather than a guessed model answer, and clarifies that submitting does not guarantee admission to the STAK staff team.

The remaining 16 pages and their exact field types, conditional logic, required flags and confirmation wording have not been independently retrieved. Do not tell applicants or management that the seeded application form is an exact Tally copy.

## Confirmed STAK application decisions represented in the code

- Public application requires acceptance of the currently published STAK policy first.
- Required acknowledgements are separate checkboxes, and the privacy notice acknowledgement is separate from staff policy acknowledgements.
- PC and laptop are the only acceptable primary work devices. PlayStation, Xbox, smartphone, tablet and other selections are ineligible and are rejected by the server.
- Avoid an empty generic "Why do you want to join?" motivation question. Prefer experience, availability and practical scenario questions that reveal judgement and willingness to take on the work.
- Management can configure form fields and question ordering without editing source code.

## Remaining source reconciliation

When the full Tally page content becomes available (for example through a structured form export or a PDF/print view that shows all 17 pages), compare each question in order and transfer its exact intent, options, help text and required status using **Team Hub → Staff Applications → Form Builder**. Re-check conditional questions manually; the current builder supports common text/choice field types but not Tally-specific branching rules yet.

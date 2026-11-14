export type AcademyLesson = {
  id: string;
  title: string;
  content: { heading: string; text: string; points?: string[] }[];
};

export type AcademyCourse = {
  key: string;
  version: string;
  title: string;
  shortDescription: string;
  audience: string;
  reviewRole: "staff-manager" | "management" | "owner";
  lessons: AcademyLesson[];
  questions: { id: string; prompt: string }[];
  practicalPrompt: string;
};

export const ACADEMY_COURSES: AcademyCourse[] = [
  {
    key: "general-staff",
    version: "1.0",
    title: "General Staff Training",
    shortDescription: "Common standards, safe moderation, records and complete ticket handling training.",
    audience: "All staff",
    reviewRole: "staff-manager",
    lessons: [
      { id: "general-role", title: "STAK role, scope and limits", content: [
        { heading: "Serve the community consistently", text: "Staff use the same published rules and procedures for every member. A role grants only the authority described by the current permission matrix. A staff title is not permission to bypass a process, promise an outcome, or use confidential information for personal reasons." },
        { heading: "Know when to stop", text: "If a request is outside your permissions, involves a conflict of interest, or has serious real-world or safety implications, pause the action and escalate to the responsible higher role. Do not investigate a colleague, close associate, or your own report without an independent reviewer." },
        { heading: "Fair decisions", text: "Separate what was observed from what is inferred. Consider relevant context, apply comparable standards, and explain decisions in neutral language. Ask for review when evidence is incomplete or rules do not clearly cover the situation." },
      ]},
      { id: "general-communication", title: "Communication, reports and evidence", content: [
        { heading: "Triage before acting", text: "Identify the request, who is affected, what outcome is being requested, and whether there is an immediate safety or privacy concern. A report is an allegation until reviewed. Avoid confirming a conclusion before checking the source material." },
        { heading: "Evidence quality", text: "Prefer original, complete screenshots or clips with enough surrounding context to understand what happened. Record who provided the evidence and when it was reviewed. Do not edit evidence in a way that changes meaning. Redact unrelated personal data before sharing it with people who do not need it." },
        { heading: "Respectful contact", text: "Ask focused questions, explain what information is missing, and avoid accusations. Do not promise anonymity, punishment, or a response time unless the current process guarantees it." },
      ]},
      { id: "general-tickets", title: "Ticket handling (required part of General Staff Training)", content: [
        { heading: "Take ownership", text: "Read the whole ticket before replying. Acknowledge the request, state what you understand, and ask only for information needed to review it. Keep one clear owner responsible for the next step; use an explicit handover if another team must take over." },
        { heading: "Review and decide", text: "Check the applicable rule and all supplied context. Use the least disruptive action that addresses the proven conduct and is within your authority. Do not share internal notes or other members’ private information with the requester." },
        { heading: "Document and close", text: "Record the relevant facts, evidence reference, action, reason, and next step in the approved staff system. Tell the requester the decision in concise, neutral language. Before closing, make sure there is no unanswered question or promised follow-up. Escalate unresolved or disputed cases rather than silently abandoning them." },
        { heading: "Security and urgency", text: "Never ask a member to post passwords, authentication codes, private addresses, or operationally sensitive material. For a credible urgent safety issue, protect exposed information and notify the appropriate senior staff immediately through the approved private route." },
      ]},
      { id: "general-security", title: "Privacy, account security and OPSEC", content: [
        { heading: "Protect access", text: "Use only your own Discord account and approved staff tools. Keep authentication details private, use available account protections, and report suspected account compromise promptly. Do not export staff databases or copy restricted records into public or personal services." },
        { heading: "Operational security", text: "Do not publish non-public real-world military locations, movements, schedules, missions, personnel details, procedures, or revealing media. Share only material cleared for public release. When unsure, do not forward it; ask an authorized manager privately." },
        { heading: "Data minimization", text: "Collect and disclose only the information needed for a defined staff task. Keep evidence and internal notes in the approved restricted system. Remove or restrict material when the responsible retention process requires it." },
      ]},
      { id: "general-records", title: "Records, escalation and handover", content: [
        { heading: "Write records another staff member can use", text: "Record date and time, relevant identity, source, verified facts, action taken, rationale, and outstanding work. Use clear language and distinguish direct evidence from a report or interpretation. Corrections should be added as a traceable follow-up rather than silently rewriting the original history." },
        { heading: "Escalate with context", text: "A useful escalation states the issue, what has already been checked, the evidence location, the risk, the action requested, and any deadline that actually exists in the current process. Avoid mass pings and duplicate tickets." },
        { heading: "Hand over safely", text: "Tell the next owner what is complete, what remains, and where the authoritative record is. Do not copy sensitive details into a broad channel. Confirm that the recipient has permission to view the material." },
      ]},
    ],
    questions: [
      { id: "g1", prompt: "A report contains only a short cropped screenshot and asks for an immediate ban. What do you check and communicate before deciding?" },
      { id: "g2", prompt: "A ticket needs action beyond your role. Describe a safe handover that preserves ownership and privacy." },
      { id: "g3", prompt: "Which information must never be shared publicly under the OPSEC standard, and what do you do if you receive it?" },
    ],
    practicalPrompt: "Write a short example response to a member reporting harassment with incomplete evidence. Include an acknowledgement, a focused request for context, a privacy reminder, and the next step. Do not decide the case before reviewing evidence.",
  },
  {
    key: "ingame",
    version: "1.0",
    title: "Ingame Training",
    shortDescription: "Assigned practical qualification for safe, consistent in-game staff actions.",
    audience: "Staff assigned to in-game duties",
    reviewRole: "staff-manager",
    lessons: [
      { id: "ingame-authority", title: "Authority and preparation", content: [
        { heading: "Confirm the assignment", text: "Before using an in-game staff tool, confirm that your current rank has permission for that action and that the situation is within the assigned duty. If the target is staff, a friend, or someone in an active dispute with you, request an independent staff member." },
        { heading: "Use staff tools proportionately", text: "Use the narrowest available action that safely resolves the issue. Do not test commands on live players, use tools for entertainment, or make promises about outcomes you cannot authorize." },
      ]},
      { id: "ingame-interaction", title: "Player contact and de-escalation", content: [
        { heading: "Give clear instructions", text: "Identify yourself as staff, describe the specific behavior that needs to stop, and give a calm, reasonable instruction. Avoid sarcasm, threats, public arguments, or repeated commands that add confusion." },
        { heading: "Separate immediate safety from later review", text: "If an immediate intervention is needed to stop ongoing disruption, act within your permission and record why. Review evidence and longer-term consequences separately, with a second reviewer when the action is serious or disputed." },
      ]},
      { id: "ingame-evidence", title: "Evidence and incident notes", content: [
        { heading: "Capture relevant context", text: "Record the player’s game identity, approximate time, location within the game if needed, observed conduct, witnesses, and the evidence source. Preserve context around a clip or screenshot and keep sensitive material in the restricted system." },
        { heading: "Document the action", text: "Write what you personally observed separately from what others reported. Record the tool or action used, its scope, the reason, and any follow-up required. Do not rely on memory when an approved record can be made promptly." },
      ]},
      { id: "ingame-emergency", title: "Escalation and handover", content: [
        { heading: "Escalate safely", text: "Ask for a higher role when the event involves serious harm, repeated incidents, uncertain authority, a possible exploit, or a complaint against staff. Share the minimum evidence needed and link the case rather than reposting private material." },
        { heading: "Return to normal duties", text: "After intervention, confirm the incident is documented, tell the player what happens next if appropriate, and hand over open work. Do not continue a confrontation after another authorized staff member takes ownership." },
      ]},
    ],
    questions: [
      { id: "i1", prompt: "A player you know personally is involved in a report. How do you handle the conflict of interest?" },
      { id: "i2", prompt: "What facts and evidence belong in an in-game incident record?" },
    ],
    practicalPrompt: "Describe how you would respond to an escalating in-game dispute: initial instruction, safe intervention within authority, evidence capture, and handover for review.",
  },
  {
    key: "staff-manager",
    version: "1.0",
    title: "Staff Manager Training",
    shortDescription: "Team coordination, quality review, staff support and controlled administration.",
    audience: "Staff Managers and higher",
    reviewRole: "management",
    lessons: [
      { id: "sm-operations", title: "Team operations and role boundaries", content: [
        { heading: "Coordinate work clearly", text: "Assign an accountable owner, clarify the requested outcome, and make dependencies visible. Check workload and availability before adding assignments. Keep operational instructions in the approved private channels and maintain a current record of decisions that affect staff work." },
        { heading: "Apply the permission matrix", text: "A manager coordinates and reviews work within the assigned authority. Changes to role access, policy, or a serious sanction require the approval path defined by STAK. Do not infer authority from seniority alone." },
      ]},
      { id: "sm-support", title: "Absence, onboarding and staff support", content: [
        { heading: "Handle absences consistently", text: "Acknowledge a submitted absence, clarify dates only when needed, and record the management decision. Do not request unnecessary personal details. Keep future and active absences distinct and avoid treating an absence as misconduct." },
        { heading: "Support new staff", text: "Assign the required General Staff Training, explain the approved escalation route, and review learning evidence before recommending access changes. Give specific feedback and a clear next action; do not invent deadlines or pass thresholds." },
      ]},
      { id: "sm-review", title: "Warnings and quality review", content: [
        { heading: "Use a fair record", text: "A staff warning needs a factual reason, relevant evidence, a proportionate response, and the correct approval. Keep internal notes separate from the staff-facing explanation. Record resolution or revocation as a reasoned, traceable event." },
        { heading: "Review decisions independently", text: "Check both the evidence and the procedure. Ask for the affected staff member’s response where the current process allows it. Escalate conflicts, allegations about management, or serious consequences to a higher independent reviewer." },
      ]},
      { id: "sm-announcements", title: "Announcements and acknowledgement", content: [
        { heading: "Write actionable notices", text: "State who needs to know, what changes, what action is required, and the effective date if one is confirmed. Mark acknowledgement required only when a positive confirmation is genuinely needed. Avoid converting an unconfirmed response window into a disciplinary deadline." },
        { heading: "Track delivery truthfully", text: "Distinguish an announcement saved in the staff portal from one delivered through Discord. Review recipient and delivery status when the bot integration reports them. Follow up manually through the approved staff process; do not issue an automatic warning solely because an acknowledgement is missing." },
      ]},
    ],
    questions: [
      { id: "m1", prompt: "A staff member has not acknowledged an important announcement. What can you do, and what should not happen automatically?" },
      { id: "m2", prompt: "A warning request concerns a close colleague. How do you preserve a fair and independent review?" },
    ],
    practicalPrompt: "Prepare a short manager handover for a pending staff concern. Include verified facts, confidential evidence location, current owner, next action, and the independent escalation route.",
  },
  {
    key: "management",
    version: "1.0",
    title: "Management Training",
    shortDescription: "Governance, sensitive incidents, permissions and independent decision review.",
    audience: "Management, Co-Owners and Owners",
    reviewRole: "owner",
    lessons: [
      { id: "mg-governance", title: "Policy and decision governance", content: [
        { heading: "Make controlled changes", text: "Base policy and permission changes on a documented need, an authorized decision, and a review of affected workflows. Publish the effective version and explain the change to the staff who must apply it. Preserve prior versions and approval history." },
        { heading: "Separate roles", text: "When practical, separate the person who investigates, the person who approves a serious action, and the person who handles an appeal. If the team size makes this impossible, document the limitation and use the highest available independent review." },
      ]},
      { id: "mg-incidents", title: "Serious incidents and confidentiality", content: [
        { heading: "Contain and preserve", text: "For a serious privacy, safety, or security incident, limit further exposure, preserve relevant evidence, and contact only the people responsible for response. Avoid reposting leaked material or speculating publicly." },
        { heading: "Keep the record factual", text: "Separate confirmed facts, credible reports, and open questions. Record who was notified and what containment steps were taken. Do not promise external outcomes or deadlines unless they are confirmed by the responsible authority." },
      ]},
      { id: "mg-permissions", title: "Access, bot and website boundaries", content: [
        { heading: "Least privilege", text: "Grant only access needed for the current role. Review access after a role change and remove it when a staff member leaves. Never put bot tokens or signing secrets in browser code, public source, or a staff announcement." },
        { heading: "System ownership", text: "The website is the record of applications, staff data, academy history, cases, announcements, and approvals. The Discord bot is authoritative for Discord ticket mechanics, role assignment, and Discord-side security. Use a documented integration rather than duplicating the same database." },
      ]},
      { id: "mg-review", title: "Appeals, audit and continuous improvement", content: [
        { heading: "Independent review", text: "Review whether the initial action followed policy, whether evidence supports the finding, and whether the response was proportionate. Record the decision and reason without deleting the initial action. Correct errors through an additional history entry." },
        { heading: "Improve the process", text: "Look for repeated confusion, missing guidance, or inconsistent outcomes. Update training and policy through versioned review. Avoid setting arbitrary pass scores, retry caps, or deadlines where the approved standard does not define them." },
      ]},
    ],
    questions: [
      { id: "o1", prompt: "How should a serious action be reviewed when the original decision maker has a conflict of interest?" },
      { id: "o2", prompt: "Describe the difference between a website announcement being saved and being delivered to Discord staff." },
    ],
    practicalPrompt: "Write a management review note for a disputed staff decision. Separate verified evidence, unresolved questions, applicable authority, conflict checks, decision, and follow-up owner.",
  },
];

export function getAcademyCourse(key: string): AcademyCourse | undefined {
  return ACADEMY_COURSES.find((course) => course.key === key);
}

export function roleRank(role: string | null | undefined): number {
  return ({
    "trail-moderator": 1,
    moderator: 2,
    "staff-manager": 3,
    management: 4,
    "co-owner": 5,
    owner: 6,
  } as Record<string, number>)[role ?? ""] ?? 0;
}

export type CommunityRule = {
  number: string;
  title: string;
  points: string[];
};

export const COMMUNITY_RULES_VERSION = "2026";

export const COMMUNITY_RULES: CommunityRule[] = [
  {
    number: "01",
    title: "Scope & Purpose",
    points: [
      "These rules apply to all members and areas of the community, including those who are only reading.",
      "Our goal is a safe, respectful, and constructive exchange. Behavior that endangers this goal is prohibited.",
    ],
  },
  {
    number: "02",
    title: "Respect & Human Dignity",
    points: [
      "Treat everyone with respect and fairness. Insults, provocation, and degrading behavior are not allowed — even as a joke.",
      "Discrimination based on origin, gender or identity, religion or worldview, orientation, or physical or mental characteristics is prohibited.",
    ],
  },
  {
    number: "03",
    title: "Communication & Criticism",
    points: [
      "Different opinions are welcome. Keep discussions calm, objective, and respectful; criticize ideas, not people.",
      "Avoid personal attacks, accusations, deliberate misinterpretations, and escalation.",
      "Keep feedback specific and solution-oriented, and remember that this is a public community.",
    ],
  },
  {
    number: "04",
    title: "Conflicts & Harassment",
    points: [
      "Harassment, bullying, and targeted intimidation are prohibited.",
      "Keep personal conflicts out of public channels. Contact the moderation team or open a ticket if you need help.",
      "Include relevant evidence, such as screenshots or clips, with reports and tickets. Remove private or operationally sensitive details first.",
    ],
  },
  {
    number: "05",
    title: "Violence, Hate & Extremism",
    points: [
      "Glorifying violence, dehumanizing content, and extremist or radical content are prohibited.",
      "Calls for hate or violence will result in moderation action.",
    ],
  },
  {
    number: "06",
    title: "Operational Security (OPSEC)",
    points: [
      "Do not share non-public or operationally sensitive information about real-world military activity in public channels.",
      "This includes locations, movements, dates or times, missions, unit or personnel details, security procedures, and photos or documents that reveal them.",
      "Share only information cleared for public release.",
    ],
  },
  {
    number: "07",
    title: "Sensitive Content",
    points: [
      "Handle discussions of war, terrorism, disasters, and similar topics carefully. Do not spread unverified reports.",
      "NSFW, sexually explicit, or excessively graphic/NSFL content is prohibited. Moderators decide whether sensitive content may remain.",
    ],
  },
  {
    number: "08",
    title: "Truthful & Relevant Content",
    points: [
      "Do not deliberately spread misinformation or rumors. Posts should be factual and verifiable.",
      "Keep posts relevant to the community. Irrelevant content may be removed; repeated violations may lead to sanctions.",
    ],
  },
  {
    number: "09",
    title: "Spam, Disruption & Advertising",
    points: [
      "Spam, flooding, meaningless repetition, and intentional disruption are prohibited.",
      "Advertising, self-promotion, recruiting, and solicitation require permission. Unauthorized promotion will be removed.",
    ],
  },
  {
    number: "10",
    title: "Privacy & Moderation",
    points: [
      "Share private or confidential information only with consent. Personal data and messages — yours and others’ — must remain private.",
      "Follow moderator instructions. Discuss moderation decisions privately, not publicly, and avoid unnecessary pings.",
      "Rule violations may lead to content removal or sanctions, including removal from the community.",
    ],
  },
];

export const COMMUNITY_RULES_CLOSING =
  "By participating, you agree to follow these community rules.";

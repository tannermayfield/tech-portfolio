// Single source of truth for personal info. Everything here came from Tanner (prompt or
// resume). Do not invent values. Unknown fields should be left out so the UI hides them.

export const profile = {
  name: "Tanner Mayfield",
  domain: "tannermayfield.dev",
  descriptor: "Adaptive Software Engineer", // intentionally rendered small and subtle
  headline: "Software that adapts to people, problems, and goals.",
  intro:
    "I'm an Information Systems student at Brigham Young University building AI-assisted, full-stack software. I'm looking for software engineering, AI, and full-stack internships.",
  location: "Provo, UT",
  links: {
    github: "https://github.com/tannermayfield",
    siteRepo: "https://github.com/tannermayfield/tech-portfolio",
    linkedin: "https://www.linkedin.com/in/tanner-mayfield",
    email: "tannerjamesmayfield@gmail.com",
    resume: "/Tanner_Mayfield_Resume.pdf",
    // TODO(Tanner): build the "fun, creative portfolio" (Apple Music soundtrack, AI tech, a deeper
    // look at you), then set this to its URL. While null, the home page shows a "Coming soon" button.
    funPortfolio: null as string | null,
  },
  // TODO(Tanner): add a real photo to /public (e.g. /profile.jpg) and set it here. While null,
  // the About section shows a "TM" monogram in the same frame.
  photo: null as string | null,
} as const;

// Source: resume PDF supplied by Tanner. Dates and bullets are quoted from it.
export const education = {
  school: "Brigham Young University",
  unit: "Marriott School of Business, Provo, UT",
  degree: "B.S. Information Systems",
  focus: "Product & Project Management focus · Minor in Spanish",
  date: "Apr 2026", // as printed on the resume
  majorGpa: "3.72",
  courses: {
    past: ["Intro to Information Systems", "Intro to Computer Programming", "Spreadsheets & Business Analysis"],
    current: ["Project Management & System Design", "Database Systems", "Business Programming", "IT Infrastructure"],
  },
  involvement: ["Association for Information Systems (AIS)"],
};

export type Role = {
  /** Short label for the experience tab / card heading. */
  tab: string;
  title: string;
  org: string;
  place?: string;
  dates: string;
  kind: "project" | "work" | "volunteer";
  bullets: string[];
};

export const roles: Role[] = [
  {
    tab: "BravOS",
    title: "Product Designer & Developer",
    org: "AI-Assisted Personal Operating System (BravOS)",
    dates: "May 2026 – Present",
    kind: "project",
    bullets: [
      "Accelerated feature development by ~8x by orchestrating Codex and Claude Code across smaller parallel tasks",
      "Applied spec-driven development to convert product goals into technical specifications and testable implementation plans",
      "Integrated and tested AI-generated code across multiple workstreams to maintain consistent system functionality",
    ],
  },
  {
    tab: "Language-Learning Platform",
    title: "Product Designer & Developer",
    org: "AI-Assisted Language-Learning Platform",
    dates: "Oct 2025 – Present",
    kind: "project",
    bullets: [
      "Accelerated development by ~4x using Codex and Claude Code to build and test features in JavaScript and HTML/CSS",
      "Translated product ideas and user flows into AI technical prompts, requirements, and unique specifications",
      "Iterated on AI-generated code through detailed review, debugging, and testing to improve functionality and user experience",
    ],
  },
  {
    tab: "Missionary Training Center",
    title: "Spanish Teacher",
    org: "Missionary Training Center",
    place: "Provo, UT",
    dates: "Apr 2026 – Present",
    kind: "work",
    bullets: [
      "Created a centralized planning document to cut class preparation time by 50%",
      "Built an automated performance tracker using Excel to identify the specific needs of struggling students efficiently",
      "Taught Spanish to groups of 10+ students; 30% of supported students received intermediate fluency scores in 6 weeks",
    ],
  },
  {
    tab: "BYU Continuing Education",
    title: "Online Spanish Tutor",
    org: "BYU Continuing Education",
    place: "Provo, UT",
    dates: "Sep 2024 – Apr 2026",
    kind: "work",
    bullets: [
      "Built and deployed an AI-powered assistant to increase tutor productivity by 50% among a team of 10 tutors",
      "Leveraged CRM systems to manage student data and provide oral and written communication with 100+ parents",
      "Trained and onboarded a team of 5 tutors, led weekly team meetings, and contributed to improving hiring processes",
      "Delivered personalized Spanish instruction to 100+ students, adapting learning strategies specific to students' needs",
    ],
  },
  {
    tab: "Volunteer Representative",
    title: "Volunteer Representative",
    org: "The Church of Jesus Christ of Latter-day Saints",
    place: "St. George, UT",
    dates: "Jul 2022 – Jul 2024",
    kind: "volunteer",
    bullets: [
      "Oversaw 50+ peer volunteers, conducting trainings, leading group meetings, and providing individualized mentoring",
      "Leveraged performance data daily to track progress, identify trends, and drive improvements across a team of 50+ peers",
    ],
  },
];

export const other = {
  languages: "Fluent in English and Spanish; currently studying Portuguese and ASL",
  music: "Piano, drums, and guitar",
  interests: "Baseball, basketball, group sports/games, music, movies/shows, languages, and technology",
};

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
    resume: "/Tanner_Mayfield_IS_Resume.docx",
    // TODO(Tanner): build the "fun, creative portfolio" (Apple Music soundtrack, AI tech, a deeper
    // look at you), then set this to its URL. While null, the home page shows a "Coming soon" button.
    funPortfolio: null as string | null,
  },
  // TODO(Tanner): add a real photo to /public (e.g. /profile.jpg) and set it here. While null,
  // the About section shows a "TM" monogram in the same frame.
  photo: "/profile.jpg" as string | null,
} as const;

// Source: current resume DOCX supplied by Tanner. Dates and bullets follow that document.
export const education = {
  school: "Brigham Young University",
  unit: "Marriott School of Business, Provo, UT",
  degree: "Bachelor of Science: Information Systems",
  minor: "Spanish",
  date: "Apr 2028",
  majorGpa: "3.72",
  seeking: "a Master’s in Information Systems Management",
  courses: {
    current: ["Database Systems", "Business Programming", "IT Infrastructure", "Project Management & System Design"],
    upcoming: ["Predictive AI in Business (Machine Learning Foundations)", "Agentic AI in Business", "IS Security & Controls"],
    upcomingTerm: "Winter 2027",
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
  projectSlug?: string;
  bullets: string[];
};

export const roles: Role[] = [
  {
    tab: "Airline Intelligence",
    title: "Data & AI Developer",
    org: "Airline Intelligence (Individual Project)",
    dates: "Oct 2026 – Present",
    kind: "project",
    projectSlug: "airline-operations",
    bullets: [
      "Building an airline operations data pipeline using Python, SQL, PostgreSQL, and AWS to support operational analysis",
      "Creating ETL/ELT workflows and data-quality checks to transform raw flight data into reliable, analysis-ready datasets",
      "Designing Tableau and Excel dashboards to track operational KPIs, delays, disruptions, and performance trends",
      "Developing predictive models to estimate flight-delay and disruption risk using historical operational and weather data",
    ],
  },
  {
    tab: "AI-Assisted Personal Operating System",
    title: "Product Designer & Developer",
    org: "AI-Assisted Personal Operating System",
    dates: "Oct 2025 – Present",
    kind: "project",
    projectSlug: "bravos",
    bullets: [
      "Accelerated feature development by ~8x by orchestrating Codex and Claude Code across smaller parallel tasks",
      "Applied spec-driven development to convert product goals into technical specifications and testable implementation plans",
      "Integrated and tested AI-generated code across multiple workstreams to maintain consistent system functionality",
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
      "Taught Spanish to groups of 10+ students; over 50% of supported students received intermediate fluency scores in 6 weeks",
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
  music: "Piano and drums; played in a local community band",
  interests: "Baseball and basketball; played on travel teams",
};

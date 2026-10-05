// Project data lives here, separate from presentation. Adding a project = adding one object.
// Rules: only state what Tanner has told us. Unknowns are omitted and their sections hidden.
// `statusConfirmed: false` means the status is our best reading and needs Tanner's confirmation.

export type Status = "Live" | "MVP" | "Prototype" | "In Development" | "Research" | "Concept";
export type Lens = "ai" | "data" | "fullstack";

export type Project = {
  slug: string;
  title: string;
  tagline: string;
  status: Status;
  statusConfirmed: boolean;
  tier: "featured" | "exploring" | "self";
  order: number;
  lenses: Lens[]; // which focus areas this project is evidence for
  stack: string[];
  links: { github?: string; demo?: string };
  card: { problem: string; built: string; learned?: string };
  /** Case-study sections (the agreed structure). Missing ones are not rendered. */
  study: Partial<{
    problem: string;
    targetUser: string;
    whyItMatters: string;
    productDecisions: string[];
    mvpScope: string[];
    architecture: string;
    dataModel: string;
    challenges: string[];
    tradeoffs: string[];
    learned: string[];
    next: string[];
    /** Honest split between what exists and what is vision. */
    today: string[];
    vision: string[];
  }>;
};

export const projects: Project[] = [
  {
    slug: "bravos",
    title: "BravOS",
    tagline: "An adaptive AI workspace that assembles itself around what you're trying to do.",
    status: "In Development",
    statusConfirmed: false,
    tier: "featured",
    order: 1,
    lenses: ["ai", "fullstack", "data"],
    stack: ["Codex", "Claude Code"], // TODO(Tanner): confirm full stack (frontend, backend, DB, hosting)
    links: {}, // TODO(Tanner): repo / demo
    card: {
      problem: "Getting through a day means hopping between separate apps for money, calendar, tasks, and school.",
      built: "MVP focus on three tools: Finance Tracker, Calendar / Daily Task Manager, and School Assignment Tracker.",
      learned: "Spec-driven development: turning a product goal into specs and testable plans before orchestrating AI agents.",
    },
    study: {
      problem:
        "People move between many separate applications to manage money, time, tasks, and school. The context that connects them lives in the user's head.",
      targetUser: "Students and early-career people juggling coursework, deadlines, a calendar, and personal finances.",
      whyItMatters:
        "A workspace that understands the task at hand removes the overhead of switching tools and deciding what to look at first.",
      productDecisions: [
        "Start as a flexible workspace and assemble tools, widgets, and information around the user's current goal, rather than forcing a fixed dashboard.",
        "Pick a small first set of tools (finance, calendar/tasks, assignments) that naturally share data.",
      ],
      mvpScope: ["Finance Tracker", "Calendar / Daily Task Manager", "School Assignment Tracker"],
      today: [
        "MVP scope is defined around the three tools above.",
        "Built with a spec-driven workflow, orchestrating Codex and Claude Code across parallel tasks (per my resume).",
      ],
      vision: [
        "The tools work together: asking “What should I focus on today?” combines calendar events, tasks, assignments, deadlines, and priorities into a relevant workspace.",
        "The interface is composed dynamically from the user's goal instead of being navigated manually.",
      ],
      next: ["Connect the three tools through a shared data model.", "Build the first goal-driven “focus today” workspace."],
      // TODO(Tanner): which tools work today, architecture, data model, challenges, tradeoffs, screenshots.
    },
  },
  {
    slug: "skill-projects",
    title: "Skill Projects",
    tagline: "Connects career goals to skills, learning, projects, and evidence.",
    status: "In Development",
    statusConfirmed: false,
    tier: "featured",
    order: 2,
    lenses: ["fullstack", "data"],
    stack: [], // TODO(Tanner)
    links: {},
    card: {
      problem: "Students learn disconnected concepts in classes and tutorials with no system tying them to the career they want.",
      built: "A full-stack app for tracking the path Career Goals → Skills → Learning → Projects → Evidence → Portfolio.",
    },
    study: {
      problem:
        "Students pick up many concepts across classes, tutorials, and projects, but nothing connects what they learn to the career they are aiming for.",
      targetUser: "Students building toward a technical career who need to turn coursework into portfolio evidence.",
      whyItMatters: "Recruiters hire on evidence. Learning that is never connected to a project or proof is easy to lose.",
      productDecisions: [
        "Model the whole chain (goal → skill → learning → project → evidence → portfolio) as connected data, not separate lists.",
      ],
      mvpScope: [
        "Identify target careers",
        "Determine needed skills",
        "Track skill development",
        "Connect skills to projects, and coursework to practical application",
        "Store evidence of learning",
      ],
      dataModel:
        "The domain is naturally relational: careers need skills, skills link to projects and learning, projects hold evidence.",
      vision: ["Help users build stronger portfolio projects based on the gaps in their evidence."],
      // TODO(Tanner): what is built today, stack, actual schema/ERD, screenshots, challenges, tradeoffs.
    },
  },
  {
    slug: "language-learning",
    title: "Adaptive Language Learning",
    tagline: "AI-powered language learning built around personalization, not a copy of existing apps.",
    status: "In Development",
    statusConfirmed: false,
    tier: "featured",
    order: 3,
    lenses: ["ai", "fullstack"],
    stack: ["JavaScript", "HTML/CSS", "Codex", "Claude Code"],
    links: {},
    card: {
      problem: "Most language apps give every learner the same path regardless of weaknesses, goals, or accent.",
      built: "Features built and tested in JavaScript and HTML/CSS using AI agentic workflows (since Oct 2025).",
      learned: "Reviewing, debugging, and testing AI-generated code to improve functionality and user experience.",
    },
    study: {
      problem: "Traditional language-learning apps treat learners the same. Differences in weaknesses, style, and goals are mostly ignored.",
      targetUser: "Language learners who want practice shaped to their goals and the region or accent they care about.",
      productDecisions: [
        "Personalization is the differentiator, not feature parity with existing apps.",
        "Translate product ideas and user flows into precise AI prompts, requirements, and specifications (per my resume).",
      ],
      today: ["Core features are built and tested in JavaScript and HTML/CSS."], // TODO(Tanner): list which features work
      vision: [
        "Adapt to the learner's weaknesses, learning style, progress, and goals.",
        "Target the region or accent the learner wants.",
        "Learn which exercise types work best for each learner.",
      ],
    },
  },
  {
    slug: "gospel-study",
    title: "Gospel Study App",
    tagline: "Scripture study that keeps the reading at the center.",
    status: "Prototype",
    statusConfirmed: false,
    tier: "featured",
    order: 4,
    lenses: ["fullstack"],
    stack: [], // TODO(Tanner)
    links: {},
    card: {
      problem: "Deep scripture study means constantly leaving the text for definitions, context, and notes.",
      built: "Focused on a reading-first experience. Planned: tap an unfamiliar or Latter-day Saint-specific word for a clear contextual definition.",
    },
    study: {
      problem: "Studying scripture deeply usually means leaving the reading to look things up.",
      targetUser: "Individuals, teachers, and speakers preparing personal study, lessons, or talks.",
      productDecisions: ["The reading content stays central. Study tools come to the reader instead of sending them away."],
      vision: [
        "Click an unfamiliar or Latter-day Saint-specific word for a clear contextual definition.",
        "Historical context, cross-references, notes, people and places.",
        "Lesson preparation, talk preparation, and Come, Follow Me study support.",
      ],
      // TODO(Tanner): which of these work today, and confirm status.
    },
  },
  {
    slug: "lecture-app",
    title: "Lecture App",
    tagline: "Connecting the live lecture to what students learn afterward. Working names: LectConnect, Lexure.",
    status: "Research",
    statusConfirmed: true,
    tier: "exploring",
    order: 5,
    lenses: ["ai", "data"],
    stack: [],
    links: {},
    card: {
      problem: "In lectures, students listen, follow slides, and take notes at once, and context gets lost.",
      built: "Concept and research stage. Not a built application.",
    },
    study: {
      problem: "During a lecture students must listen, understand, navigate slides, and take notes simultaneously, so important context is lost.",
      targetUser: "Students in lecture-based classes, and the teachers who run them.",
      mvpScope: [
        "Teachers create a class section and upload slides",
        "Students follow slides and can go back and forward when allowed",
        "A button returns students to the teacher's current slide",
        "Teachers can optionally restrict navigation",
      ],
      vision: [
        "Teacher speech is transcribed and shown alongside the current slide.",
        "Student questions could be captured into the lecture transcript.",
        "Slides + transcript + notes generate summaries, key concepts, study questions, flashcards, practice, and application exercises.",
      ],
    },
  },
  {
    slug: "tech-portfolio",
    title: "This Portfolio",
    tagline: "A real project: Next.js, Tailwind, and an interface that adapts to the visitor.",
    status: "In Development",
    statusConfirmed: true,
    tier: "self",
    order: 6,
    lenses: ["fullstack"],
    stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Git/GitHub"],
    links: { github: "https://github.com/tannermayfield/tech-portfolio" },
    card: { problem: "A resume can't show how I think.", built: "A data-driven static site with a focus lens that reorders content." },
    study: {},
  },
];

export const smallWork: { title: string; blurb: string; lenses: Lens[] }[] = [
  {
    title: "Tip Calculator",
    blurb: "JavaScript app: bill amount, tip %, tip and total, bill splitting, with input validation.",
    lenses: ["fullstack"],
  },
  {
    title: "Playlist Analysis Tool",
    blurb: "JavaScript over song data: total duration, average length, longest and shortest song.",
    lenses: ["fullstack", "data"],
  },
  {
    title: "Dating App Database Design",
    blurb: "Relational design with users, profiles, messages, and matches: foreign keys, one-to-one relationships, ERD.",
    lenses: ["data"],
  },
];

export const lensInfo: Record<Lens | "all", { label: string; blurb: string }> = {
  all: { label: "Overview", blurb: "Everything, in the order I'd tell it." },
  ai: { label: "AI", blurb: "AI application design and AI-assisted development workflows." },
  data: { label: "Data", blurb: "Relational modeling, SQL, and the data behind each product." },
  fullstack: { label: "Full-stack", blurb: "Shipping working apps end to end." },
};

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

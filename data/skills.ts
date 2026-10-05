// Skills grouped by area. Every item came from Tanner (prompt or resume).
// `evidence` links a skill to the project slugs that demonstrate it. No percentages.
// An empty evidence list means "listed, but no project linked yet": the UI says so honestly.
import type { Lens } from "./projects";

export type Skill = { name: string; evidence: string[] };
export type SkillGroup = { area: string; lens: Lens | null; note: string; skills: Skill[] };

export const skillGroups: SkillGroup[] = [
  {
    area: "AI engineering",
    lens: "ai",
    note: "Designing AI features and building quickly with agentic tools.",
    skills: [
      { name: "AI-assisted development (Codex, Claude Code)", evidence: ["bravos", "language-learning"] },
      { name: "Spec-driven development", evidence: ["bravos"] },
      { name: "Adaptive software concepts", evidence: ["bravos", "language-learning"] },
      { name: "Machine learning & generative AI", evidence: [] },
    ],
  },
  {
    area: "Database",
    lens: "data",
    note: "Modeling data so products can grow.",
    skills: [
      { name: "SQL / PostgreSQL", evidence: ["skill-projects"] },
      { name: "Relational modeling & ERDs", evidence: ["skill-projects"] },
    ],
  },
  {
    area: "Full-stack",
    lens: "fullstack",
    note: "From idea to a working application.",
    skills: [
      { name: "JavaScript", evidence: ["language-learning", "tech-portfolio"] },
      { name: "HTML / CSS", evidence: ["language-learning"] },
      { name: "Node.js", evidence: [] },
      { name: "Python", evidence: [] },
    ],
  },
  {
    area: "Product",
    lens: null,
    note: "Deciding what to build and why.",
    skills: [
      { name: "User research & problem discovery", evidence: ["skill-projects"] },
      { name: "PRDs & feature prioritization", evidence: ["bravos"] },
      { name: "Project management", evidence: [] },
    ],
  },
  {
    area: "Infrastructure & analytics",
    lens: null,
    note: "Shipping it and understanding the data.",
    skills: [
      { name: "Git / GitHub", evidence: ["tech-portfolio"] },
      { name: "AWS & deployment", evidence: [] },
      { name: "Tableau, Power BI, Advanced Excel, VBA", evidence: [] },
    ],
  },
];

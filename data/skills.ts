// Skills grouped by area. Every item below comes from Tanner's current resume.
// `evidence` links a skill to the project slugs that demonstrate it. No percentages.
// An empty evidence list means "listed, but no project linked yet": the UI says so honestly.
import type { Lens } from "./projects";

export type Skill = { name: string; evidence: string[] };
export type SkillGroup = { area: string; lens: Lens | null; note: string; skills: Skill[] };

export const skillGroups: SkillGroup[] = [
  {
    area: "Data Analytics",
    lens: "data",
    note: "Analyzing, modeling, and communicating data.",
    skills: [
      { name: "Python", evidence: ["airline-operations"] },
      { name: "SQL", evidence: ["airline-operations"] },
      { name: "PostgreSQL", evidence: ["airline-operations"] },
      { name: "Pandas", evidence: [] },
      { name: "NumPy", evidence: [] },
      { name: "Tableau", evidence: ["airline-operations"] },
      { name: "Power BI", evidence: [] },
      { name: "Excel", evidence: ["airline-operations"] },
      { name: "VBA", evidence: [] },
      { name: "Microsoft Office Suite", evidence: [] },
    ],
  },
  {
    area: "Database Design",
    lens: "data",
    note: "Designing relational data structures and improving data processes.",
    skills: [
      { name: "Relational Database Design", evidence: ["skill-projects"] },
      { name: "Data Modeling", evidence: ["skill-projects"] },
      { name: "ERDs", evidence: ["skill-projects"] },
      { name: "Data Analysis", evidence: ["airline-operations"] },
      { name: "Process Improvement", evidence: [] },
      { name: "Supabase", evidence: [] },
    ],
  },
  {
    area: "Artificial Intelligence",
    lens: "ai",
    note: "Applying AI and developing with AI tools.",
    skills: [
      { name: "Machine Learning Fundamentals", evidence: ["airline-operations"] },
      { name: "Codex", evidence: ["bravos"] },
      { name: "Claude Code", evidence: ["bravos"] },
    ],
  },
  {
    area: "Cloud & Development",
    lens: "fullstack",
    note: "Building software and working with cloud tools.",
    skills: [
      { name: "AWS", evidence: ["airline-operations"] },
      { name: "Git/GitHub", evidence: ["tech-portfolio"] },
      { name: "JavaScript", evidence: ["language-learning", "tech-portfolio"] },
      { name: "Node.js", evidence: [] },
      { name: "HTML/CSS", evidence: ["language-learning"] },
    ],
  },
];

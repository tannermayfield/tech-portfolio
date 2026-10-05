# PROJECT.md — Tanner Mayfield's Tech Portfolio

> **Decisions revised after Tanner's feedback (supersedes §7 stack and §8 palette below):**
> - **Stack:** Next.js (static export) + React + TypeScript + Tailwind CSS v4, not Astro/plain CSS,
>   so the site itself can be adaptive. Hosting: Vercel (default) at tannermayfield.dev.
> - **Identity:** the site *demonstrates* "Adaptive Software Engineer" via a **focus lens**
>   (Overview / AI / Data / Full-stack) that reorders projects and highlights skills. The title text
>   itself is deliberately subtle: a small caption in the hero, not the headline.
> - **Palette:** beach themed. Light = sand, foam, deep-ocean ink, teal accent, coral for decoration only.
>   Dark = "night tide". Single wave motif; no other decoration.
> - **Source of facts:** resume PDF (public/Tanner_Mayfield_Resume.pdf) plus the original brief.
> - Project statuses with `statusConfirmed: false` in `data/projects.ts` still need Tanner's confirmation.
> - Layout now: `app/` (routes), `components/`, `data/` (profile, projects, skills).
>
> Everything else below is the original proposal and still applies unless noted above.

## 1. Purpose

Help Tanner land software engineering, AI, and full-stack internships. The site should
show who he is, what he can build, how he thinks, and the evidence behind his skills.
Optimize for **credibility, clarity, evidence, and quality** — not feature count.

Positioning: an ambitious Information Systems student at BYU who combines product
thinking, database design, full-stack development, AI, and infrastructure. Not an
expert, not senior. "Adaptive Software Engineer" is a flavor, not the headline; the
page must make "software engineering internships" obvious within seconds.

## 2. Current repository state

- One commit (`Initial commit`), branch `main`, clean tree.
- Only file: `README.md` (two lines). No code, no config, no deploy setup.
- Toolchain on this machine: Node v24.19.0, npm 11.17.0.

## 3. Content rules (non-negotiable)

1. **No invented facts.** Missing info becomes a visible `TODO` in data files, never a
   made-up value. No fake dates, titles, employers, metrics, links, or contact info.
2. **Status labels are honest.** Every project carries one of:
   `Live · MVP · Prototype · In Development · Research · Concept`.
3. **Built vs. planned is always separated** on case studies ("What exists today" vs.
   "Vision / next"). Never imply future functionality exists.
4. **Skills are listed only if Tanner provided them**, and each links to project evidence.
   No percentage bars.
5. Unknown links (GitHub repos, demos, LinkedIn, résumé PDF, email) are placeholders that
   are *hidden from the rendered page* until filled, and flagged by a build-time check.

## 4. Site architecture

Static multi-page site. Few routes, each with one job.

| Route | Job |
|---|---|
| `/` | Hero, featured projects (4), evidence-linked skills summary, short about, contact CTA |
| `/projects` | Full project index: featured, exploration/research, smaller academic work |
| `/projects/[slug]` | Reusable case study (see §6) |
| `/about` | Concise, human story + education/experience + résumé |
| `/contact` | GitHub, LinkedIn, email, résumé, tannermayfield.dev |

Skills live as a section on the home page and the about page (not a separate route in
V1); each skill chip links to the projects that evidence it.

## 5. Information hierarchy (home page, top to bottom)

1. **Hero** — name, "Information Systems @ BYU", one-line value statement, primary CTA
   (View projects) and secondary CTA (Résumé / Contact).
2. **Featured projects** — BravOS, Skill Projects, Language Learning App, Gospel Study
   App. Card = problem, what's built, stack, status badge, what I learned, links.
3. **How I work** — the product → data → full-stack → AI → infrastructure story, as a
   short, concrete strip (this is the differentiator).
4. **Skills by evidence** — Full-Stack, Database, AI, Product, Infrastructure; each item
   links to a project.
5. **Exploring** — Lecture App (Research/Concept), clearly labeled.
6. **About snippet + Contact** — short, then links.

Smaller projects (Tip Calculator, Playlist Analysis, Database Design/dating app) go in a
quiet "Smaller work" list on `/projects`, not the homepage, unless they earn a place
as evidence for a specific skill (the dating-app schema is genuine evidence for
database modeling).

## 6. Case-study structure (reusable)

Each project is one Markdown file with validated frontmatter. Body uses these H2s, in
order. Sections with no content are **omitted**, so Concept/Research projects aren't
padded; a build warning lists what's missing.

1. Problem · 2. Target user · 3. Why it matters · 4. Product decisions · 5. MVP scope ·
6. Architecture · 7. Data model · 8. Technologies · 9. Screenshots / demo ·
10. Challenges · 11. Tradeoffs · 12. What I learned · 13. What I'd build next

Frontmatter (card data): `title, slug, status, featured, order, summary, problem,
built, builtVsPlanned, stack[], skills[], learned, links{github,demo}`.

## 7. Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro** (static output) | Content-first, ships ~zero JS by default, fast, accessible by default |
| Content | Astro **content collections** (Markdown + Zod schema) | Add a project = add one `.md` file; schema catches mistakes |
| Styling | **Plain CSS** with custom properties (design tokens) | No dependency, easy dark mode, full control of typography |
| Language | TypeScript (config/schema only) | Typed project data without a heavy build |
| Interactivity | Small vanilla JS (theme toggle, nav) | No React needed |
| Hosting | **Vercel or Cloudflare Pages** (static) from GitHub | Free, push-to-deploy, custom domain `tannermayfield.dev` |
| Tooling | npm, Prettier, `astro check`, Lighthouse | Minimal |

Considered and rejected for V1: Next.js/React (overkill for mostly static content),
Tailwind (extra dependency; tokens + small CSS file suffice), a CMS or database
(contradicts "easy to maintain"), animation libraries.

Dependencies target: `astro` plus its Markdown tooling. Nothing else without discussion.

Note: Tanner's portfolio is itself a project ("Tech Portfolio") and gets its own
case study once V1 ships.

## 8. Design direction

Feel: modern, clean, technical, intelligent — closer to a polished software-product
site than a student portfolio.

- **Layout:** generous whitespace, ~65-75ch reading width, strong grid, content first.
- **Type:** one high-quality variable sans (e.g., Inter or Geist, self-hosted) plus a
  mono face used sparingly for labels/status. Careful scale and line-height.
- **Color:** near-neutral palette, one restrained accent, status badges with meaning
  (not decoration). Light default; dark mode via `prefers-color-scheme` + manual toggle
  (cheap with CSS tokens).
- **Motion:** subtle fade/translate on reveal and hover only; honors
  `prefers-reduced-motion`. No constant animation.
- **Explicitly avoided:** neon, matrix/terminal gimmicks, glowing gradients, floating
  logos, heavy glassmorphism.
- **Accessibility from day one:** semantic landmarks, skip link, visible focus,
  WCAG AA contrast, keyboard-complete nav, alt text, 44px touch targets.
- **Responsive:** mobile-first; verified at ~375, 768, 1280.

## 9. Scope control

**In V1:** home, projects index, case-study template + 4 featured case studies (honest
about maturity), skills-by-evidence, about/education/experience structure, contact,
résumé slot, light/dark, SEO basics (titles, meta, OG, sitemap), deployment.

**Deferred (creates scope without recruiter value yet):**
- Blog, CMS, search, filtering/tagging UI, i18n
- Live demos embedded in the site; an AI chatbot "ask about Tanner"
- Analytics beyond optional privacy-friendly basics
- Contact form with backend (use `mailto:` instead)
- Case studies for smaller projects (just short entries)
- Detailed Lecture App page beyond a short research/concept write-up
- Animated architecture diagrams (static diagrams/SVG first)

**Scope risks in the original prompt:** 13-section case studies for *every* project
(unrealistic — Concept-stage projects can't honestly fill them), six full projects at
once, and dark mode + heavy animation. Mitigation: depth scales with maturity.

## 10. Smallest polished V1

Ship: home + projects index + **2 deep case studies (BravOS, Skill Projects)** + 2
lighter case studies (Language Learning, Gospel Study) + Lecture App as a short
exploration entry + about + contact. Deploy to the custom domain.
Done when it meets the Definition of V1 in the original brief.

## 11. Data separation

```
src/
  content/projects/*.md     # one file per project (frontmatter + case study body)
  data/profile.ts           # name, tagline, links (placeholders), education, experience
  data/skills.ts            # skill groups → items → project slugs (evidence)
  components/               # Hero, ProjectCard, StatusBadge, SkillGroup, CaseStudySection…
  layouts/Base.astro
  pages/                    # index, projects/, about, contact
  styles/                   # tokens.css, base.css, components
public/                     # favicon, résumé PDF (when provided), og image
```

Adding a project = one Markdown file. Adding a résumé item = one entry in
`profile.ts`. No component changes.

## 12. Implementation stages (each: run, check errors, test, responsive, a11y, explain)

1. Scaffold Astro, tokens, base layout, nav/footer, theme toggle; first commit.
2. Data layer: schemas, `profile.ts`, `skills.ts`, placeholder checker.
3. Components: status badge, project card, case-study sections.
4. Home page.
5. Projects index + case-study template; write BravOS, then others.
6. About / experience / education / résumé slot; Contact.
7. SEO, a11y + Lighthouse pass, deploy config, domain notes.

## 13. Open questions (need Tanner)

- Hosting choice: Vercel vs. Cloudflare Pages (both fine; default Vercel).
- Which projects have a repo or demo link today, and are repos public?
- Real status per project (what actually runs today vs. concept).
- Screenshots available? (otherwise labeled placeholders)
- Email to publish, LinkedIn URL, résumé PDF, and any real experience/coursework list.
- Preferred accent color / any brand preference.
- Whether "Adaptive Software Engineer" appears in the hero or only in About.

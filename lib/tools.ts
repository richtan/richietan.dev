import { z } from "zod/v4";
import { tool } from "ai";

// Placeholder data — will be replaced with real content from Richie
const RESUME_DATA = {
  name: "Richie Tan",
  title: "Software Engineer",
  summary:
    "Software engineer passionate about building great products. Details coming soon — check back or ask me directly!",
  experience: [
    {
      company: "Coming soon",
      role: "Software Engineer",
      period: "Present",
      highlights: ["Details to be provided"],
    },
  ],
  education: [
    {
      school: "Coming soon",
      degree: "Coming soon",
      period: "Coming soon",
    },
  ],
};

const PROJECTS_DATA = {
  projects: [
    {
      name: "richietan.dev",
      description:
        "This website — a 1:1 replica of the Claude Code CLI, built with Next.js, AI SDK, and Tailwind CSS.",
      tech: ["Next.js", "TypeScript", "Tailwind CSS", "AI SDK", "Vercel"],
      url: "https://richietan.dev",
    },
  ],
};

const SKILLS_DATA = {
  categories: [
    {
      name: "Languages",
      skills: ["TypeScript", "JavaScript", "Python"],
    },
    {
      name: "Frontend",
      skills: ["React", "Next.js", "Tailwind CSS"],
    },
    {
      name: "Backend",
      skills: ["Node.js"],
    },
    {
      name: "Tools & Platforms",
      skills: ["Git", "Vercel", "Docker"],
    },
  ],
};

const CONTACT_DATA = {
  email: "Coming soon",
  github: "https://github.com/richietan",
  linkedin: "https://linkedin.com/in/richietan",
  website: "https://richietan.dev",
};

export const tools = {
  get_resume: tool({
    description:
      "Get Richie Tan's resume including work experience, education, and summary. Use when the user asks about background, experience, resume, or work history.",
    inputSchema: z.object({}),
    execute: async () => RESUME_DATA,
  }),
  get_projects: tool({
    description:
      "Get Richie Tan's notable projects and portfolio. Use when the user asks about projects, portfolio, or what Richie has built.",
    inputSchema: z.object({}),
    execute: async () => PROJECTS_DATA,
  }),
  get_skills: tool({
    description:
      "Get Richie Tan's technical skills organized by category. Use when the user asks about skills, technologies, or tech stack.",
    inputSchema: z.object({}),
    execute: async () => SKILLS_DATA,
  }),
  get_contact: tool({
    description:
      "Get Richie Tan's contact information and social links. Use when the user asks about contact info, how to reach Richie, or social links.",
    inputSchema: z.object({}),
    execute: async () => CONTACT_DATA,
  }),
};

import { z } from "zod/v4";
import { tool } from "ai";
import {
  getGitHubProfile,
  getGitHubRepos,
  getPinnedRepos,
  getContributionStats,
  getAggregatedLanguages,
  getResumeLatex,
} from "@/lib/github";

export const tools = {
  get_resume: tool({
    description:
      "Get Richie Tan's full resume as LaTeX source — contains work history, education, projects, and skills. Use when asked about experience, resume, career, background, or qualifications.",
    inputSchema: z.object({}),
    execute: async () => {
      const latex = await getResumeLatex();
      return { format: "latex", source: latex };
    },
  }),

  get_projects: tool({
    description:
      "Get Richie Tan's projects — live GitHub repos (pinned and recent). Use when asked about projects, portfolio, or what Richie has built.",
    inputSchema: z.object({}),
    execute: async () => {
      const [pinned, repos] = await Promise.all([
        getPinnedRepos(),
        getGitHubRepos(),
      ]);

      return {
        pinnedRepos: pinned,
        recentRepos: repos
          .filter((r) => !r.fork)
          .slice(0, 10)
          .map((r) => ({
            name: r.name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            url: r.html_url,
            topics: r.topics,
            lastPush: r.pushed_at,
          })),
      };
    },
  }),

  get_skills: tool({
    description:
      "Get Richie Tan's technical skills — real language usage data from GitHub repos. Use when asked about skills, technologies, or tech stack.",
    inputSchema: z.object({}),
    execute: async () => {
      const languages = await getAggregatedLanguages();

      const totalBytes = languages.reduce((sum, l) => sum + l.bytes, 0);
      const topLanguages = languages.slice(0, 10).map((l) => ({
        language: l.language,
        percentage:
          totalBytes > 0 ? Math.round((l.bytes / totalBytes) * 100) : 0,
      }));

      return { githubLanguages: topLanguages };
    },
  }),

  get_contact: tool({
    description:
      "Get Richie Tan's contact info and social links. Use when asked about contact, email, social profiles, or how to reach Richie.",
    inputSchema: z.object({}),
    execute: async () => {
      // Contact info is in the LaTeX header, but also provide structured links
      return {
        email: "richietan2004@gmail.com",
        website: "https://richietan.dev",
        profiles: [
          {
            network: "GitHub",
            username: "richtan",
            url: "https://github.com/richtan",
          },
          {
            network: "LinkedIn",
            username: "richie-tan",
            url: "https://linkedin.com/in/richie-tan",
          },
        ],
        location: "Los Gatos, CA",
      };
    },
  }),

  get_github_stats: tool({
    description:
      "Get live GitHub profile stats — repo count, followers, contribution totals. Use when asked about GitHub activity, open source, or contributions.",
    inputSchema: z.object({}),
    execute: async () => {
      const [profile, contributions] = await Promise.all([
        getGitHubProfile(),
        getContributionStats(),
      ]);

      return {
        username: profile.login,
        profileUrl: profile.html_url,
        publicRepos: profile.public_repos,
        followers: profile.followers,
        memberSince: profile.created_at,
        contributions,
      };
    },
  }),
};

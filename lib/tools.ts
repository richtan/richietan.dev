import { z } from "zod/v4";
import { tool } from "ai";
import { getResumeData } from "@/lib/resume";
import {
  getGitHubProfile,
  getGitHubRepos,
  getPinnedRepos,
  getContributionStats,
  getAggregatedLanguages,
} from "@/lib/github";

export const tools = {
  get_resume: tool({
    description:
      "Get Richie Tan's full work history, education, and background summary. Use when asked about experience, resume, career, or background.",
    inputSchema: z.object({}),
    execute: async () => {
      const resume = getResumeData();
      return {
        summary: resume.basics?.summary,
        work: resume.work,
        education: resume.education,
        certificates: resume.certificates,
      };
    },
  }),

  get_projects: tool({
    description:
      "Get Richie Tan's projects — both from resume and live GitHub repos (pinned and recent). Use when asked about projects, portfolio, or what Richie has built.",
    inputSchema: z.object({}),
    execute: async () => {
      const resume = getResumeData();
      const [pinned, repos] = await Promise.all([
        getPinnedRepos(),
        getGitHubRepos(),
      ]);

      return {
        resumeProjects: resume.projects,
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
      "Get Richie Tan's technical skills from resume plus real language usage data from GitHub. Use when asked about skills, technologies, or tech stack.",
    inputSchema: z.object({}),
    execute: async () => {
      const resume = getResumeData();
      const languages = await getAggregatedLanguages();

      // Convert bytes to percentage
      const totalBytes = languages.reduce((sum, l) => sum + l.bytes, 0);
      const topLanguages = languages.slice(0, 10).map((l) => ({
        language: l.language,
        percentage: totalBytes > 0 ? Math.round((l.bytes / totalBytes) * 100) : 0,
      }));

      return {
        resumeSkills: resume.skills,
        githubLanguages: topLanguages,
      };
    },
  }),

  get_contact: tool({
    description:
      "Get Richie Tan's contact info and social links. Use when asked about contact, email, social profiles, or how to reach Richie.",
    inputSchema: z.object({}),
    execute: async () => {
      const resume = getResumeData();
      return {
        email: resume.basics?.email || "Not publicly listed",
        url: resume.basics?.url,
        profiles: resume.basics?.profiles,
        location: resume.basics?.location,
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

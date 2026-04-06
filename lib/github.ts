const GITHUB_USERNAME = "richtan";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
};

// ---- In-memory TTL cache ----

const cache = new Map<string, { data: unknown; expiry: number }>();

async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data as T;
  try {
    const data = await fn();
    cache.set(key, { data, expiry: Date.now() + ttlMs });
    return data;
  } catch (err) {
    // If fetch fails but we have stale data, return it
    if (entry) return entry.data as T;
    throw err;
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ---- Public API ----

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string;
  html_url: string;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export async function getGitHubProfile(): Promise<GitHubProfile> {
  return cached("profile", DAY, async () => {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json();
  });
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  pushed_at: string;
  homepage: string | null;
}

export async function getGitHubRepos(): Promise<GitHubRepo[]> {
  return cached("repos", HOUR, async () => {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=pushed&per_page=100&type=owner`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json();
  });
}

export interface PinnedRepo {
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  primaryLanguage: { name: string; color: string } | null;
  forkCount: number;
}

export async function getPinnedRepos(): Promise<PinnedRepo[]> {
  // GraphQL requires auth
  if (!GITHUB_TOKEN) return [];

  return cached("pinned", DAY, async () => {
    const query = `{
      user(login: "${GITHUB_USERNAME}") {
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              description
              url
              stargazerCount
              primaryLanguage { name color }
              forkCount
            }
          }
        }
      }
    }`;

    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
    const data = await res.json();
    return data.data?.user?.pinnedItems?.nodes ?? [];
  });
}

export interface ContributionStats {
  totalContributions: number;
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
}

export async function getContributionStats(): Promise<ContributionStats> {
  // GraphQL requires auth
  if (!GITHUB_TOKEN) {
    return { totalContributions: 0, totalCommits: 0, totalPRs: 0, totalIssues: 0 };
  }

  return cached("contributions", DAY, async () => {
    const query = `{
      user(login: "${GITHUB_USERNAME}") {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          contributionCalendar {
            totalContributions
          }
        }
      }
    }`;

    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
    const data = await res.json();
    const c = data.data?.user?.contributionsCollection;
    return {
      totalContributions: c?.contributionCalendar?.totalContributions ?? 0,
      totalCommits: c?.totalCommitContributions ?? 0,
      totalPRs: c?.totalPullRequestContributions ?? 0,
      totalIssues: c?.totalIssueContributions ?? 0,
    };
  });
}

/** Aggregate languages across all owned, non-fork repos */
export async function getAggregatedLanguages(): Promise<
  Array<{ language: string; bytes: number }>
> {
  return cached("languages", DAY, async () => {
    const repos = await getGitHubRepos();
    const owned = repos.filter((r) => !r.fork).slice(0, 20); // top 20 by recent push

    const langMap = new Map<string, number>();
    await Promise.all(
      owned.map(async (repo) => {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${GITHUB_USERNAME}/${repo.name}/languages`,
            { headers },
          );
          if (!res.ok) return;
          const langs: Record<string, number> = await res.json();
          for (const [lang, bytes] of Object.entries(langs)) {
            langMap.set(lang, (langMap.get(lang) || 0) + bytes);
          }
        } catch {
          // skip failed repos
        }
      }),
    );

    return Array.from(langMap.entries())
      .map(([language, bytes]) => ({ language, bytes }))
      .sort((a, b) => b.bytes - a.bytes);
  });
}

/** Fetch the LaTeX resume source from richtan/resume repo */
export async function getResumeLatex(): Promise<string> {
  return cached("resume-tex", HOUR, async () => {
    const res = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_USERNAME}/resume/main/Richie_Tan_Resume.tex`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub raw ${res.status}`);
    return res.text();
  });
}

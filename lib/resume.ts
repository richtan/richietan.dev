import { readFileSync } from "fs";
import path from "path";
import type { ResumeSchema } from "@/lib/types/resume";

let cached: ResumeSchema | null = null;

/** Read resume.json from disk. Cached in module scope (persists per serverless instance). */
export function getResumeData(): ResumeSchema {
  if (!cached) {
    const filePath = path.join(process.cwd(), "resume.json");
    cached = JSON.parse(readFileSync(filePath, "utf-8"));
  }
  return cached!;
}

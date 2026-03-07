import { promises as fs } from "fs";
import path from "path";
import { ResearchReport } from "@/types";

// Use /tmp on Vercel (serverless has read-only fs outside /tmp)
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "reports")
  : path.join(process.cwd(), "data", "reports");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9\-_]/g, "");
}

export async function saveReport(report: ResearchReport): Promise<void> {
  await ensureDir();
  const filePath = path.join(DATA_DIR, `${sanitizeId(report.id)}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
}

export async function getReport(id: string): Promise<ResearchReport | null> {
  try {
    const filePath = path.join(DATA_DIR, `${sanitizeId(id)}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as ResearchReport;
  } catch {
    return null;
  }
}

export async function getLatestReport(): Promise<ResearchReport | null> {
  try {
    await ensureDir();
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();
    if (jsonFiles.length === 0) return null;
    const data = await fs.readFile(path.join(DATA_DIR, jsonFiles[0]), "utf-8");
    return JSON.parse(data) as ResearchReport;
  } catch {
    return null;
  }
}


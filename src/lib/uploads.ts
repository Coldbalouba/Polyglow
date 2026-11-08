import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

/** Store a resume outside the public folder. Returns the stored file name (not a URL). */
export async function saveResume(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error("Resume must be a PDF, DOC or DOCX file.");
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_RESUME_BYTES) throw new Error("Resume must be 5 MB or smaller.");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const stored = `${randomBytes(12).toString("hex")}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
  return stored;
}

export function contentTypeFor(stored: string) {
  return ALLOWED.get(path.extname(stored).toLowerCase()) ?? "application/octet-stream";
}

/** Resolve a stored name safely inside UPLOAD_DIR. */
export function resolveUpload(stored: string) {
  const full = path.resolve(UPLOAD_DIR, path.basename(stored));
  if (!full.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Invalid path");
  return full;
}

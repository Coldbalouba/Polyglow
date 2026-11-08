import "server-only";
import path from "node:path";

export const MAX_RESUME_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

/** Validate a resume upload. Files are stored in Postgres, so no paid storage service is needed. */
export async function readResume(file: File): Promise<{ name: string; mime: string; data: Buffer }> {
  const ext = path.extname(file.name).toLowerCase();
  const mime = ALLOWED.get(ext);
  if (!mime) throw new Error("Resume must be a PDF, DOC or DOCX file.");
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_RESUME_BYTES) throw new Error("Resume must be 3 MB or smaller.");
  const data = Buffer.from(await file.arrayBuffer());
  const looksRight =
    ext === ".pdf" ? data.subarray(0, 4).toString() === "%PDF" :
    ext === ".docx" ? data[0] === 0x50 && data[1] === 0x4b : // zip
    data[0] === 0xd0 && data[1] === 0xcf; // legacy OLE .doc
  if (!looksRight) throw new Error("That file doesn't look like a real PDF/Word document.");
  return { name: file.name.slice(0, 200), mime, data };
}

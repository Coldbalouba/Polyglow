import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contentTypeFor, resolveUpload } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const app = await prisma.tutorApplication.findUnique({ where: { id } });
  if (!app?.resumePath) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(resolveUpload(app.resumePath));
    const safeName = (app.resumeFileName ?? "resume").replace(/[^\w.\- ]/g, "_");
    return new Response(data, {
      headers: {
        "Content-Type": contentTypeFor(app.resumePath),
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}

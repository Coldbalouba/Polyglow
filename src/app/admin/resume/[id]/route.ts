import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const app = await prisma.tutorApplication.findUnique({ where: { id }, select: { resumeData: true, resumeFileName: true, resumeMime: true } });
  if (!app?.resumeData) return new Response("Not found", { status: 404 });
  const safeName = (app.resumeFileName ?? "resume").replace(/[^\w.\- ]/g, "_");
  return new Response(Buffer.from(app.resumeData), {
    headers: {
      "Content-Type": app.resumeMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

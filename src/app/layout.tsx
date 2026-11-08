import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "TutConnect — language tutors who are actually appreciated",
  description: "A selective language-tutoring marketplace with fair fees: 1% on a tutor's first five classes, 5% after.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-stone-200 bg-white">
          <nav className="container-page flex h-16 items-center justify-between gap-4">
            <Link href="/" className="text-lg font-bold text-brand-700">TutConnect</Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/tutors" className="hover:text-brand-600">Find a tutor</Link>
              {!user && <Link href="/signup?role=TUTOR" className="hover:text-brand-600">Teach with us</Link>}
              {user?.role === "TUTOR" && <Link href="/apply" className="hover:text-brand-600">My application</Link>}
              {user?.role === "ADMIN" && <Link href="/admin" className="hover:text-brand-600">Admin</Link>}
              {user ? (
                <>
                  <Link href="/dashboard" className="hover:text-brand-600">Dashboard</Link>
                  <form action={logout}>
                    <button className="btn-secondary">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-brand-600">Log in</Link>
                  <Link href="/signup" className="btn">Sign up</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="container-page py-10">{children}</main>
        <footer className="border-t border-stone-200 py-8 text-center muted">
          TutConnect · Languages only · 1% fee on a tutor&apos;s first 5 classes, 5% after
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Polyglow — language tutors who are actually appreciated",
  description: "A selective language-tutoring marketplace with fair fees: 1% on a tutor's first five classes, 5% after.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen">
        {process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") || !process.env.STRIPE_SECRET_KEY ? (
          <div className="bg-amber-100 py-1 text-center text-xs text-amber-900">Test mode: no real payments are taken.</div>
        ) : null}
        <header className="border-b border-stone-200 bg-white">
          <nav className="container-page flex h-16 items-center justify-between gap-4">
            <Link href="/" className="text-lg font-bold text-brand-700">Polyglow</Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/tutors" className="hover:text-brand-600">Find a tutor</Link>
              <Link href="/how-it-works" className="hidden hover:text-brand-600 sm:inline">How it works</Link>
              {!user && <Link href="/signup?role=TUTOR" className="hover:text-brand-600">Teach with us</Link>}
              {user?.role === "TUTOR" && <Link href="/apply" className="hover:text-brand-600">My application</Link>}
              {user?.role === "ADMIN" && <Link href="/admin" className="hover:text-brand-600">Admin</Link>}
              {user ? (
                <>
                  <Link href="/dashboard" className="hover:text-brand-600">Dashboard</Link>
                  <Link href="/account" className="hidden hover:text-brand-600 sm:inline">Account</Link>
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
        <footer className="border-t border-stone-200 py-8 text-center muted space-y-2">
          <p>Polyglow · Languages only · 1% fee on a tutor&apos;s first 5 lessons, 5% after · No subscriptions</p>
          <p className="space-x-4">
            <Link href="/how-it-works" className="underline">How it works</Link>
            <Link href="/compare/preply" className="underline">Polyglow vs Preply</Link>
            <Link href="/terms" className="underline">Terms</Link>
            <Link href="/privacy" className="underline">Privacy</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}

import { requireUser } from "@/lib/auth";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { changePassword, deleteAccount } from "@/app/actions/account";

export const metadata = { title: "Your account · Polyglow" };

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="h1">Your account</h1>
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />

      <section className="card space-y-1">
        <p className="font-semibold">{user.name}</p>
        <p className="muted">{user.email}</p>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Change password</h2>
        <form action={changePassword} className="grid gap-3 sm:grid-cols-3">
          <input className="input" type="password" name="current" placeholder="Current password" autoComplete="current-password" required aria-label="Current password" />
          <input className="input" type="password" name="next" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} required aria-label="New password" />
          <button className="btn">Change password</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Your data</h2>
        <p className="muted">Download everything we hold about you: your profile, lessons, payments, messages and reviews.</p>
        <a href="/account/export" className="btn-secondary">Download my data (JSON)</a>
      </section>

      <section className="card space-y-3 border-red-200">
        <h2 className="h2">Delete your account</h2>
        <p className="muted">
          No hoops and no retention calls. We remove your name, email, password, profile and resume straight away.
          Records of past lessons and payments stay, without your name, because the other person and tax rules need them.
          Finish or cancel any upcoming lessons first.
        </p>
        <form action={deleteAccount} className="grid gap-3 sm:grid-cols-3">
          <input className="input" name="confirm" placeholder="Type DELETE" required aria-label="Type DELETE to confirm" autoComplete="off" />
          <input className="input" type="password" name="password" placeholder="Your password" required aria-label="Your password" autoComplete="current-password" />
          <button className="btn-danger">Delete my account</button>
        </form>
      </section>
    </div>
  );
}

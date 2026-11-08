import { resetPassword } from "@/app/actions/auth";
import { Flash, param, type SearchParams } from "@/components/Flash";

export default async function ResetPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md card">
      <h1 className="h1 mb-6">Choose a new password</h1>
      <Flash error={param(sp, "error")} />
      <form action={resetPassword} className="space-y-4">
        <input type="hidden" name="token" value={param(sp, "token") ?? ""} />
        <div><label className="label" htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" minLength={8} required /></div>
        <button className="btn w-full">Save password</button>
      </form>
    </div>
  );
}

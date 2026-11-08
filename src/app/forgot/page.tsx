import { requestPasswordReset } from "@/app/actions/auth";
import { Flash, param, type SearchParams } from "@/components/Flash";

export default async function ForgotPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md card">
      <h1 className="h1 mb-6">Forgot your password?</h1>
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />
      <form action={requestPasswordReset} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
        <button className="btn w-full">Email me a reset link</button>
      </form>
    </div>
  );
}

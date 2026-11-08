import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Flash, param, type SearchParams } from "@/components/Flash";

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md card">
      <h1 className="h1 mb-6">Log in</h1>
      <Flash error={param(sp, "error")} />
      <form action={login} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
        <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" required /></div>
        <button className="btn w-full">Log in</button>
      </form>
      <p className="muted mt-4"><Link className="text-brand-600 underline" href="/forgot">Forgot password?</Link></p>
      <p className="muted mt-2">New here? <Link className="text-brand-600 underline" href="/signup">Create an account</Link></p>
    </div>
  );
}

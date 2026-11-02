import Link from "next/link";
import { signOut } from "@/app/actions";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1d211c] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 text-2xl text-amber-200">
          !
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-300">
          Revive
        </p>
        <h1 className="text-2xl font-semibold">Access not granted</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          This Google account isn’t on the participant allowlist. Ask a
          competition admin to add your email, then sign in again.
        </p>
        <form action={signOut} className="mt-7">
          <button className="rounded-full bg-amber-300 px-5 py-3 text-sm font-bold text-[#211b0d] transition hover:bg-amber-200">
            Sign out
          </button>
        </form>
        <Link className="mt-5 block text-sm text-white/45 hover:text-white/80" href="/">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}

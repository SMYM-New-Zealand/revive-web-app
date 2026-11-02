"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/app/actions";

export function SignInCard({
  configurationMissing = false,
}: {
  configurationMissing?: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1d211c]/95 p-8 shadow-2xl shadow-black/40 sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-amber-300 text-xl font-black text-[#211b0d]">
          R
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
            Starting anew
          </p>
          <p className="mt-1 text-sm text-white/50">Youth group challenge</p>
        </div>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to Revive</h1>
      <p className="mt-3 text-sm leading-6 text-white/60">
        Build good habits, collect daily points, and cheer each other on.
      </p>
      {configurationMissing ? (
        <div className="mt-7 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100/80">
          Supabase isn’t configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, add your project URL and anon key, then restart
          the development server.
        </div>
      ) : (
        <form action={signInWithGoogle} className="mt-8">
          <button
            disabled={pending}
            onClick={() => setPending(true)}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#f6f1e6] px-5 py-3.5 text-sm font-bold text-[#1b1b18] transition hover:bg-white disabled:opacity-70"
          >
            <GoogleMark />
            {pending ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-white/40">
            Google sign-in only. Access is limited to invited participants.
          </p>
        </form>
      )}
      <div className="mt-9 border-t border-white/10 pt-5 text-center text-[11px] font-medium uppercase tracking-[0.24em] text-white/30">
        Hebrews 12:1–2
      </div>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
      <path
        fill="#FFC107"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"
      />
      <path
        fill="#EA4335"
        d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"
      />
    </svg>
  );
}

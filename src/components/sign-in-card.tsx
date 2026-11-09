"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInCard({
  configurationMissing = false,
  signInError = "",
}: {
  configurationMissing?: boolean;
  signInError?: string;
}) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(signInError);

  async function handleSignIn() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/log`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) {
        setErrorMessage("Couldn’t connect to Google. Please try again.");
        setPending(false);
        return;
      }
      if (!data.url) {
        throw new Error("Google OAuth did not return a sign-in URL.");
      }
      window.location.assign(data.url);
    } catch (error) {
      console.error("Google OAuth could not be started:", error);
      setErrorMessage("Couldn’t connect to Google. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1d211c]/95 p-8 shadow-2xl shadow-black/40 sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-amber-300 text-xl font-black text-[#211b0d]">
          R
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
            Soul
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
        <div className="mt-8">
          {errorMessage && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100"
            >
              {errorMessage}
            </p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleSignIn()}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#f6f1e6] px-5 py-3.5 text-sm font-bold text-[#1b1b18] transition hover:bg-white disabled:opacity-70"
          >
            <GoogleMark />
            {pending ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-white/40">
            Google sign-in only. Access is limited to invited participants.
          </p>
        </div>
      )}
      <div className="mt-9 border-t border-white/10 pt-5 text-center text-[11px] font-medium uppercase tracking-[0.24em] text-white/30">
        Hebrews 12:1–2
      </div>
    </section>
  );
}

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center font-bold leading-none text-[#4285f4]"
    >
      G
    </span>
  );
}

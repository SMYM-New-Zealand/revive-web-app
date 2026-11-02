"use client";

import { useActionState } from "react";
import {
  addAllowedEmail,
  addChallenge,
  deactivateChallenge,
  updateCompetition,
  type AdminActionState,
} from "@/app/actions";

const emptyAdminState: AdminActionState = { message: "", success: false };

type Challenge = {
  id: string;
  tier: string;
  title: string;
  points: number;
  active: boolean;
};

type AllowedEmail = { email: string; is_admin: boolean };

export function AdminForms({
  challenges,
  allowedEmails,
  startsOn,
  endsOn,
}: {
  challenges: Challenge[];
  allowedEmails: AllowedEmail[];
  startsOn: string;
  endsOn: string;
}) {
  const [challengeState, challengeAction, addingChallenge] = useActionState(
    addChallenge,
    emptyAdminState,
  );
  const [emailState, emailAction, addingEmail] = useActionState(
    addAllowedEmail,
    emptyAdminState,
  );
  const [dateState, dateAction, savingDates] = useActionState(
    updateCompetition,
    emptyAdminState,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading title="Competition dates" description="The competition day follows the configured timezone: Pacific/Auckland." />
        <form action={dateAction} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-xs font-semibold text-white/55">
            Starts on
            <input
              required
              type="date"
              name="starts_on"
              defaultValue={startsOn}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-semibold text-white/55">
            Ends on
            <input
              required
              type="date"
              name="ends_on"
              defaultValue={endsOn}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            />
          </label>
          <SubmitButton pending={savingDates}>Save dates</SubmitButton>
          <ActionMessage state={dateState} />
        </form>
      </section>

      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading title="Add a challenge" description="Dates are optional; leave blank to keep a challenge available throughout the competition." />
        <form action={challengeAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-white/55">
            Tier
            <select
              name="tier"
              required
              defaultValue="novice"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            >
              <option value="novice">Novice</option>
              <option value="challenger">Challenger</option>
              <option value="elite">Elite</option>
              <option value="bonus">Bonus</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-white/55">
            Points
            <input
              required
              type="number"
              name="points"
              min="1"
              step="1"
              defaultValue="10"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="text-xs font-semibold text-white/55 sm:col-span-2">
            Challenge title
            <input
              required
              maxLength={180}
              name="title"
              placeholder="Describe the challenge"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white placeholder:text-white/25"
            />
          </label>
          <label className="text-xs font-semibold text-white/55">
            Available from
            <input
              type="date"
              name="starts_on"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="text-xs font-semibold text-white/55">
            Available through
            <input
              type="date"
              name="ends_on"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <SubmitButton pending={addingChallenge}>Add challenge</SubmitButton>
            <ActionMessage state={challengeState} />
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading title="Participant allowlist" description="Only emails added here can use the app after Google sign-in." />
        <form action={emailAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold text-white/55">
            Google account email
            <input
              required
              type="email"
              name="email"
              placeholder="participant@example.com"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white placeholder:text-white/25"
            />
          </label>
          <label className="flex items-center gap-2 py-3 text-xs text-white/65">
            <input
              type="checkbox"
              name="is_admin"
              className="size-4 accent-amber-300"
            />
            Admin access
          </label>
          <SubmitButton pending={addingEmail}>Add email</SubmitButton>
          <ActionMessage state={emailState} />
        </form>
        <div className="mt-5 divide-y divide-white/[0.07] rounded-xl border border-white/[0.07]">
          {allowedEmails.map((entry) => (
            <div key={entry.email} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate text-sm text-white/75">{entry.email}</span>
              <span className="shrink-0 rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                {entry.is_admin ? "Admin" : "Participant"}
              </span>
            </div>
          ))}
          {allowedEmails.length === 0 && (
            <p className="px-4 py-5 text-sm text-white/40">No allowed emails found.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading title="Challenge rubric" description="Deactivated items are hidden from participants but kept for historical points." />
        <div className="mt-5 divide-y divide-white/[0.07] rounded-xl border border-white/[0.07]">
          {challenges.map((challenge) => (
            <ChallengeRow key={challenge.id} challenge={challenge} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const [state, action, pending] = useActionState(
    deactivateChallenge,
    emptyAdminState,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${challenge.active ? "text-white/80" : "text-white/35 line-through"}`}>
          {challenge.title}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/60">
          {challenge.tier} · {challenge.points} points · {challenge.active ? "active" : "inactive"}
        </p>
      </div>
      {challenge.active && (
        <form action={action}>
          <input type="hidden" name="challenge_id" value={challenge.id} />
          <button
            disabled={pending}
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 hover:border-rose-200/30 hover:text-rose-100 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Deactivate"}
          </button>
        </form>
      )}
      {state.message && (
        <span role={state.success ? "status" : "alert"} className="w-full text-xs text-white/55">
          {state.message}
        </span>
      )}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
    </div>
  );
}

function SubmitButton({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <button
      disabled={pending}
      className="shrink-0 rounded-full bg-amber-300 px-5 py-3 text-xs font-bold text-[#211b0d] transition hover:bg-amber-200 disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function ActionMessage({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.success ? "status" : "alert"}
      className={`text-xs ${state.success ? "text-emerald-200" : "text-rose-200"}`}
    >
      {state.message}
    </p>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addAllowedEmail,
  addChallenge,
  backfillCompletions,
  promoteAllowedEmails,
  setChallengeActive,
  setChallengeWeeklyLimit,
  updateCompetition,
  type AdminActionState,
} from "@/app/actions";

const emptyAdminState: AdminActionState = { message: "", success: false };

type Challenge = {
  id: string;
  tier: string;
  target_gender: "male" | "female" | "unisex";
  title: string;
  points: number;
  active: boolean;
  once_per_week: boolean;
  starts_on: string | null;
  ends_on: string | null;
};

type AllowedEmail = { email: string; is_admin: boolean };
type Participant = {
  id: string;
  display_name: string;
  email: string;
  gender: "male" | "female" | null;
};

export function AdminForms({
  challenges,
  allowedEmails,
  participants,
  startsOn,
  endsOn,
  maxBackfillDate,
}: {
  challenges: Challenge[];
  allowedEmails: AllowedEmail[];
  participants: Participant[];
  startsOn: string;
  endsOn: string;
  maxBackfillDate: string;
}) {
  const [challengeState, challengeAction, addingChallenge] = useActionState(
    addChallenge,
    emptyAdminState,
  );
  const [emailState, emailAction, addingEmail] = useActionState(
    addAllowedEmail,
    emptyAdminState,
  );
  const [promotionState, promotionAction, promotingAdmins] = useActionState(
    promoteAllowedEmails,
    emptyAdminState,
  );
  const [dateState, dateAction, savingDates] = useActionState(
    updateCompetition,
    emptyAdminState,
  );
  const [activeRubricTab, setActiveRubricTab] = useState<"active" | "inactive">("active");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading title="Competition dates" description="Competition days run from 4:00am to 4:00am in the configured timezone." />
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
          <label className="text-xs font-semibold text-white/55">
            Challenge for
            <select
              name="target_gender"
              required
              defaultValue="unisex"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
            >
              <option value="male">Male participants</option>
              <option value="female">Female participants</option>
              <option value="unisex">Everyone (unisex)</option>
            </select>
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
          <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
            <input
              type="checkbox"
              name="once_per_week"
              className="size-4 accent-amber-300"
            />
            Can only be completed once per competition week
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

      <LateCompletionForm
        challenges={challenges}
        participants={participants}
        competitionStartsOn={startsOn}
        maxBackfillDate={maxBackfillDate}
      />

      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading
          title="Participant allowlist"
          description="Only emails added here can use the app after Google sign-in. Gender is read from the existing Supabase allowlist data and is not edited here."
        />
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
          <SubmitButton pending={addingEmail}>Add email</SubmitButton>
          <ActionMessage state={emailState} />
        </form>
        <AllowedEmailPromotionForm
          allowedEmails={allowedEmails}
          action={promotionAction}
          state={promotionState}
          pending={promotingAdmins}
        />
      </section>

      <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
        <SectionHeading
          title="Challenge rubric"
          description="Manage active challenges and review items removed from the participant log."
        />
        <div
          role="tablist"
          aria-label="Challenge rubric status"
          className="mt-5 flex gap-2 border-b border-white/[0.08]"
        >
          {([
            ["active", "Active", challenges.filter((challenge) => challenge.active).length],
            ["inactive", "Deactivated", challenges.filter((challenge) => !challenge.active).length],
          ] as const).map(([tab, label, count]) => (
            <button
              key={tab}
              id={`challenge-rubric-${tab}-tab`}
              type="button"
              role="tab"
              aria-selected={activeRubricTab === tab}
              aria-controls={`challenge-rubric-${tab}-panel`}
              onClick={() => setActiveRubricTab(tab)}
              className={`-mb-px min-h-11 border-b-2 px-3 text-sm font-semibold transition ${
                activeRubricTab === tab
                  ? "border-amber-300 text-amber-200"
                  : "border-transparent text-white/45 hover:text-white/75"
              }`}
            >
              {label}
              <span className="ml-2 text-xs text-white/40">{count}</span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`challenge-rubric-${activeRubricTab}-panel`}
          aria-labelledby={`challenge-rubric-${activeRubricTab}-tab`}
          className="mt-4"
        >
          <div className="divide-y divide-white/[0.07] rounded-xl border border-white/[0.07]">
            {challenges
              .filter((challenge) =>
                activeRubricTab === "active" ? challenge.active : !challenge.active,
              )
              .map((challenge) => (
                <ChallengeRow key={challenge.id} challenge={challenge} />
              ))}
            {challenges.every((challenge) =>
              activeRubricTab === "active" ? !challenge.active : challenge.active,
            ) && (
              <p className="px-4 py-5 text-sm text-white/40">
                {activeRubricTab === "active"
                  ? "No active challenges."
                  : "No deactivated challenges."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AllowedEmailPromotionForm({
  allowedEmails,
  action,
  state,
  pending,
}: {
  allowedEmails: AllowedEmail[];
  action: (formData: FormData) => void;
  state: AdminActionState;
  pending: boolean;
}) {
  const participants = allowedEmails.filter((entry) => !entry.is_admin);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const allSelected =
    participants.length > 0 &&
    participants.every((participant) => selectedEmails.includes(participant.email));

  useEffect(() => {
    if (state.success) setSelectedEmails([]);
  }, [state]);

  return (
    <form action={action} className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/45">
          Select participants to grant admin access. Existing admins cannot be changed here.
        </p>
        {participants.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={pending}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setSelectedEmails(checked
                  ? participants.map((participant) => participant.email)
                  : []);
              }}
              className="size-4 accent-amber-300"
            />
            Select all participants
          </label>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.07] rounded-xl border border-white/[0.07]">
        {allowedEmails.map((entry) => (
          <label
            key={entry.email}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${
              entry.is_admin ? "cursor-default" : "cursor-pointer"
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              {!entry.is_admin && (
                <input
                  type="checkbox"
                  name="emails"
                  value={entry.email}
                  checked={selectedEmails.includes(entry.email)}
                  disabled={pending}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSelectedEmails((current) =>
                      checked
                        ? [...current, entry.email]
                        : current.filter((email) => email !== entry.email),
                    );
                  }}
                  className="size-4 shrink-0 accent-amber-300"
                />
              )}
              <span className="truncate text-sm text-white/75">{entry.email}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
              {entry.is_admin ? "Admin" : "Participant"}
            </span>
          </label>
        ))}
        {allowedEmails.length === 0 && (
          <p className="px-4 py-5 text-sm text-white/40">No allowed emails found.</p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || selectedEmails.length === 0}
          className="shrink-0 rounded-full bg-amber-300 px-5 py-3 text-xs font-bold text-[#211b0d] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : `Save admin access${selectedEmails.length ? ` (${selectedEmails.length})` : ""}`}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setChallengeActive, emptyAdminState);
  const [weeklyState, weeklyAction, updatingWeekly] = useActionState(
    setChallengeWeeklyLimit,
    emptyAdminState,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${challenge.active ? "text-white/80" : "text-white/35 line-through"}`}>
          {challenge.title}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/60">
          {challenge.tier} · {challenge.points} points · {challenge.target_gender}
          {" · "}{challenge.active ? "active" : "inactive"}
        </p>
      </div>
      {challenge.active && (
        <form action={weeklyAction} className="flex items-center gap-2">
          <input type="hidden" name="challenge_id" value={challenge.id} />
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold text-white/55">
            <input
              type="checkbox"
              name="once_per_week"
              defaultChecked={challenge.once_per_week}
              disabled={updatingWeekly}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="size-4 accent-amber-300"
            />
            Weekly
          </label>
        </form>
      )}
      <form action={action}>
        <input type="hidden" name="challenge_id" value={challenge.id} />
        <input type="hidden" name="active" value={String(!challenge.active)} />
        <button
          disabled={pending}
          className={`rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
            challenge.active
              ? "border-white/10 text-white/55 hover:border-rose-200/30 hover:text-rose-100"
              : "border-emerald-200/20 text-emerald-100/70 hover:border-emerald-200/40 hover:text-emerald-100"
          }`}
        >
          {pending ? "Saving…" : challenge.active ? "Deactivate" : "Reactivate"}
        </button>
      </form>
      {state.message && (
        <span role={state.success ? "status" : "alert"} className="w-full text-xs text-white/55">
          {state.message}
        </span>
      )}
      {weeklyState.message && (
        <span
          role={weeklyState.success ? "status" : "alert"}
          className="w-full text-xs text-white/55"
        >
          {weeklyState.message}
        </span>
      )}
    </div>
  );
}

function LateCompletionForm({
  challenges,
  participants,
  competitionStartsOn,
  maxBackfillDate,
}: {
  challenges: Challenge[];
  participants: Participant[];
  competitionStartsOn: string;
  maxBackfillDate: string;
}) {
  const [state, action, pending] = useActionState(
    backfillCompletions,
    emptyAdminState,
  );
  const [selectedDate, setSelectedDate] = useState(maxBackfillDate);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const canBackfill = maxBackfillDate >= competitionStartsOn;
  const selectedParticipant = participants.find(
    (participant) => participant.id === selectedParticipantId,
  );
  const availableChallenges = challenges.filter(
    (challenge) =>
      challenge.active &&
      selectedParticipant &&
      (challenge.target_gender === "unisex" ||
        challenge.target_gender === selectedParticipant.gender) &&
      selectedDate >= competitionStartsOn &&
      (!challenge.starts_on || selectedDate >= challenge.starts_on) &&
      (!challenge.ends_on || selectedDate <= challenge.ends_on),
  );

  return (
    <section className="rounded-2xl border border-white/[0.09] bg-[#1d211c] p-5 sm:p-6">
      <SectionHeading
        title="Add a late completion"
        description="Record one or more challenges for a participant and a past competition day. For Historical Points, enter a custom total if needed; leave it blank to use the default. If any selection conflicts with an existing completion, none of the entries will be added."
      />
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-white/55">
          Participant
          <select
            required
            name="user_id"
            value={selectedParticipantId}
            onChange={(event) => setSelectedParticipantId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white"
          >
            <option value="" disabled>Select participant</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.display_name} ({participant.gender ?? "gender not set"} · {participant.email})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-white/55">
          Intended competition day
          <input
            required
            type="date"
            name="competition_day"
            min={competitionStartsOn}
            max={maxBackfillDate}
            value={selectedDate}
            disabled={!canBackfill}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#151813] px-3 py-3 text-sm text-white disabled:opacity-50"
          />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold text-white/55">
            Completed challenges
          </legend>
          <div className="mt-2 divide-y divide-white/[0.07] rounded-xl border border-white/[0.07]">
            {availableChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-white/75"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="challenge_ids"
                    value={challenge.id}
                    className="size-4 accent-amber-300"
                  />
                  <span className="min-w-0 flex-1">{challenge.title}</span>
                  <span className="shrink-0 text-xs text-amber-200/65">
                    {challenge.points} pts
                    {challenge.once_per_week ? " · weekly" : ""}
                  </span>
                </label>
                {challenge.title === "Historical Points" && (
                  <label className="flex items-center gap-2 text-xs text-white/50">
                    Custom points
                    <input
                      type="number"
                      name={`custom_points_${challenge.id}`}
                      min="1"
                      max="2147483647"
                      step="1"
                      placeholder={`Default: ${challenge.points}`}
                      aria-label="Custom points for Historical Points"
                      className="w-28 rounded-lg border border-white/10 bg-[#151813] px-2 py-2 text-sm text-white placeholder:text-white/30"
                    />
                  </label>
                )}
              </div>
            ))}
            {availableChallenges.length === 0 && (
              <p className="px-4 py-4 text-sm text-white/40">
                {!selectedParticipant
                  ? "Select a participant to see eligible challenges."
                  : canBackfill
                  ? "No active challenges are available on this date."
                  : "There are no past competition days available to backfill."}
              </p>
            )}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button
            disabled={
              pending ||
              !canBackfill ||
              !selectedParticipant ||
              availableChallenges.length === 0
            }
            className="shrink-0 rounded-full bg-amber-300 px-5 py-3 text-xs font-bold text-[#211b0d] transition hover:bg-amber-200 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add late completions"}
          </button>
          <ActionMessage state={state} />
        </div>
      </form>
    </section>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  gender: "male" | "female" | null;
  today_points: number;
  total_points: number;
};

export function LeaderboardLive({
  rows,
  currentUserId,
  isAdmin,
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const updateTime = () =>
      setLastUpdated(
        new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date()),
      );
    updateTime();
    const supabase = createClient();
    const channel = supabase
      .channel("leaderboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "completions" },
        () => {
          updateTime();
          router.refresh();
        },
      )
      .on("broadcast", { event: "completion_changed" }, () => {
        updateTime();
        router.refresh();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Leaderboard Realtime subscription failed: ${status}`);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const genderGroups = isAdmin
    ? (["male", "female"] as const).map((gender) => ({
        gender,
        rows: rows.filter((row) => row.gender === gender),
      }))
    : rows.length > 0
      ? [{ gender: rows[0].gender, rows }]
      : [];

  return (
    <>
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-white/40">
        <span>{rows.length} participants</span>
        <span aria-live="polite">
          {lastUpdated ? `Last updated ${lastUpdated}` : "Updating…"}
        </span>
      </div>
      {genderGroups.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1d211c] px-5 py-12 text-center text-sm text-white/45">
          No participants are currently assigned to a gender leaderboard.
        </div>
      ) : (
        <div className="space-y-6">
          {genderGroups.map((group) => (
            <section key={group.gender} aria-labelledby={`${group.gender}-leaderboard`}>
              {isAdmin && (
                <h2
                  id={`${group.gender}-leaderboard`}
                  className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-200"
                >
                  {group.gender} leaderboard
                </h2>
              )}
              <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1d211c]">
                <div className="grid grid-cols-[48px_minmax(0,1fr)_70px_78px] gap-2 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 sm:grid-cols-[64px_minmax(0,1fr)_100px_110px] sm:px-6">
                  <span>Rank</span>
                  <span>Participant</span>
                  <span className="text-right">Today</span>
                  <span className="text-right">Total</span>
                </div>
                {group.rows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-white/45">
                    No participants in this leaderboard yet.
                  </p>
                ) : (
                  <ol>
                    {group.rows.map((row) => {
              const isCurrentUser = row.user_id === currentUserId;
              return (
                <li
                  key={row.user_id}
                  className={`grid grid-cols-[48px_minmax(0,1fr)_70px_78px] items-center gap-2 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:grid-cols-[64px_minmax(0,1fr)_100px_110px] sm:px-6 ${
                    isCurrentUser ? "bg-amber-300/[0.075]" : ""
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      row.rank === 1 ? "text-amber-300" : "text-white/50"
                    }`}
                  >
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        isCurrentUser
                          ? "bg-amber-300 text-[#211b0d]"
                          : "bg-white/[0.08] text-white/65"
                      }`}
                      aria-hidden="true"
                    >
                      {row.display_name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {row.display_name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/75">
                          You
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums text-white/60">
                    {row.today_points}
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-white">
                    {row.total_points}
                  </span>
                </li>
              );
            })}
                  </ol>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-white/35">
        Tied scores share the same rank within each gender leaderboard.
      </p>
    </>
  );
}

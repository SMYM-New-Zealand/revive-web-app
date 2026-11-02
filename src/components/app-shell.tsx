import Link from "next/link";
import { signOut } from "@/app/actions";

export function AppShell({
  children,
  active,
  displayName,
  isAdmin,
}: {
  children: React.ReactNode;
  active: "log" | "leaderboard" | "admin";
  displayName: string;
  isAdmin: boolean;
}) {
  const links = [
    { href: "/log", label: "Log", key: "log" },
    { href: "/leaderboard", label: "Leaderboard", key: "leaderboard" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", key: "admin" }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.08] bg-[#111510]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-7">
          <Link href="/log" className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-300 text-sm font-black text-[#211b0d]">
              R
            </span>
            <span>
              <span className="block text-sm font-bold tracking-[0.12em]">REVIVE</span>
              <span className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 sm:block">
                Starting anew
              </span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active === link.key ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  active === link.key
                    ? "bg-white/10 text-amber-200"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.key === "leaderboard" ? (
                  <>
                    <span className="sm:hidden">Board</span>
                    <span className="hidden sm:inline">{link.label}</span>
                  </>
                ) : (
                  link.label
                )}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="sm:hidden">
            <button
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-full text-sm font-bold text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              ↗
            </button>
          </form>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="max-w-36 truncate text-xs text-white/45">
              {displayName}
            </span>
            <form action={signOut}>
              <button className="text-xs font-semibold text-white/50 transition hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-7 sm:px-7 sm:pt-10">
        {children}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#111510]/95 px-4 py-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/30 backdrop-blur sm:hidden">
        Hebrews 12:1–2
      </div>
    </div>
  );
}

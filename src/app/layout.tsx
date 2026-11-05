import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revive — Starting Anew",
  description: "Track your daily points and follow your youth group leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

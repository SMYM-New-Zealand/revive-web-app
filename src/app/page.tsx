import { redirect } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const signInError =
    error === "oauth"
      ? "Google sign-in couldn’t be completed. Please try again."
      : error === "profile"
        ? "We couldn’t verify your access. Please contact a competition admin."
        : "";

  if (!hasSupabaseConfig()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-12">
        <SignInCard configurationMissing signInError={signInError} />
      </main>
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/log");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <SignInCard signInError={signInError} />
    </main>
  );
}

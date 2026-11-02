import { redirect } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function HomePage() {
  if (!hasSupabaseConfig()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-12">
        <SignInCard configurationMissing />
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
      <SignInCard />
    </main>
  );
}

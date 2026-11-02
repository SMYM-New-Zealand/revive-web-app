import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireParticipant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [profileResult, configResult, adminResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("competition_config").select("*").eq("id", 1).maybeSingle(),
    supabase.rpc("is_admin", {}),
  ]);

  if (profileResult.error) {
    throw new Error(`Could not check participant access: ${profileResult.error.message}`);
  }
  if (configResult.error) {
    throw new Error(`Could not load competition settings: ${configResult.error.message}`);
  }
  if (adminResult.error) {
    throw new Error(`Could not check administrator access: ${adminResult.error.message}`);
  }
  if (!profileResult.data) redirect("/access-denied");
  if (!configResult.data) throw new Error("Competition settings have not been configured.");

  return {
    supabase,
    user,
    profile: profileResult.data,
    config: configResult.data,
    isAdmin: Boolean(adminResult.data),
  };
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/log";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/?error=oauth", request.url));
    }
    const { error: profileSyncError } = await supabase.rpc("sync_my_profile", {});
    if (profileSyncError) {
      console.error("Could not sync signed-in participant:", profileSyncError.message);
      return NextResponse.redirect(new URL("/?error=profile", request.url));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/", request.url));

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/?error=oauth", request.url));
}

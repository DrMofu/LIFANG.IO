import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_OTP_TYPES = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/settings";
  const nextPath = next.startsWith("/") && !next.startsWith("//") ? next : "/settings";
  const destination = new URL(nextPath, requestUrl.origin);
  const supabase = await createSupabaseServerClient();
  let signedIn = false;

  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    signedIn = !error;
  } else if (supabase && tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    signedIn = !error;
  }

  destination.searchParams.set("auth", signedIn ? "success" : "error");
  return NextResponse.redirect(destination);
}

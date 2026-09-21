import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings as settingsTable } from "@/lib/db/schema";
import { exchangeCodeForTokens, getGmailProfile } from "@/lib/gmail/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const settingsUrl = new URL("/settings", url.origin);

  if (error) {
    settingsUrl.searchParams.set("gmail_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("gmail_error", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Happens if the user had already granted consent before and Google
      // didn't re-issue a refresh token despite prompt=consent — rare, but
      // send them back with a clear message instead of silently failing.
      settingsUrl.searchParams.set("gmail_error", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }
    const profile = await getGmailProfile(tokens.access_token);

    db.update(settingsTable)
      .set({
        gmailRefreshToken: tokens.refresh_token,
        gmailConnectedEmail: profile.emailAddress,
      })
      .where(eq(settingsTable.id, 1))
      .run();

    settingsUrl.searchParams.set("gmail_connected", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (e) {
    settingsUrl.searchParams.set(
      "gmail_error",
      e instanceof Error ? e.message : "unknown_error"
    );
    return NextResponse.redirect(settingsUrl);
  }
}

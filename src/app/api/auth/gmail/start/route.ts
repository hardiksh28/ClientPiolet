import { NextResponse } from "next/server";
import { getGmailAuthUrl, isGmailConfigured } from "@/lib/gmail/oauth";

export async function GET() {
  if (!isGmailConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?gmail_error=not_configured", "http://localhost:3000")
    );
  }
  return NextResponse.redirect(getGmailAuthUrl());
}

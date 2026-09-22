import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Topbar } from "@/components/topbar";
import { getFollowupsDueList, getRecentInboxCount, getSettings } from "@/lib/data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClientPilot",
  description: "Research and drafting machine for freelance outreach — you press send.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const settings = getSettings();
  const inboxCount = getRecentInboxCount();
  const followupsCount = getFollowupsDueList().length;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-background text-foreground">
        <Sidebar
          inboxCount={inboxCount}
          followupsCount={followupsCount}
          automation={{
            enabled: settings.automationEnabled,
            intervalMinutes: settings.automationIntervalMinutes,
            lastAutoRunAt: settings.lastAutoRunAt,
          }}
        />
        <div className="flex-1 min-w-0 lg:pl-64">
          <MobileNav inboxCount={inboxCount} followupsCount={followupsCount} />
          <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 sm:py-10 pb-24 lg:pb-10">
            <Topbar />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

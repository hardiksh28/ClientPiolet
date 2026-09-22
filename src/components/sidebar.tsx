"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  GitBranch,
  LayoutGrid,
  Mail,
  Radar,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarRunPipeline } from "./sidebar-run-pipeline";
import { AutomationToggle } from "./automation-toggle";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, badge: null as "inbox" | "followups" | null },
  { href: "/leads", label: "Opportunities", icon: Target, badge: null },
  { href: "/outreach", label: "Outreach", icon: Send, badge: null },
  { href: "/inbox", label: "Inbox", icon: Mail, badge: "inbox" as const },
  { href: "/followups", label: "Follow-ups", icon: RefreshCw, badge: "followups" as const },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch, badge: null },
  { href: "/analytics", label: "Analytics", icon: BarChart3, badge: null },
];

export function Sidebar({
  inboxCount,
  followupsCount,
  automation,
}: {
  inboxCount: number;
  followupsCount: number;
  automation: { enabled: boolean; intervalMinutes: number; lastAutoRunAt: number | null };
}) {
  const pathname = usePathname();
  const badgeValue = { inbox: inboxCount, followups: followupsCount };

  return (
    <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col bg-background">
      <div className="px-4 h-20 flex items-center">
        <div className="flex items-center gap-2 rounded-full bg-foreground text-background pl-2.5 pr-4 py-2 shadow-sm">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground">
            <Radar size={13} strokeWidth={2.5} />
          </div>
          <span className="font-bold tracking-tight text-[13px]">CLIENTPILOT</span>
        </div>
      </div>

      <nav className="flex-1 px-3.5 py-3 space-y-1.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const count = item.badge ? badgeValue[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
                active ? "bg-foreground text-background" : "text-muted hover:text-foreground hover:bg-surface"
              )}
            >
              <Icon size={16.5} strokeWidth={2.3} />
              {item.label}
              {count > 0 && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                    active ? "bg-background/20" : "bg-pink text-pink-on"
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
            pathname.startsWith("/settings")
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground hover:bg-surface"
          )}
        >
          <Settings size={16.5} strokeWidth={2.3} />
          Settings
        </Link>
      </nav>

      <SidebarRunPipeline />
      <AutomationToggle
        initialEnabled={automation.enabled}
        intervalMinutes={automation.intervalMinutes}
        lastAutoRunAt={automation.lastAutoRunAt}
      />

      <div className="mx-3.5 mb-5 rounded-[20px] bg-surface p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-green">
          <ShieldCheck size={13} strokeWidth={2.5} />
          You press send
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          ClientPilot drafts and queues. It never sends email on its own — zero deliverability
          risk, zero account bans.
        </p>
      </div>
    </aside>
  );
}

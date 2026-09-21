"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Inbox, LayoutGrid, Radar, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Queue", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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

      <nav className="flex-1 px-3.5 py-3 space-y-1.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground hover:bg-surface"
              )}
            >
              <Icon size={16.5} strokeWidth={2.3} />
              {item.label}
            </Link>
          );
        })}
      </nav>

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

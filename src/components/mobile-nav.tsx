"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Mail, Radar, RefreshCw, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, badge: null as "inbox" | "followups" | null },
  { href: "/leads", label: "Opportunities", icon: Target, badge: null },
  { href: "/inbox", label: "Inbox", icon: Mail, badge: "inbox" as const },
  { href: "/followups", label: "Follow-ups", icon: RefreshCw, badge: "followups" as const },
  { href: "/settings", label: "Settings", icon: Settings, badge: null },
];

export function MobileNav({ inboxCount, followupsCount }: { inboxCount: number; followupsCount: number }) {
  const pathname = usePathname();
  const badgeValue = { inbox: inboxCount, followups: followupsCount };

  return (
    <>
      <div className="lg:hidden flex items-center px-4 h-16 bg-background sticky top-0 z-20">
        <div className="flex items-center gap-2 rounded-full bg-foreground text-background pl-2 pr-3.5 py-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-foreground">
            <Radar size={11} strokeWidth={2.5} />
          </div>
          <span className="font-bold tracking-tight text-[12px]">CLIENTPILOT</span>
        </div>
      </div>
      <nav className="lg:hidden fixed bottom-3 inset-x-3 z-20 rounded-full bg-surface shadow-lg px-2">
        <div className="flex items-center justify-around">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const count = item.badge ? badgeValue[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 px-3.5 text-[10px] font-semibold rounded-full my-1.5 transition-colors",
                  active ? "text-foreground" : "text-muted-2"
                )}
              >
                <span className="relative">
                  <Icon size={18} strokeWidth={2.3} />
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1.5 h-1.5 w-1.5 rounded-full bg-pink" />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

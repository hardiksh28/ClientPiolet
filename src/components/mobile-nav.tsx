"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Inbox, LayoutGrid, Radar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Queue", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 px-4 text-[10.5px] font-semibold rounded-full my-1.5 transition-colors",
                  active ? "text-foreground" : "text-muted-2"
                )}
              >
                <Icon size={18} strokeWidth={2.3} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

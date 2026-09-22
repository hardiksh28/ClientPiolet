import Link from "next/link";
import { Bell } from "lucide-react";
import { SearchBar } from "./search-bar";
import { getNeedsAttention, getSettings } from "@/lib/data";

export function Topbar() {
  const settings = getSettings();
  const needsAttentionCount = getNeedsAttention(50).length;
  const initial = (settings.senderName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="hidden lg:flex items-center gap-4 mb-8">
      <SearchBar />
      <Link
        href="/inbox"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface hover:bg-surface-2 transition shrink-0"
      >
        <Bell size={16} />
        {needsAttentionCount > 0 && (
          <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-pink" />
        )}
      </Link>
      <Link
        href="/settings"
        className="flex items-center gap-2.5 rounded-full bg-surface hover:bg-surface-2 transition pl-1.5 pr-3.5 py-1.5 shrink-0"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue text-blue-on text-[12px] font-extrabold">
          {initial}
        </div>
        <span className="text-[13px] font-semibold">Hey, {settings.senderName}</span>
      </Link>
    </div>
  );
}

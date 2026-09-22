"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = (e.target as HTMLInputElement).value.trim();
      router.push(value ? `/leads?q=${encodeURIComponent(value)}` : "/leads");
    }
  }

  return (
    <div className="relative flex-1 max-w-xl">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-2" />
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        placeholder="Search leads, companies, or keywords…"
        className="w-full rounded-full bg-surface pl-10 pr-14 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
      />
      <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-2">
        ⌘K
      </kbd>
    </div>
  );
}

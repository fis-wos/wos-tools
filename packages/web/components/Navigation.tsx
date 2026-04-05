"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
}

interface NavigationProps {
  tabs: Tab[];
}

export default function Navigation({ tabs }: NavigationProps) {
  const pathname = usePathname();

  return (
    <div className="border-b border-wos-border bg-wos-panel">
      <div className="mx-auto flex max-w-6xl gap-1 px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "text-gold-light"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-light to-gold-dark" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

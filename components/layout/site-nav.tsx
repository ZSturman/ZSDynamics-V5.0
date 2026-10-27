"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ThemeToggle = dynamic(() =>
  import("@/components/global-ui/theme-toggle").then((m) => m.ThemeToggle)
);

export const PRIMARY_NAV = [
  { label: "Projects", href: "/projects" },
  { label: "Experience", href: "/experience" },
  { label: "About", href: "/about" },
  { label: "Writing", href: "/articles" },
  { label: "Work Logs", href: "/work-logs" },
  { label: "Résumé", href: "/resume" },
  { label: "Contact", href: "/contact" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Site-wide primary navigation; shows the name as a home link off the homepage. */
export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/";

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-2", className)}>
      {isHome ? (
        <span aria-hidden="true" />
      ) : (
        <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-[#244468] dark:text-[#4a9eff]">
          Zachary Sturman
        </Link>
      )}
      <div className="flex items-center gap-x-3">
        <nav aria-label="Primary" data-testid="site-nav">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:gap-x-4">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-testid={item.href === "/contact" ? "portfolio-header-contact-link" : undefined}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

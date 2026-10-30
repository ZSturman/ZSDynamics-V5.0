"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ThemeToggle = dynamic(() =>
  import("@/components/global-ui/theme-toggle").then((m) => m.ThemeToggle)
);

export const PRIMARY_NAV = [
  { label: "Apps", href: "/apps" },
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
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-2", className)}>
      {(
        <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-[#244468] dark:text-[#4a9eff]">
          Zachary Sturman
        </Link>
      )}
      <div className="flex items-center gap-x-3">
        <button ref={toggleRef} type="button" aria-expanded={open} aria-controls="primary-links" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)} className="inline-flex size-11 items-center justify-center rounded-md border border-border lg:hidden">
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
        <nav id="primary-links" aria-label="Primary" data-testid="site-nav" className={cn("lg:block", open ? "absolute inset-x-4 top-20 z-50 rounded-xl border border-border bg-background p-4 shadow-lg lg:static lg:border-0 lg:p-0 lg:shadow-none" : "hidden")}>
          <ul className="flex flex-col items-start gap-x-3 gap-y-1 text-sm lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    data-testid={item.href === "/contact" ? "portfolio-header-contact-link" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

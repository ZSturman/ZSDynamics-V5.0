import Link from "next/link"

import { cn } from "@/lib/utils"

export interface BreadcrumbTrailItem {
  label: string
  href?: string
}

interface BreadcrumbTrailProps {
  items: BreadcrumbTrailItem[]
  className?: string
}

export function BreadcrumbTrail({ items, className }: BreadcrumbTrailProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1 || !item.href

          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {isCurrent || !item.href ? (
                <span aria-current="page" className="text-foreground">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

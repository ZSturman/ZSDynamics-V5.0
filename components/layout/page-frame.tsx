import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const SITE_PAGE_FRAME_CLASS = "mx-auto w-full max-w-7xl px-4 sm:px-5 md:px-6";
export const READABLE_PAGE_COLUMN_CLASS = "mx-auto w-full max-w-4xl";

type PageElement = "article" | "div" | "footer" | "main" | "section";

type PageSectionProps = HTMLAttributes<HTMLElement> & {
  as?: PageElement;
  children: ReactNode;
  className?: string;
};

export function PageFrame({
  as,
  children,
  className,
  ...props
}: PageSectionProps) {
  const Component = as || "div";

  return (
    <Component className={cn(SITE_PAGE_FRAME_CLASS, className)} {...props}>
      {children}
    </Component>
  );
}

export function PageColumn({
  as,
  children,
  className,
  ...props
}: PageSectionProps) {
  const Component = as || "div";

  return (
    <Component className={cn(READABLE_PAGE_COLUMN_CLASS, className)} {...props}>
      {children}
    </Component>
  );
}

"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import type { ReactNode } from "react";

import { MediaDisplay } from "@/components/ui/media-display";
import { cn } from "@/lib/utils";

type ProjectIdentityVariant = "plain" | "chip";
type ProjectIdentitySize = "sm" | "md" | "lg";

interface ProjectIdentityProps {
  title: string;
  href?: string;
  iconSrc?: string | null;
  thumbnailSrc?: string | null;
  meta?: ReactNode;
  endSlot?: ReactNode;
  variant?: ProjectIdentityVariant;
  size?: ProjectIdentitySize;
  truncate?: boolean;
  className?: string;
  titleClassName?: string;
}

const avatarSizeClasses: Record<ProjectIdentitySize, string> = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-11 w-11 rounded-xl",
};

const fallbackIconSizeClasses: Record<ProjectIdentitySize, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

const titleSizeClasses: Record<ProjectIdentitySize, string> = {
  sm: "text-sm",
  md: "text-sm md:text-[0.95rem]",
  lg: "text-base",
};

export function ProjectIdentity({
  title,
  href,
  iconSrc,
  thumbnailSrc,
  meta,
  endSlot,
  variant = "plain",
  size = "md",
  truncate = false,
  className,
  titleClassName,
}: ProjectIdentityProps) {
  const visualSrc = iconSrc || thumbnailSrc || null;

  const content = (
    <>
      <span
        data-testid="project-identity-avatar"
        className={cn(
          "relative shrink-0 overflow-hidden border border-border/70 bg-muted/30",
          avatarSizeClasses[size]
        )}
      >
        {visualSrc ? (
          <MediaDisplay
            src={visualSrc}
            alt={`${title} project icon`}
            fill
            className="object-cover"
            autoPlay={false}
            loop={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <FolderOpen className={fallbackIconSizeClasses[size]} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-medium leading-tight text-foreground",
            titleSizeClasses[size],
            truncate && "truncate",
            titleClassName
          )}
        >
          {title}
        </span>
        {meta ? <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span> : null}
      </span>

      {endSlot}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-testid="project-identity"
        className={cn(
          "inline-flex min-w-0 items-center gap-2.5",
          variant === "chip" &&
            "rounded-full border border-border/70 bg-background px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/40",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      data-testid="project-identity"
      className={cn("inline-flex min-w-0 items-center gap-2.5", className)}
    >
      {content}
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpandableCardContentProps {
  children: ReactNode;
  contentLength: number;
  threshold: number;
  collapsedHeightClassName: string;
  collapsedHeightPx: number;
  minCollapsedOverflowPx?: number;
  className?: string;
  contentClassName?: string;
  expandLabel?: string;
  collapseLabel?: string;
  testId?: string;
}

export function ExpandableCardContent({
  children,
  contentLength,
  threshold,
  collapsedHeightClassName,
  collapsedHeightPx,
  minCollapsedOverflowPx = 96,
  className,
  contentClassName,
  expandLabel = "Expand",
  collapseLabel = "Collapse",
  testId,
}: ExpandableCardContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasMeaningfulOverflow, setHasMeaningfulOverflow] = useState(false);
  const shouldMeasure = contentLength > threshold;
  const shouldCollapse = shouldMeasure && hasMeaningfulOverflow;

  useLayoutEffect(() => {
    if (!shouldMeasure) {
      setHasMeaningfulOverflow(false);
      return;
    }

    const content = contentRef.current;
    if (!content) return;

    const updateOverflow = () => {
      const hiddenHeight = content.scrollHeight - collapsedHeightPx;
      setHasMeaningfulOverflow(hiddenHeight > minCollapsedOverflowPx);
    };

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(content);

    return () => observer.disconnect();
  }, [collapsedHeightPx, minCollapsedOverflowPx, shouldMeasure]);

  useEffect(() => {
    if (!shouldCollapse) {
      setIsExpanded(false);
    }
  }, [shouldCollapse]);

  if (!shouldMeasure) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      data-testid={testId}
      data-expanded={isExpanded}
      className={cn("space-y-3", className)}
    >
      <div
        ref={contentRef}
        className={cn(
          "relative",
          shouldCollapse && !isExpanded && "overflow-hidden",
          shouldCollapse && !isExpanded && collapsedHeightClassName,
          contentClassName,
        )}
      >
        {children}
        {shouldCollapse && !isExpanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-card" />
        ) : null}
      </div>

      {shouldCollapse ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isExpanded}
            className="h-auto px-4 py-1.5 text-sm font-medium text-primary hover:bg-transparent hover:text-primary/80"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? collapseLabel : expandLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const metadataTextVariants = cva(
  "inline-flex items-center gap-1 font-normal leading-6 text-muted-foreground/80",
  {
    variants: {
      tone: {
        default: "",
        interactive:
          "transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
      },
      size: {
        sm: "text-xs",
        default: "text-sm",
      },
      emphasis: {
        default: "",
        italic: "italic",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "default",
      emphasis: "default",
    },
  }
);

type MetadataTextProps = React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof metadataTextVariants> & {
    href?: string;
    external?: boolean;
    prefix?: string;
  };

function MetadataText({
  className,
  tone,
  size,
  emphasis,
  href,
  external = false,
  prefix,
  children,
  ...props
}: MetadataTextProps) {
  const content = (
    <>
      {prefix ? <span aria-hidden="true">{prefix}</span> : null}
      <span>{children}</span>
    </>
  );

  const classes = cn(metadataTextVariants({ tone, size, emphasis }), className);

  if (href) {
    const linkProps = props as React.ComponentPropsWithoutRef<"a">;

    if (external) {
      return (
        <a
          className={classes}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="metadata-text"
          {...linkProps}
        >
          {content}
        </a>
      );
    }

    return (
      <Link className={classes} href={href} data-slot="metadata-text" {...linkProps}>
        {content}
      </Link>
    );
  }

  return (
    <span className={classes} data-slot="metadata-text" {...props}>
      {content}
    </span>
  );
}

type MetadataTagProps = Omit<MetadataTextProps, "children" | "prefix" | "emphasis"> & {
  tag: string;
};

function MetadataTag({ tag, className, ...props }: MetadataTagProps) {
  return (
    <MetadataText
      className={className}
      emphasis="italic"
      prefix="#"
      data-slot="metadata-tag"
      {...props}
    >
      {tag}
    </MetadataText>
  );
}

export { MetadataTag, MetadataText, metadataTextVariants };

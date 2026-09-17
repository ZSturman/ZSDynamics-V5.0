import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const passiveChipVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground pointer-events-none cursor-default select-none",
  {
    variants: {
      tone: {
        default: "border-border/60 bg-muted/28",
        strong: "border-border/70 bg-card/80 text-foreground/80",
        overlay: "border-white/18 bg-black/35 text-white/85 backdrop-blur-sm",
        accent: "border-border/60 bg-secondary/65 text-secondary-foreground",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  }
)

function PassiveChip({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof passiveChipVariants>) {
  return (
    <span
      data-slot="passive-chip"
      className={cn(passiveChipVariants({ tone }), className)}
      {...props}
    />
  )
}

export { PassiveChip, passiveChipVariants }

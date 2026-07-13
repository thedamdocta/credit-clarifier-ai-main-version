
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-[28px] max-w-full items-center justify-center rounded-full border px-3 py-1 align-middle text-center font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] whitespace-normal break-words transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:text-xs",
  {
    variants: {
      variant: {
        default:
          "border-black bg-black text-white hover:bg-black",
        secondary:
          "border-black/15 bg-[var(--dossier-gray-pill)] text-black hover:bg-[var(--dossier-gray-pill)]",
        destructive:
          "border-[#ffb3ae] bg-[#fff1ef] text-[#b42318] hover:bg-[#fff1ef]",
        outline: "border-black/15 bg-white text-foreground hover:bg-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

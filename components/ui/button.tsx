import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

// shadcn-style button: black/white, color change and slight grow on hover.
export function Button({ className, variant = "default", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-foreground text-background hover:opacity-85",
        variant === "outline" &&
          "border border-border bg-background hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

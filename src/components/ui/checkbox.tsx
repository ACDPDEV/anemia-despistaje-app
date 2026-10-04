import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

// Minimal design-system checkbox: a native input (free label association
// and keyboard behavior, no synthetic-event gaps in any runner) restyled
// with theme tokens. The input itself is the visible box; the lucide glyph
// overlays it and appears through the peer when checked. Touch users get
// their 44px hit area from the label row (see call sites).
export function Checkbox({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <span className="relative inline-flex size-4 shrink-0">
      <input
        type="checkbox"
        data-slot="checkbox"
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-transparent shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 checked:border-primary checked:bg-primary dark:bg-input/30 dark:checked:bg-primary",
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden
        strokeWidth={3.5}
        className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  );
}

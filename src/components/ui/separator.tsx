import * as React from "react";

import { cn } from "@/lib/utils";

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border opacity-30 rounded-full",
        orientation === "horizontal" ? "h-[1.5px] w-full" : "h-full w-[1px]",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };

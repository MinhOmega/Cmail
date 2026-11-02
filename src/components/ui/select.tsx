import * as React from "react";
import { cn } from "@/lib/utils";
import type { SelectProps } from "./select-types";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, ...props }, ref) => (
    // Block-level, full-width container: an inline-flex, content-sized wrapper
    // let long <option> labels push the select past its row (see the create-mailbox
    // dialog). Pass containerClassName="w-auto" for an inline, content-sized select.
    <span className={cn("flex w-full min-w-0 rounded-lg border border-neutral-200 px-2", containerClassName)}>
      <select
        className={cn(
          "w-full min-w-0 rounded-md bg-transparent focus-visible:border-blue-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    </span>
  ),
);
Select.displayName = "Select";

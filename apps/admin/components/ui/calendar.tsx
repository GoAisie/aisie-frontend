"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// Tailwind-driven Calendar built on react-day-picker v9. Theming is fully
// token-based (brand-600 selection, muted ranges, ring on today) so dark mode
// inherits via `.dark` overrides — no separate styles needed.
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-6",
        month: "flex flex-col gap-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-foreground",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "absolute h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        nav_button_previous: "left-1",
        nav_button_next: "right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "w-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        row: "flex w-full mt-1",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-brand-50 dark:[&:has([aria-selected])]:bg-brand-900/40",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(
          "size-9 p-0 font-normal text-foreground hover:bg-muted rounded-md transition-colors aria-selected:opacity-100"
        ),
        day_range_start:
          "day-range-start rounded-l-md bg-brand-600 text-white hover:bg-brand-700 hover:text-white focus:bg-brand-700 focus:text-white",
        day_range_end:
          "day-range-end rounded-r-md bg-brand-600 text-white hover:bg-brand-700 hover:text-white focus:bg-brand-700 focus:text-white",
        day_selected:
          "bg-brand-600 text-white hover:bg-brand-700 hover:text-white focus:bg-brand-700 focus:text-white",
        day_today:
          "ring-1 ring-inset ring-brand-600 text-brand-700 dark:text-brand-300",
        day_outside: "text-muted-foreground/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground/30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-brand-50 aria-selected:text-foreground dark:aria-selected:bg-brand-900/40",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (chevronProps) =>
          chevronProps.orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }

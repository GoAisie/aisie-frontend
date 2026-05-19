"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Minimal shadcn-style Chart primitives — provides theme-aware color mapping,
// styled tooltip/legend wrappers, and a ResponsiveContainer with fixed height.
// Series colors come from CSS vars `--color-<key>` declared by the host page
// via the `config` prop; each series resolves `var(--color-X)` against the
// generated stylesheet block.

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) {
    throw new Error("useChart must be used inside <ChartContainer>")
  }
  return ctx
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          // Force chart to consume parent height; host wraps in fixed-height
          // container (h-[260px], h-[300px], etc.) to dodge the Recharts /
          // React 19 strict-mode "empty first render" bug.
          "flex aspect-auto h-full w-full justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/40",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-radial-bar-background-sector]:fill-muted",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/40",
          "[&_.recharts-reference-line_line]:stroke-border",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

// Generates a scoped <style> block mapping each config key to a CSS custom
// property like `--color-completed: oklch(...)`. Recharts series read these
// via inline `fill={"var(--color-completed)"}` in the host markup.
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, c]) => c.color)
  if (!entries.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart='${id}'] {\n${entries
          .map(([k, c]) => `  --color-${k}: ${c.color};`)
          .join("\n")}\n}`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    active?: boolean
    payload?: Array<{
      value?: number | string
      name?: string
      dataKey?: string
      color?: string
      payload?: Record<string, unknown>
    }>
    label?: string
    labelFormatter?: (value: string) => React.ReactNode
    valueFormatter?: (value: number | string, name: string) => React.ReactNode
    hideLabel?: boolean
    hideIndicator?: boolean
  }
>(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      valueFormatter,
      hideLabel = false,
      hideIndicator = false,
      className,
    },
    ref
  ) => {
    const { config } = useChart()
    if (!active || !payload?.length) return null
    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[10rem] items-start gap-1.5 rounded-lg border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-md",
          className
        )}
      >
        {!hideLabel && label && (
          <div className="font-medium text-foreground">
            {labelFormatter ? labelFormatter(label) : label}
          </div>
        )}
        <div className="grid gap-1">
          {payload.map((item, i) => {
            const cfg = item.name ? config[item.name] : undefined
            const displayName = cfg?.label ?? item.name ?? item.dataKey
            return (
              <div
                key={`${item.dataKey}-${i}`}
                className="flex w-full items-center justify-between gap-3"
              >
                <div className="flex items-center gap-1.5">
                  {!hideIndicator && (
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ background: item.color }}
                    />
                  )}
                  <span className="text-muted-foreground">{displayName}</span>
                </div>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {valueFormatter && item.value !== undefined && item.name
                    ? valueFormatter(item.value, item.name)
                    : item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    payload?: Array<{ value?: string; color?: string; dataKey?: string }>
    verticalAlign?: "top" | "bottom"
    hideIcon?: boolean
  }
>(({ className, payload, verticalAlign = "bottom", hideIcon = false }, ref) => {
  const { config } = useChart()
  if (!payload?.length) return null
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4 text-xs",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const cfg = item.value ? config[item.value] : undefined
        return (
          <div key={item.value} className="flex items-center gap-1.5">
            {!hideIcon && (
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: item.color }}
              />
            )}
            <span className="text-muted-foreground">
              {cfg?.label ?? item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}

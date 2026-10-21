import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"

import { Timestamp } from "@/components/timestamp"
import type { LinkTarget } from "@/lib/links"
import { useLiveness } from "@/shell/liveness"

import type { Trend } from "./sample-history"

const trendIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const

/**
 * One Overview card: a headline, a label, a subtitle, when it was observed, and a trend
 * against the previous poll. The whole card links into its section.
 */
export function StatCard({
  title,
  headline,
  label,
  subtitle,
  observedAt,
  trend,
  to,
  testId,
}: {
  title: string
  headline: ReactNode
  label?: ReactNode
  subtitle?: ReactNode
  observedAt?: number | string
  trend?: Trend
  to: LinkTarget
  testId: string
}) {
  const { paused } = useLiveness()
  const TrendIcon = trend ? trendIcon[trend] : null
  return (
    <Link
      {...(to as unknown as { to: "/" })}
      aria-label={title}
      data-testid={testId}
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card
        size="sm"
        className={cn("h-full transition-opacity hover:bg-muted/40", paused && "opacity-60")}
      >
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <span
            className="flex items-center gap-1 text-2xl font-semibold tabular-nums"
            data-testid={`${testId}-headline`}
          >
            {headline}
            {TrendIcon && (
              <TrendIcon aria-label={`trend ${trend}`} className="size-4 text-muted-foreground" />
            )}
          </span>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          {subtitle && (
            <span className="text-xs" data-testid={`${testId}-subtitle`}>
              {subtitle}
            </span>
          )}
          {observedAt !== undefined && observedAt !== 0 && (
            <span className="text-xs text-muted-foreground">
              as of{" "}
              <Timestamp
                value={typeof observedAt === "number" ? new Date(observedAt) : observedAt}
              />
              {paused && " · paused"}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

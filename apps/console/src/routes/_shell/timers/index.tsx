import { Button } from "@keiro-ui/ui/components/button"
import { Input } from "@keiro-ui/ui/components/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@keiro-ui/ui/components/tabs"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { Timestamp } from "@/components/timestamp"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { useLiveTimers, useStuckTimers } from "@/features/timers/queries"
import { durationError, type TimersSearch, timersSearch } from "@/features/timers/search"
import { GateNotice } from "@/features/timers/timer-actions"
import { TimersTable } from "@/features/timers/TimersTable"
import { useNow } from "@/lib/use-now"
import { useLiveness } from "@/shell/liveness"

export const Route = createFileRoute("/_shell/timers/")({
  validateSearch: timersSearch,
  component: TimersPage,
})

const feedCaption = {
  live: "live",
  reconnecting: "reconnecting the feed",
  read_failed: "the feed's last read failed; polling",
  off: "polling",
} as const

function TimersPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const tab = search.tab ?? "pending"
  return (
    <>
      <PageHeader
        title="Timers"
        description="Wake-ups process managers asked keiro to fire later."
      />
      <div className="flex flex-col gap-3 p-6">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                tab: key === "stuck" ? "stuck" : undefined,
                after: undefined,
              }),
            })
          }
        >
          <TabsList aria-label="Timer views">
            <TabsTrigger id="pending">Pending</TabsTrigger>
            <TabsTrigger id="stuck">Stuck</TabsTrigger>
          </TabsList>
          <TabsContent id="pending">
            <PendingTab search={search} />
          </TabsContent>
          <TabsContent id="stuck">
            <StuckTab search={search} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function FilterBar({ search }: { search: TimersSearch }) {
  const navigate = Route.useNavigate()
  const [manager, setManager] = useState(search.manager ?? "")
  const [correlation, setCorrelation] = useState(search.correlation ?? "")
  return (
    <form
      aria-label="Timer filters"
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void navigate({
          search: (prev) => ({
            ...prev,
            manager: manager.trim() || undefined,
            correlation: correlation.trim() || undefined,
            after: undefined,
          }),
        })
      }}
    >
      <Input
        aria-label="Manager"
        placeholder="Process manager"
        className="w-56"
        value={manager}
        onChange={(e) => setManager(e.target.value)}
      />
      <Input
        aria-label="Correlation"
        placeholder="Correlation id"
        className="w-64"
        value={correlation}
        onChange={(e) => setCorrelation(e.target.value)}
      />
      <Button type="submit" size="sm" variant="outline">
        Filter
      </Button>
    </form>
  )
}

function PendingTab({ search }: { search: TimersSearch }) {
  const { page, feedStatus } = useLiveTimers(search)
  const { paused } = useLiveness()
  const pager = useCursorTrail("after")
  const now = useNow()
  return (
    <div className="flex flex-col gap-3">
      <FilterBar key={`${search.manager ?? ""}|${search.correlation ?? ""}`} search={search} />
      <p className="text-xs text-muted-foreground" data-testid="timers-caption">
        {page.data?.observed_at && (
          <>
            as of <Timestamp value={page.data.observed_at} /> ·{" "}
          </>
        )}
        {paused
          ? "paused"
          : search.after !== undefined
            ? "polling (later pages are poll-only)"
            : feedCaption[feedStatus]}
      </p>
      {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
      <GateNotice subject="Timer actions" />
      <TimersTable
        timers={page.data?.items ?? []}
        now={now}
        isPending={page.isPending}
        label="Pending timers"
        actions
      />
      <CursorPager
        cursor={search.after}
        nextCursor={page.data?.nextCursor}
        trail={pager.trail}
        onNavigate={pager.go}
        itemCount={page.data?.items.length}
      />
    </div>
  )
}

function StuckTab({ search }: { search: TimersSearch }) {
  const navigate = Route.useNavigate()
  const minAgeError = search.min_age ? durationError(search.min_age) : null
  const stuck = useStuckTimers({
    min_age: minAgeError ? undefined : search.min_age,
    min_attempts: search.min_attempts,
  })
  const [minAge, setMinAge] = useState(search.min_age ?? "")
  const [minAttempts, setMinAttempts] = useState(search.min_attempts?.toString() ?? "")
  const [error, setError] = useState<string | null>(minAgeError)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Stuck timers have been firing longer than the minimum age, or were claimed at least the
        minimum number of times. Polled only; keiro has no stuck feed.
      </p>
      <form
        aria-label="Stuck filters"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const age = minAge.trim()
          const problem = age ? durationError(age) : null
          setError(problem)
          if (problem) return
          void navigate({
            search: (prev) => ({
              ...prev,
              min_age: age || undefined,
              min_attempts: minAttempts.trim() === "" ? undefined : Number(minAttempts),
            }),
          })
        }}
      >
        <Input
          aria-label="Minimum age"
          placeholder="Minimum age, e.g. 5m"
          className="w-44"
          value={minAge}
          onChange={(e) => setMinAge(e.target.value)}
        />
        <Input
          aria-label="Minimum attempts"
          inputMode="numeric"
          placeholder="Minimum attempts"
          className="w-40"
          value={minAttempts}
          onChange={(e) => setMinAttempts(e.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {stuck.isError && <p className="text-sm text-destructive">{stuck.error.message}</p>}
      <GateNotice subject="Timer actions" />
      <TimersTable
        timers={stuck.data ?? []}
        now={0}
        isPending={stuck.isPending}
        stuck
        label="Stuck timers"
        actions
      />
    </div>
  )
}

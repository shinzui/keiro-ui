import { EmptyState } from "@/components/empty-state"

const FAMILY = {
  aggregate: { title: "Aggregate inspection", probe: "/keiro/aggregate/types" },
  pm: { title: "Process-manager inspection", probe: "/keiro/pm/list" },
} as const

/**
 * keiro serves `aggregate` and `pm` reads only when the application mounts its inspection
 * hooks (mori://shinzui/keiro/okf/adrs/concepts/ADR-40); a host without them refuses the
 * command word. Rendered for the client's `RouteUnavailable` refusal, never as an error.
 */
export function NotMountedState({ family }: { family: keyof typeof FAMILY }) {
  const { title, probe } = FAMILY[family]
  return (
    <div data-testid="not-mounted">
      <EmptyState
        title={`${title} is not mounted on this keiro host`}
        description={
          <>
            keiro answers these reads only when the application mounts its inspection hooks. The
            console probed <code className="font-mono text-xs">{probe}</code> and the host refused
            the command. See <code className="font-mono text-xs">dev/README.md</code> for running a
            host that mounts them.
          </>
        }
      />
    </div>
  )
}

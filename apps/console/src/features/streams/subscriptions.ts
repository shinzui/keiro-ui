import type { CheckpointInventory, LiveSubscription } from "@keiro-ui/client-kiroku"

export interface SubscriptionGroup {
  subscription: string
  members: {
    member: number
    checkpoint_position: bigint
    updated_at: string
    live?: LiveSubscription
  }[]
}

/** Checkpoint rows grouped by subscription, annotated with the process-local live registry. */
export function groupCheckpoints(
  inventory: CheckpointInventory | undefined,
  live: LiveSubscription[] | undefined,
): SubscriptionGroup[] {
  const groups = new Map<string, SubscriptionGroup>()
  for (const row of inventory?.checkpoints ?? []) {
    const group = groups.get(row.subscription) ?? { subscription: row.subscription, members: [] }
    group.members.push({
      member: row.member,
      checkpoint_position: row.checkpoint_position,
      updated_at: row.updated_at,
      live: live?.find(
        (entry) => entry.subscription === row.subscription && entry.member === row.member,
      ),
    })
    groups.set(row.subscription, group)
  }
  return [...groups.values()]
}

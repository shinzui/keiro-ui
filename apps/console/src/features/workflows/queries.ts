import { useCursorPages, useSurfaceQuery } from "@keiro-ui/client-core"
import {
  type AwakeablesCursor,
  type ChildrenCursor,
  type JournalCursor,
  keiroKeys,
  type StepsCursor,
  useKeiroClient,
  type WorkflowListCursor,
  type WorkflowListFilters,
} from "@keiro-ui/client-keiro"
import { useWorkflowsFeed } from "@keiro-ui/client-keiro/feeds"

import { useLiveness } from "@/shell/liveness"

import { DEFAULT_LIMIT, type WorkflowsSearch } from "./search"

// Every keiro workflow read of the section goes through this file.

const DETAIL_PAGE = 100

/** The URL's list search as the client's filters; the default ordering is left implicit. */
export function listFilters(search: WorkflowsSearch): WorkflowListFilters {
  return {
    status_class: search.status_class?.length ? search.status_class : undefined,
    workflow_name: search.workflow_name,
    created_since: search.created_since,
    created_before: search.created_before,
    updated_since: search.updated_since,
    updated_before: search.updated_before,
    ordering: search.ordering === "created_desc" ? "created_desc" : undefined,
    limit: search.limit ?? DEFAULT_LIMIT,
    after: search.after as WorkflowListCursor | undefined,
  }
}

/**
 * One list page per URL. On page one with feed-compatible filters, the `workflows` feed
 * merges its frames into this same cache entry; a time window, a non-default ordering, or a
 * later page keeps the list poll-only.
 */
export function useWorkflowList(search: WorkflowsSearch) {
  const keiro = useKeiroClient()
  const { paused } = useLiveness()
  const filters = listFilters(search)
  const page = useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.workflows.list(filters as Record<string, unknown>),
    queryFn: ({ signal }) => keiro.workflows.list(filters, signal),
  })
  const feed = useWorkflowsFeed(filters, { enabled: !paused })
  const { after, status_class: _c, workflow_name: _n, limit: _l, ...rest } = filters
  const pollOnlyReason =
    after !== undefined
      ? "later pages are poll-only"
      : Object.values(rest).some((v) => v !== undefined)
        ? "time windows and ordering are poll-only"
        : undefined
  return { page, feedStatus: feed.status, pollOnlyReason }
}

export function useWorkflowHeader(name: string, id: string) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.workflows.header(name, id),
    queryFn: ({ signal }) => keiro.workflows.header(name, id, signal),
  })
}

export function useJournal(name: string, id: string, generation: number | undefined) {
  const keiro = useKeiroClient()
  return useCursorPages({
    surface: "keiro",
    queryKey: keiroKeys.workflows.journal(name, id, { generation, limit: DETAIL_PAGE }),
    fetchPage: (after: JournalCursor | undefined, signal) =>
      keiro.workflows.journal(name, id, { after, generation, limit: DETAIL_PAGE }, signal),
  })
}

export function useSteps(name: string, id: string, generation: number | undefined) {
  const keiro = useKeiroClient()
  return useCursorPages({
    surface: "keiro",
    queryKey: keiroKeys.workflows.steps(name, id, { generation, limit: DETAIL_PAGE }),
    fetchPage: (after: StepsCursor | undefined, signal) =>
      keiro.workflows.steps(name, id, { after, generation, limit: DETAIL_PAGE }, signal),
  })
}

export function useChildren(name: string, id: string) {
  const keiro = useKeiroClient()
  return useCursorPages({
    surface: "keiro",
    queryKey: keiroKeys.workflows.children(name, id, { limit: DETAIL_PAGE }),
    fetchPage: (after: ChildrenCursor | undefined, signal) =>
      keiro.workflows.children(name, id, { after, limit: DETAIL_PAGE }, signal),
  })
}

export function useAwakeables(name: string, id: string) {
  const keiro = useKeiroClient()
  return useCursorPages({
    surface: "keiro",
    queryKey: keiroKeys.workflows.awakeables(name, id, { limit: DETAIL_PAGE }),
    fetchPage: (after: AwakeablesCursor | undefined, signal) =>
      keiro.workflows.awakeables(name, id, { after, limit: DETAIL_PAGE }, signal),
  })
}

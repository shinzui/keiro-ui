import { isApiError, useSurfaceAvailable } from "@keiro-ui/client-core"
import {
  type CategoryConsumersCursor,
  isInspectionReadUnavailable,
  isTooLarge,
  keiroKeys,
} from "@keiro-ui/client-keiro"
import { Button } from "@keiro-ui/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { CursorPager } from "@/components/CursorPager"
import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"

import { useCategoryConsumers } from "./consumer-queries"

export function CategoryConsumersPanel({ category }: { category: string }) {
  const available = useSurfaceAvailable("keiro")
  return (
    <Card role="region" aria-label="Declared consumers" size="sm">
      <CardHeader>
        <CardTitle>Declared consumers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          Matching mounted configuration; this does not report worker health or delivery progress.
        </p>
        {available ? (
          <ConsumerInventory key={category} category={category} />
        ) : (
          <p>Keiro inspection is not configured</p>
        )}
      </CardContent>
    </Card>
  )
}

function ConsumerInventory({ category }: { category: string }) {
  const [cursor, setCursor] = useState<CategoryConsumersCursor>()
  const [trail, setTrail] = useState<(string | undefined)[]>([])
  const [notice, setNotice] = useState<string>()
  const query = useCategoryConsumers(category, cursor)
  const client = useQueryClient()
  const unavailable = isInspectionReadUnavailable(query.error, "category-consumers")
  const invalidCursor = cursor !== undefined && isApiError(query.error, "invalid_cursor")
  // The cursor becomes invalid in response to an external inventory change. Reset this
  // panel before rendering another page; changing its query key re-reads page one.
  if (invalidCursor) {
    setNotice("The consumer inventory changed or the cursor expired; restarted from page one.")
    setCursor(undefined)
    setTrail([])
  }
  const refresh = () => {
    setCursor(undefined)
    setTrail([])
    setNotice(undefined)
    void client.invalidateQueries({
      queryKey: keiroKeys.projections.consumers({ category, limit: 100 }),
      exact: true,
    })
  }
  const data = query.data
  return (
    <>
      <div>
        <Button size="xs" variant="outline" onPress={refresh} isDisabled={query.isFetching}>
          Refresh consumers
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {query.isPending && <p>Loading declared consumers…</p>}
      {query.error && !invalidCursor && (
        <div role="status" className="text-destructive">
          {data && "Stale metadata: "}
          {unavailable ? (
            "Consumer discovery is unavailable on this host"
          ) : (
            <>
              {isTooLarge(query.error) && "The server refused the result size. "}
              {query.error.code ?? "read_failed"}: {query.error.message}
            </>
          )}
          <Button size="xs" variant="outline" onPress={() => void query.refetch()}>
            Retry consumers
          </Button>
        </div>
      )}
      {data && (
        <>
          <p>
            Projection catalog metadata:{" "}
            {data.coverage.projection_catalog ? "available" : "unavailable"}
            <br />
            Durable subscriber metadata:{" "}
            {data.coverage.durable_subscribers ? "available" : "unavailable"}
          </p>
          {(!data.coverage.projection_catalog || !data.coverage.durable_subscribers) && (
            <p className="text-muted-foreground">
              Coverage is partial; other consumers may not be reported.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Fetched <Timestamp value={new Date(query.dataUpdatedAt)} />
          </p>
          {data.items.length === 0 ? (
            <p>No matching consumers in the reported metadata</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.items.map((item) => (
                <li key={`${item.kind}:${item.name}`} className="rounded border p-3">
                  <p className="font-medium">{item.name}</p>
                  <p>Kind: {item.kind.replaceAll("_", " ")}</p>
                  <p>
                    Group:{" "}
                    {item.group_id === null ? (
                      "not reported"
                    ) : (
                      <Link {...links.projection(item.group_id)} className="underline">
                        {item.group_id}
                      </Link>
                    )}
                  </p>
                  <ul
                    className="flex flex-col gap-2 pt-2"
                    aria-label={`Matching bindings for ${item.name}`}
                  >
                    {item.bindings.map((binding) => (
                      <li key={JSON.stringify(binding)} className="border-l pl-3">
                        <p>
                          Projection: {binding.projection_id ?? "not reported"} · Handler:{" "}
                          {binding.handler_name ?? "not reported"}
                        </p>
                        <p>Delivery: {binding.delivery}</p>
                        {binding.delivery === "subscription" && (
                          <p>
                            Subscription:{" "}
                            {binding.subscription_name === null ? (
                              "not reported"
                            ) : (
                              <Link
                                {...links.subscription(binding.subscription_name)}
                                className="underline"
                              >
                                {binding.subscription_name}
                              </Link>
                            )}{" "}
                            · ID: {binding.subscription_id ?? "not reported"}
                          </p>
                        )}
                        <p>
                          Source:{" "}
                          {binding.source.kind === "all"
                            ? "all categories"
                            : binding.source.kind === "category"
                              ? `category: ${binding.source.category}`
                              : `namespace: ${binding.source.namespace}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <CursorPager
            cursor={cursor}
            nextCursor={data.nextCursor}
            trail={trail}
            onNavigate={(next, previous) => {
              setCursor(next as CategoryConsumersCursor | undefined)
              setTrail(previous)
            }}
            itemCount={data.items.length}
          />
        </>
      )}
    </>
  )
}

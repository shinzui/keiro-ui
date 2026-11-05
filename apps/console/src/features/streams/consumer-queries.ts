import { useSurfaceQuery } from "@keiro-ui/client-core"
import { type CategoryConsumersCursor, keiroKeys, useKeiroClient } from "@keiro-ui/client-keiro"

export function useCategoryConsumers(category: string, after?: CategoryConsumersCursor) {
  const keiro = useKeiroClient()
  const query = { category, limit: 100, after }
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.projections.consumers(query),
    queryFn: ({ signal }) => keiro.projections.consumers(query, signal),
    poll: false,
  })
}

import { createKeiroClient, KeiroClientProvider } from "@keiro-ui/client-keiro"
import { createKirokuClient, KirokuClientProvider } from "@keiro-ui/client-kiroku"
import { createPgmqClient, PgmqClientProvider } from "@keiro-ui/client-pgmq"
import { createShibuyaClient, ShibuyaClientProvider } from "@keiro-ui/client-shibuya"
import { type ReactNode, useMemo } from "react"

import { useSurfaceBaseUrl } from "./connection-profiles"

/**
 * Composes the four surface clients from the active connection profile; switching profiles
 * rebuilds them. Screens read them with useKirokuClient(), usePgmqClient(), ...
 */
export function ClientsProvider({ children }: { children: ReactNode }) {
  const kirokuUrl = useSurfaceBaseUrl("kiroku")
  const pgmqUrl = useSurfaceBaseUrl("pgmq")
  const shibuyaUrl = useSurfaceBaseUrl("shibuya")
  const keiroUrl = useSurfaceBaseUrl("keiro")
  const kiroku = useMemo(() => createKirokuClient({ baseUrl: kirokuUrl }), [kirokuUrl])
  const pgmq = useMemo(() => createPgmqClient({ baseUrl: pgmqUrl }), [pgmqUrl])
  const shibuya = useMemo(() => createShibuyaClient({ baseUrl: shibuyaUrl }), [shibuyaUrl])
  const keiro = useMemo(() => createKeiroClient({ baseUrl: keiroUrl }), [keiroUrl])
  return (
    <KirokuClientProvider client={kiroku}>
      <PgmqClientProvider client={pgmq}>
        <ShibuyaClientProvider client={shibuya}>
          <KeiroClientProvider client={keiro}>{children}</KeiroClientProvider>
        </ShibuyaClientProvider>
      </PgmqClientProvider>
    </KirokuClientProvider>
  )
}

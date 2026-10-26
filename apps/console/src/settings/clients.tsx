import { createKeiroClient, KeiroClientProvider } from "@keiro-ui/client-keiro"
import { createKirokuClient, KirokuClientProvider } from "@keiro-ui/client-kiroku"
import { createPgmqClient, PgmqClientProvider } from "@keiro-ui/client-pgmq"
import { createShibuyaClient, ShibuyaClientProvider } from "@keiro-ui/client-shibuya"
import { type ReactNode, useMemo } from "react"

import { useSurfaceBaseUrl } from "./connection-profiles"

const unavailableFetch: typeof fetch = async () => {
  throw new Error("Not configured for this application")
}
const optionsFor = (baseUrl: string) =>
  baseUrl ? { baseUrl } : { baseUrl: "http://unconfigured.invalid", fetch: unavailableFetch }

/**
 * Composes the four surface clients from the active connection profile; switching profiles
 * rebuilds them. Screens read them with useKirokuClient(), usePgmqClient(), ...
 */
export function ClientsProvider({ children }: { children: ReactNode }) {
  const kirokuUrl = useSurfaceBaseUrl("kiroku")
  const pgmqUrl = useSurfaceBaseUrl("pgmq")
  const shibuyaUrl = useSurfaceBaseUrl("shibuya")
  const keiroUrl = useSurfaceBaseUrl("keiro")
  const kiroku = useMemo(() => createKirokuClient(optionsFor(kirokuUrl)), [kirokuUrl])
  const pgmq = useMemo(() => createPgmqClient(optionsFor(pgmqUrl)), [pgmqUrl])
  const shibuya = useMemo(() => createShibuyaClient(optionsFor(shibuyaUrl)), [shibuyaUrl])
  const keiro = useMemo(() => createKeiroClient(optionsFor(keiroUrl)), [keiroUrl])
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

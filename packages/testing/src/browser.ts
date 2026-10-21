// Placeholder for the MSW browser worker; docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md
// replaces it. The console's VITE_MOCK=1 bootstrap (apps/console/src/main.tsx) already calls it.
export async function startMockWorker(): Promise<void> {
  console.warn(
    "@keiro-ui/testing: the mock worker is not implemented yet; requests go to the network",
  )
}

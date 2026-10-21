import type { ReactNode } from "react"

import { EmptyState } from "./empty-state"
import { PageHeader } from "./page-header"

/** A page whose screen arrives with a later plan; replaced by that plan's component. */
export function PlaceholderPage({
  title,
  plan,
  children,
}: {
  title: ReactNode
  plan: string
  children?: ReactNode
}) {
  return (
    <>
      <PageHeader title={title} />
      <div className="p-6">
        <EmptyState
          title="Coming in a later plan"
          description={<>This screen arrives with {plan}.</>}
        />
        {children}
      </div>
    </>
  )
}

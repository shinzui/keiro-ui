import { Button } from "@keiro-ui/ui/components/button"
import { Input } from "@keiro-ui/ui/components/input"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import { PageHeader } from "@/components/page-header"
import { useKnownManagerNames } from "@/features/process-managers/queries"
import { links } from "@/lib/links"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/process-managers/")({
  validateSearch: shellSearchSchema,
  component: ProcessManagersPage,
})

function NameList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {names.map((name) => (
          <li key={name}>
            <Link {...links.processManager(name)} className="underline-offset-2 hover:underline">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Never calls keiro: names come from the profile and recents, or the operator types one. */
function ProcessManagersPage() {
  const navigate = Route.useNavigate()
  const { configured, recent } = useKnownManagerNames()
  const [name, setName] = useState("")
  return (
    <>
      <PageHeader
        title="Process managers"
        description="keiro does not expose a list of mounted process managers; add names in Settings → Connections or open one by name."
      />
      <div className="flex max-w-xl flex-col gap-4 p-6">
        <form
          aria-label="Open a process manager"
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const value = name.trim()
            if (value) void navigate(links.processManager(value))
          }}
        >
          <Input
            aria-label="Process manager name"
            placeholder="Process manager name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" isDisabled={name.trim() === ""}>
            Open
          </Button>
        </form>
        <NameList title="Configured for this connection" names={configured} />
        <NameList title="Recently opened" names={recent} />
        {configured.length === 0 && recent.length === 0 && (
          <p className="text-sm text-muted-foreground">No process manager names known yet.</p>
        )}
        <p className="text-xs text-muted-foreground">
          <Link {...links.settingsConnections()} className="underline-offset-2 hover:underline">
            Settings → Connections
          </Link>
        </p>
      </div>
    </>
  )
}

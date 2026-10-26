import { SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"

import { surfaces, useSurfaceBaseUrl, type Surface } from "@/settings/connection-profiles"

import type { SheetProps } from "./right-sheet"

function SurfaceRow({ surface }: { surface: Surface }) {
  const baseUrl = useSurfaceBaseUrl(surface)
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{surface}</dt>
      <dd className="break-all">{baseUrl || "Not configured for this application"}</dd>
    </div>
  )
}

/** The shell-owned `about` sheet: version and the four configured surface URLs. */
export function AboutSheet(_props: SheetProps) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>About this console</SheetTitle>
        <SheetDescription>keiro runtime console</SheetDescription>
      </SheetHeader>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 px-4 text-sm">
        <dt className="text-muted-foreground">version</dt>
        <dd>{__APP_VERSION__}</dd>
        <dt className="text-muted-foreground">commit</dt>
        <dd>{__GIT_COMMIT__}</dd>
        {surfaces.map((surface) => (
          <SurfaceRow key={surface} surface={surface} />
        ))}
      </dl>
    </>
  )
}

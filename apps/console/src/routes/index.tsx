import { Button } from "@keiro-ui/ui/components/button"
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@keiro-ui/ui/components/sheet"
import { createFileRoute } from "@tanstack/react-router"

import { useTheme } from "@/shell/theme"

export const Route = createFileRoute("/")({
  component: PlaceholderPage,
})

const weights = [
  ["font-thin", "100"],
  ["font-extralight", "200"],
  ["font-light", "300"],
  ["font-normal", "400"],
  ["font-medium", "500"],
  ["font-semibold", "600"],
  ["font-bold", "700"],
  ["font-extrabold", "800"],
] as const

function PlaceholderPage() {
  const { resolved, setTheme } = useTheme()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">keiro runtime console</h1>
      <div className="flex flex-col gap-1">
        {weights.map(([className, weight]) => (
          <p key={weight} className={className}>
            {weight} — The append-only log remembers every event.
          </p>
        ))}
      </div>
      <pre className="text-muted-foreground">
        {"global_position 0000000042  [ok]\nglobal_position 9007199254740993  {int64}"}
      </pre>
      <div className="flex gap-3">
        <Button variant="outline" onPress={() => setTheme(resolved === "dark" ? "light" : "dark")}>
          {resolved === "dark" ? "Use light theme" : "Use dark theme"}
        </Button>
        <SheetTrigger>
          <Button>Open inspector</Button>
          <Sheet side="right">
            <SheetHeader>
              <SheetTitle>Inspector</SheetTitle>
              <SheetDescription>
                Entity inspectors open here without leaving the page.
              </SheetDescription>
            </SheetHeader>
          </Sheet>
        </SheetTrigger>
      </div>
    </main>
  )
}

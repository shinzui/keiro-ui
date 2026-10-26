import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_shell/settings/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/settings/connections", search })
  },
})

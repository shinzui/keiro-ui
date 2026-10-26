// Disposable composed inspection hosts. No database access; journals contain fixture data only.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const fixtures = fileURLToPath(new URL("../../packages/testing/fixtures/", import.meta.url))
const meta = JSON.parse(readFileSync(resolve(fixtures, "_meta.json"), "utf8"))
const read = (name: string) => JSON.parse(readFileSync(resolve(fixtures, name), "utf8"))
const timer = read("keiro/timers-pending.json").items[0]
const servers = []
for (const [app, port] of [
  ["orders", Number(process.env.ORDERS_PORT ?? 19193)],
  ["billing", Number(process.env.BILLING_PORT ?? 19293)],
] as const) {
  const journal: unknown[] = []
  const sockets = new Set<any>()
  let delayMs = 0
  let executeDelayMs = 0
  const unavailable = new Set<string>()
  const workerStates = new Map<string, string>()
  const workerMetrics = (worker?: string) => {
    const metrics = read("shibuya/metrics.json")
    metrics.detailed.state.status = workerStates.get(worker ?? "direct") ?? "processing"
    metrics.detailed.stats.processed =
      (app === "orders" ? 100 : 200) + (worker === "subscriptions-1" ? 2 : 1)
    return metrics
  }
  const workflowPage = () => {
    const page = read("keiro/workflows.json")
    page.items[0].status = app === "orders" ? "completed" : "failed"
    page.items[0].status_class = app === "orders" ? "completed" : "failed"
    page.items[0].last_error = `${app} fixture`
    delete page.next_cursor
    return page
  }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request, server) {
      const url = new URL(request.url)
      if (url.pathname === "/__ready") return Response.json({ app })
      if (url.pathname === "/__journal")
        return Response.json(
          url.searchParams.has("worker")
            ? journal.filter((entry: any) => entry.worker === url.searchParams.get("worker"))
            : journal,
        )
      if (url.pathname === "/__control" && request.method === "POST") {
        const control = await request.json()
        delayMs = control.delayMs ?? delayMs
        executeDelayMs = control.executeDelayMs ?? executeDelayMs
        if (control.worker) {
          if (control.unavailable) {
            unavailable.add(control.worker)
            for (const socket of sockets) if (socket.data.worker === control.worker) socket.close()
          } else unavailable.delete(control.worker)
        }
        if (control.closeFeeds) for (const socket of sockets) socket.close()
        if (control.reset) {
          journal.length = 0
          delayMs = 0
          executeDelayMs = 0
          unavailable.clear()
          workerStates.clear()
        }
        if (control.frame) for (const socket of sockets) socket.send(JSON.stringify(control.frame))
        return Response.json({ ok: true })
      }
      const workerMatch = /^\/workers\/([^/]+)\/shibuya(\/.*)$/.exec(url.pathname)
      const worker = workerMatch?.[1]
      const path = workerMatch ? `/shibuya${workerMatch[2]}` : url.pathname
      const body = request.method === "POST" ? await request.text() : undefined
      journal.push({
        method: request.method,
        path: url.pathname,
        query: url.search,
        body,
        origin: request.headers.get("origin"),
        worker,
      })
      if (worker && (!["jobs-1", "subscriptions-1"].includes(worker) || unavailable.has(worker)))
        return Response.json({ error: "worker unavailable" }, { status: 503 })
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        if (server.upgrade(request, { data: { path, worker } })) return
        return new Response("upgrade failed", { status: 400 })
      }
      if (delayMs && request.method === "GET" && !path.includes("health")) await Bun.sleep(delayMs)
      if (path === "/keiro/health")
        return Response.json({ status: "ok", schema_drift: [], mutations_enabled: true })
      if (path === "/keiro/wf/inspect/list") return Response.json(workflowPage())
      const mutation = /^\/keiro\/timer\/(requeue|cancel)\/([^/]+)$/.exec(path)
      if (mutation && request.method === "POST") {
        const execute = body?.trim() !== ""
        if (execute && body !== '{"confirm":"execute"}')
          return Response.json(
            { error: { code: "invalid_confirmation", message: "invalid confirmation" } },
            { status: 400 },
          )
        if (execute && executeDelayMs) await Bun.sleep(executeDelayMs)
        return Response.json(
          execute
            ? {
                outcome: "executed",
                result: {
                  operation: mutation[1],
                  outcome: "transitioned",
                  transitioned: true,
                  timer: { ...timer, status: mutation[1] === "cancel" ? "cancelled" : "scheduled" },
                },
              }
            : {
                outcome: "preview",
                result: {
                  preview: true,
                  operation: mutation[1],
                  disposition: `would_${mutation[1]}`,
                  timer,
                },
                cli_reinvocation: "fixture-only",
              },
        )
      }
      if (path === "/shibuya/control")
        return Response.json({ enabled: true, operations: ["pause", "resume"] })
      const control = /^\/shibuya\/control\/processors\/([^/]+)\/(pause|resume)$/.exec(path)
      if (control && request.method === "POST") {
        const state = control[2] === "pause" ? "paused" : "processing"
        workerStates.set(worker ?? "direct", state)
        for (const socket of sockets)
          if (socket.data.worker === worker)
            socket.send(
              JSON.stringify({
                type: "update",
                processor: control[1],
                metrics: workerMetrics(worker)[control[1]],
              }),
            )
        return Response.json({
          processor: control[1],
          state: state === "processing" ? "running" : state,
          pausedAt: state === "paused" ? new Date().toISOString() : null,
        })
      }
      if (path === "/shibuya/metrics") return Response.json(workerMetrics(worker))
      for (const [file, entry] of Object.entries(meta.files) as [string, any][]) {
        if (entry.variant !== "default" || entry.method !== request.method) continue
        const concrete = `/${entry.surface}${entry.template.replace(/\{([^}]+)\}/g, (_: string, key: string) => encodeURIComponent(entry.params[key]))}`
        if (concrete !== path) continue
        const value = read(file)
        if (path === "/pgmq/metrics" && Array.isArray(value)) {
          const queue = value.find((row: any) => row.queue_name === "console_demo")
          if (queue) queue.queue_length = app === "orders" ? 101 : 202
        }
        return Response.json(value, { status: entry.status })
      }
      return Response.json(
        { error: { code: "not_found", message: `${app}: unknown fixture path` } },
        { status: 404 },
      )
    },
    websocket: {
      open(socket) {
        sockets.add(socket)
      },
      message(socket, message) {
        const frame = JSON.parse(String(message))
        journal.push({ method: "WS", path: socket.data.path, frame, worker: socket.data.worker })
        if (frame.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }))
          return
        }
        if (frame.type !== "subscribe" && frame.type !== "subscribe_all") return
        if (frame.feed === "workflows")
          socket.send(
            JSON.stringify({ type: "snapshot", feed: "workflows", sequence: 0, ...workflowPage() }),
          )
        else if (frame.feed === "timers")
          socket.send(
            JSON.stringify({
              type: "snapshot",
              feed: "timers",
              sequence: 0,
              ...read("keiro/timers-pending.json"),
            }),
          )
        else if (socket.data.path.startsWith("/shibuya"))
          socket.send(
            JSON.stringify({ type: "snapshot", metrics: workerMetrics(socket.data.worker) }),
          )
      },
      close(socket) {
        sockets.delete(socket)
      },
    },
  })
  servers.push(server)
  console.log(`${app} fixture: http://127.0.0.1:${port}`)
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    for (const server of servers) void server.stop(true)
    process.exit(0)
  })

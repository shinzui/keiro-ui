# Inspection API and WebSocket Conventions

This document defines the shared wire conventions for the inspection surfaces of the keiro
runtime stack: the HTTP and WebSocket endpoints that let an operator's browser see into an
application built on **keiro** (the event-sourcing framework), **kiroku** (the append-only
PostgreSQL event store), **shibuya** (supervised queue processing), and **pgmq-hs** (the
PostgreSQL-native work-queue client). The endpoints themselves are implemented in those four
repositories — each in the project that owns the concept it exposes — but they must compose
into one coherent UI. This document is the contract that makes four independently implemented
surfaces speak one dialect instead of four.

The audience is implementers in the four runtime repositories. Improvement requests filed from
the keiro-ui initiative cite this document as shared acceptance context; an endpoint added under
one of those requests conforms to every rule below unless the rule explicitly exempts it.

Two rules of interpretation apply throughout:

1. **New surfaces MUST follow these conventions.** "New" means any endpoint, field, frame, or
   package that does not exist in a published release today.
2. **Published wire shapes are frozen.** Where an existing surface (shibuya-metrics,
   kiroku-metrics) already deviates from a convention, the shipped shape wins and stays as it
   is. Convergence work is welcome only when it is purely additive; nothing in this document
   licenses a breaking change to a shipped protocol.

The durable decisions behind these conventions are recorded as Architecture Decision Records in
this repository's `docs/adr/` bundle, citable from any repository as
`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`.


## 1. Transport and packaging

Inspection surfaces are HTTP + JSON, served by an embeddable WAI `Application`. WAI (Web
Application Interface) is the standard Haskell interface between web servers and web
applications: a WAI `Application` is a plain value the host application can mount into any
WAI-compatible server such as Warp. "Embeddable" is the point — a library hands its host an
`Application` to mount rather than insisting on owning a process.

Each project ships its surface as a dedicated sister package, never inside the core library.
The live precedents are `shibuya-metrics` (Warp server, default port 9090) and `kiroku-metrics`
(Warp server, default port 9091): in both cases the core packages (`shibuya`, `kiroku-store`)
have no web dependencies at all, and adopting the library does not mean adopting a web server.
pgmq-hs and keiro, which have no HTTP surface today, follow the same pattern when they grow one
under their own plans: a new package (for example `pgmq-inspect` or `keiro-inspect` — final
names belong to the owning repositories) that depends on the core library, not the other way
around.

Every sister package must export two things:

1. A convenience runner that starts its own Warp server, with the host choosing the bind
   address and port (the existing defaults — shibuya 9090, kiroku 9091 — are defaults, not
   fixtures).
2. The bare WAI `Application` itself, so a host can mount several projects' surfaces in one
   process behind one port. This is how the composed deployment works: a keiro application
   mounts the kiroku surface, the shibuya surface, the pgmq surface, and its own keiro surface
   into a single server, and the browser sees one origin.


## 2. JSON field conventions

All new wire fields — request bodies, response bodies, WebSocket frames, query parameter names
where they mirror body fields — use `snake_case`. Both existing WebSocket dialects already use
snake_case `type` tags and message names (`subscribe_all`, `event_stream_started`,
`from_position`), so this codifies current practice rather than inventing it.

Existing published shapes are frozen regardless of casing. The canonical example implementers
must understand: kiroku's WebSocket event frames have a snake_case envelope but camelCase field
names inside the event payload object, and both halves stay exactly as shipped:

```json
{
  "type": "event",
  "event": {
    "eventId": "0198f2f3-8a9e-7c31-b1d4-2f6f0f4b9d21",
    "globalPosition": 4211,
    "eventType": "OrderPlaced",
    "data": { "orderId": "ord-7" }
  }
}
```

The envelope key `type` and the frame name `event` are snake_case; the payload keys `eventId`,
`globalPosition`, `eventType` are camelCase and published. "Frozen" beats "consistent": do not
file or accept a change that renames these fields to snake_case, and do not use their casing as
precedent for new fields elsewhere. A new field added to this same frame would be snake_case.


## 3. Pagination

Position-based reads use cursor pagination. The request takes two parameters:

- `from` — an exclusive cursor: the page starts strictly after this position. The cursor's
  representation is the domain's native position type (a global position integer for event
  stores, a message id for queues, whatever the owning project reads by).
- `limit` — the maximum number of items to return.

The response returns the page plus the cursor for the next page:

```json
{
  "items": [ { "...": "..." }, { "...": "..." } ],
  "next_cursor": 4211
}
```

When the returned page is the last one, `next_cursor` is omitted entirely — its absence is the
end-of-data signal. Clients request the next page by echoing `next_cursor` back as `from`.

Cursors are opaque to the UI. The UI echoes them back and never does arithmetic on them —
no adding `limit` to a cursor, no assuming contiguity, no fabricating cursors from item fields.
This mirrors kiroku's exclusive-cursor read API and keiro's global-position semantics, where
gaps and contiguity are implementation details the reader must not depend on.


## 4. Error envelope

New endpoints return errors as a structured object under a single `error` key, with an
appropriate HTTP status code:

```json
{
  "error": {
    "code": "stream_not_found",
    "message": "No stream named 'orders-42' exists in this store.",
    "details": { "stream_name": "orders-42" }
  }
}
```

- `code` is machine-readable snake_case, stable, and safe for the UI to switch on.
- `message` is a human sentence, safe for the UI to display verbatim, and free to change
  between releases.
- `details` is optional structured context; omit it when there is nothing useful to add.

Existing endpoints that return `{"error": "<string>"}` are published and therefore frozen; they
keep that shape. Error codes are per-project vocabularies: each project documents its codes
alongside its endpoints, and the UI must not assume a code from one project means anything on
another project's surface.


## 5. WebSocket protocol convention

Every WebSocket inspection endpoint speaks typed JSON frames: each frame is a JSON object with
a required `type` tag naming the frame kind. The convention is deliberately a superset shape
that both existing dialects already fit; new endpoints fit it too, and convergence work in the
existing servers may only ever be additive.

Client-to-server frames:

- Explicit **subscribe** and **unsubscribe** frames that name what is being watched. A
  connection watches nothing until it subscribes.
- `ping`, answered by `pong`.
- Where the watched domain has replayable positions, the subscribe frame accepts a
  `from_position` cursor so the client can replay from a known point before going live.

Server-to-client frames:

- An initial `snapshot` after a successful subscribe, carrying current state, so the client
  never renders from deltas alone.
- Incremental frames after the snapshot: `update` for state deltas (metrics-style surfaces),
  `event` for append-only feeds (log-tail-style surfaces).
- `pong` in reply to `ping`. Servers also ping idle connections themselves; the shipped
  precedent is a 30-second server-side ping interval.
- In-band `error` frames for per-connection faults — including queue overflow, see below —
  so the client learns what happened without parsing close codes.
- `goodbye` before any server-initiated close, so clients can distinguish a deliberate
  shutdown from a dropped connection.

Per-connection delivery queues are bounded, with drop-oldest overflow, and overflow must be
signaled in-band (an `error` frame telling the client it missed frames and should re-snapshot
or re-subscribe from a cursor). An unbounded queue lets one slow browser tab exhaust server
memory; silent dropping lets that tab render stale data as fresh.

The two shipped dialects, verbatim, which this convention is a superset of and which are frozen
as published:

**shibuya-metrics** (`shibuya-metrics/src/Shibuya/Metrics/Types.hs` in the shibuya repository,
endpoint `/ws`): the client sends `{"type":"subscribe_all"}`,
`{"type":"subscribe","processors":[...]}`, `{"type":"unsubscribe","processors":[...]}`, and
`{"type":"ping"}`; the server sends `{"type":"snapshot","metrics":{...}}`,
`{"type":"update","processor":...,"metrics":{...}}`, `{"type":"pong"}`, and
`{"type":"goodbye"}`. Deltas are pushed only when values change, by default every 100 ms.

**kiroku-metrics** (`kiroku-metrics/src/Kiroku/Metrics/WebSocket.hs` in the kiroku repository,
endpoint `/ws/events`): the client sends `{"type":"ping"}`, `{"type":"subscribe_metrics"}`,
`{"type":"subscribe_events","from_position":N,"category":"orders"}`, and
`{"type":"unsubscribe_events"}`; the server sends `pong`, `snapshot`, `event`,
`event_stream_started`, `goodbye`, and `error` frames. Event delivery uses a bounded
per-connection queue with drop-oldest overflow, signaled by an in-band `error` frame.

The dialects differ in frame names (`subscribe_all` versus `subscribe_metrics`, an
`event_stream_started` acknowledgement only in kiroku), and those differences ship as they are.
A new surface picks names consistent with its own domain but must keep the structural shape:
`type`-tagged frames, explicit subscribe/unsubscribe, snapshot-then-delta, ping/pong, in-band
errors with overflow signaling, `goodbye`, bounded queues, and replay cursors where the domain
has them.


## 6. Live updates: push is a hint, poll is truth

PostgreSQL NOTIFY/LISTEN is the stack's live-update substrate: kiroku's `kiroku.notify_events()`
trigger fires on channel `<schema>.events`, keiro's `Keiro.Wake` consumes that same mechanism,
and pgmq's `enable_notify_insert` sends throttled insert notifications. NOTIFY is best-effort
by design: a listener that is disconnected — even briefly, during a reconnect — misses
notifications permanently; throttling deliberately suppresses some of them; and payloads are
wake-up hints, not data carriers.

The cross-project rule: **every live endpoint must be backed by an authoritative poll/read
path, with push used only to shorten latency.** A WebSocket feed is a faster way to learn that
the authoritative read would return something new — it is never itself the source of truth. A
server that loses its LISTEN connection must fall back to polling and reconcile from the read
path when the connection returns; a client that misses frames (overflow, reconnect) must
recover by re-reading, not by hoping the stream was complete.

Each project already documents this independently — kiroku in `docs/architecture/notifier.md`
(dedicated LISTEN connection, reconnect with backoff, poll fallback), pgmq-hs in
`docs/design/015-notification-delivery-contract.md` (throttled, best-effort delivery), and
keiro in the `Keiro.Wake` design. This convention makes it a rule of the composed system: no
inspection surface may treat a NOTIFY-driven push as complete or ordered.


## 7. CORS

CORS (Cross-Origin Resource Sharing) is the browser mechanism that blocks a page served from
one origin from calling an HTTP API on another origin unless the API opts in via response
headers. No existing server in the stack sets CORS headers, so a browser app served from
anywhere other than the metrics server itself cannot call these APIs today.

New and extended servers must support configurable CORS:

- An explicit allowed-origins list, configured by the host application.
- Disabled by default: a server with no CORS configuration sends no CORS headers.
- No wildcard (`*`) origin when credentials (cookies, Authorization headers) are involved;
  the browser forbids that combination and the configuration API should make it
  unrepresentable.

There is an alternative that needs zero server changes: serve the UI and reverse-proxy all the
APIs from a single origin, so no cross-origin request ever happens. That deployment is
legitimate and worth documenting per project — but the configuration hook is still required,
because the composed UI will typically face several backends and not every deployment will put
a proxy in front of each one.


## 8. Authentication and authorization posture

No current surface has any authentication or authorization, and designing auth is explicitly
out of scope for this initiative. This section records the gap honestly rather than papering
over it.

The stated posture: inspection servers assume a trusted network, or an authenticating reverse
proxy deployed in front of them by the operator. Do not expose these servers to untrusted
networks bare. Improvement requests and endpoint implementations should restate this
assumption in their own documentation rather than implying safety that does not exist.

Read-only inspection is the baseline. Anything mutating — future control actions such as
pause/resume of processors, dead-letter-queue redrive, checkpoint reset — must be separately
gated and must follow the owning project's safety discipline. The named precedent is
keiro-ops's preview-then-`--force` model: a mutating command first shows what it would do and
requires an explicit second step to do it. An HTTP layer over such actions inherits that
discipline; it does not water it down to a bare POST.


## 9. Versioning and wire stability

A published wire shape is frozen. Concretely: fields are never removed and never re-typed;
frame names and their meanings never change; adding new optional fields or new frame types is
allowed; anything incompatible ships as a new path (or a new frame type), never as an in-place
mutation of the old one.

This extends to the HTTP layer the stability posture the stack already applies elsewhere —
frozen versioned SQL relations (the `kiroku.subscription_checkpoints_v1` pattern, per
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-6`) and PVP discipline on library APIs. Clients,
including the keiro-ui browser app, may rely on any shipped field continuing to exist and
continuing to mean what it meant; servers gain the freedom to add without coordinating a
lockstep upgrade.

Consequence for implementers: think before shipping, because shipping is forever. A field you
are unsure about is better exposed later than exposed now and regretted.


## 10. Vocabulary

Each project's surface keeps its own domain vocabulary; the conventions deliberately do not
impose a cross-project glossary on the wire.

On keiro surfaces, the reporting vocabulary mandated by
`mori://shinzui/keiro/okf/adrs/concepts/ADR-28` is binding: positions are reported as
`store_position` and `visible_store_head`, distance between them is a "global position
distance" — never "lag" and never "backlog". Those words imply a queue-consumption model that
does not match an event store's semantics, which is exactly why the ADR bans them.

Shibuya and kiroku surfaces keep their published metric names unchanged. pgmq-hs surfaces use
pgmq's own vocabulary (queues, messages, archive, visibility timeout).

The UI, not the endpoints, is responsible for any cross-surface terminology mapping it wants to
present. If keiro-ui decides to render kiroku's checkpoint distance and shibuya's queue depth
side by side under one label, that mapping lives in the UI's presentation layer; no project
renames its wire fields to make the UI's copywriting easier.


## How other repositories cite this document

Until keiro-ui exposes artifact-level Mori URIs for architecture documents, cite this document
as the canonical project URI plus the repository-relative path:

```text
mori://shinzui/keiro-ui — docs/architecture/inspection-api-conventions.md (artifact-level URI pending)
```

Do not cite it by bare filename or by another checkout's absolute path. The Architecture
Decision Records in this repository's `docs/adr/` bundle are citable now, individually, as
`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`.

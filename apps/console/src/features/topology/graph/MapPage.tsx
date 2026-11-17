import { parseTopologyNodeKey, topologyNodeKey, type TopologyIndex } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Input } from "@keiro-ui/ui/components/input"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { links } from "@/lib/links"

import { matchesText } from "../Inventory"
import { KIND_GROUP_IDS, KIND_GROUPS, type KindGroupId, kindGroupOf, kindLabel } from "../labels"
import { DiagramBoundary } from "./DiagramBoundary"
import { MAP_NODE_THRESHOLD, mapView, ServiceMap } from "./ServiceMap"

/** The `groups` search parameter as a list of known group ids; absent means all. */
export function parseGroups(value: string | undefined): KindGroupId[] {
  if (value === undefined) return [...KIND_GROUP_IDS]
  const wanted = new Set(value.split(",").map((part) => part.trim()))
  return KIND_GROUP_IDS.filter((id) => wanted.has(id))
}

const groupsParam = (groups: readonly KindGroupId[]) =>
  groups.length === KIND_GROUP_IDS.length ? undefined : groups.join(",")

const linkClass = "underline-offset-2 hover:underline"

/** The map and its controls. Every control is a URL search parameter, so a view is shareable. */
export function MapPage({
  index,
  groups: groupsValue,
  focus,
  depth,
}: {
  index: TopologyIndex
  groups: string | undefined
  focus: string | undefined
  depth: 1 | 2 | undefined
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const groups = parseGroups(groupsValue)
  const focusNode = focus ? index.node(focus) : undefined
  const reach = depth ?? 1
  const view = mapView(index, { groups, focus, depth: reach })
  const tooLarge = view.nodes.length > MAP_NODE_THRESHOLD
  // Depth describes a focus, so it is dropped with it.
  const search = (next: {
    groups?: readonly KindGroupId[]
    focus?: string | null
    depth?: 1 | 2
  }) => {
    const nextFocus =
      next.focus === null ? undefined : (next.focus ?? (focusNode ? focus : undefined))
    return links.topologyMap({
      groups: groupsParam(next.groups ?? groups),
      focus: nextFocus,
      depth: nextFocus !== undefined && (next.depth ?? reach) === 2 ? 2 : undefined,
    })
  }
  const matches = query.trim()
    ? index.document.nodes.filter((node) => matchesText(node, query)).slice(0, 12)
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <nav aria-label="Kind groups drawn" className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Groups</span>
          {KIND_GROUPS.map((group) => {
            const on = groups.includes(group.id)
            const count = index.document.nodes.filter(
              (node) => kindGroupOf(node.kind).id === group.id,
            ).length
            const next = on ? groups.filter((id) => id !== group.id) : [...groups, group.id]
            return (
              <Link
                key={group.id}
                {...search({ groups: KIND_GROUP_IDS.filter((id) => next.includes(id)) })}
                data-selected={on}
                aria-label={`${on ? "Hide" : "Show"} ${group.label} (${count} declarations)`}
              >
                <Badge variant={on ? "default" : "outline"}>
                  {group.label} {count}
                </Badge>
              </Link>
            )
          })}
          {groups.length !== KIND_GROUP_IDS.length && (
            <Link {...search({ groups: KIND_GROUP_IDS })} className={`text-xs ${linkClass}`}>
              Show all groups
            </Link>
          )}
        </nav>
        {focusNode ? (
          <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="map-focus">
            <span>
              Focused on <span className="text-muted-foreground">{kindLabel(focusNode.kind)}</span>{" "}
              <Link
                {...links.topologyNode(focusNode.kind, focusNode.name)}
                className={`font-medium ${linkClass}`}
              >
                {focusNode.name}
              </Link>
              : declarations within
            </span>
            {([1, 2] as const).map((value) => (
              <Link key={value} {...search({ depth: value })} data-selected={reach === value}>
                <Badge variant={reach === value ? "default" : "outline"}>
                  {value} {value === 1 ? "relation" : "relations"}
                </Badge>
              </Link>
            ))}
            <Link {...search({ focus: null })} className={linkClass}>
              Show the whole service
            </Link>
          </p>
        ) : (
          focus !== undefined && (
            <p className="text-sm" data-testid="map-focus-unknown">
              The mounted document has no declaration{" "}
              <code className="font-mono text-xs">{focus}</code>, so the focus is ignored.{" "}
              <Link {...search({ focus: null })} className={linkClass}>
                Clear it
              </Link>
            </p>
          )
        )}
      </div>

      {tooLarge ? (
        <div className="flex max-w-2xl flex-col gap-3" data-testid="map-too-large">
          <p className="text-sm">
            This view has {view.nodes.length} declarations, more than the {MAP_NODE_THRESHOLD} the
            map draws at once: a drawing that large is slow to read. Nothing is hidden from the{" "}
            <Link {...links.topology()} className={linkClass}>
              declarations list
            </Link>
            . Start from one kind group or one declaration.
          </p>
          <ul aria-label="Start from a kind group" className="flex flex-wrap gap-1.5">
            {KIND_GROUPS.map((group) => {
              const count = index.document.nodes.filter(
                (node) => kindGroupOf(node.kind).id === group.id,
              ).length
              if (count === 0) return null
              return (
                <li key={group.id}>
                  <Link {...search({ groups: [group.id], focus: null })}>
                    <Badge variant="outline">
                      Only {group.label} {count}
                    </Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Input
            aria-label="Find a declaration to focus on"
            placeholder="Find a declaration to focus on"
            className="max-w-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query.trim() !== "" && (
            <ul aria-label="Matching declarations" className="flex flex-col gap-1 text-sm">
              {matches.length === 0 && <li>No declaration matches.</li>}
              {matches.map((node) => (
                <li key={topologyNodeKey(node.kind, node.name)}>
                  <span className="text-muted-foreground">{kindLabel(node.kind)}</span>{" "}
                  <Link
                    {...search({
                      focus: topologyNodeKey(node.kind, node.name),
                      groups: KIND_GROUP_IDS,
                    })}
                    className={`font-medium ${linkClass}`}
                  >
                    {node.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <DiagramBoundary
          key={`${groups.join(",")}|${focus ?? ""}|${reach}`}
          testId="map-failed"
          fallback="The map could not be drawn. The declarations list and each declaration's page carry the same information."
        >
          <ServiceMap
            index={index}
            groups={groups}
            focus={focus}
            depth={reach}
            maxHeight={720}
            onFocus={(key) => {
              if (parseTopologyNodeKey(key)) void navigate(search({ focus: key }) as never)
            }}
          />
        </DiagramBoundary>
      )}
    </div>
  )
}

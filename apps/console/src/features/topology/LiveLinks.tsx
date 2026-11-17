import { type TopologyNode, workflowDetails } from "@keiro-ui/client-keiro"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { AppLink } from "@/components/app-link"
import { useAggregateTypes } from "@/features/aggregates/queries"
import { useProcessManagerTypes } from "@/features/process-managers/queries"
import { WorkflowCountsSummary } from "@/features/workflows/components/WorkflowCountsSummary"
import { hrefOf, links } from "@/lib/links"

import {
  aggregateJoin,
  catalogueOf,
  type LiveJoin,
  processJoin,
  projectionOwnerJoin,
  unjoinableReason,
  workflowJoin,
} from "./joins"
import { describeFailure } from "./queries"

const code = (text: string) => <code className="font-mono text-xs">{text}</code>

/** What each kind's join is checked against, for the reasons below. */
const SUBJECT = {
  aggregate: {
    thing: "mounted aggregate type",
    named: "is named",
    probe: "/keiro/aggregate/types",
  },
  process: {
    thing: "mounted process manager",
    named: "has the category",
    probe: "/keiro/pm/types",
  },
} as const

function JoinView({ join, kind }: { join: LiveJoin; kind: TopologyNode["kind"] }) {
  const subject = kind === "process" ? SUBJECT.process : SUBJECT.aggregate
  switch (join.status) {
    case "linked":
      return (
        <p className="text-sm" data-testid="live-linked">
          <AppLink href={hrefOf(join.target)} className="font-medium underline underline-offset-2">
            {join.label}
          </AppLink>
          <span className="block text-xs text-muted-foreground">{join.caveat}</span>
        </p>
      )
    case "no-field":
      return (
        <p className="text-sm" data-testid="live-no-field">
          No link: this document does not carry {code(`details.${join.field}`)} for the declaration.
          Documents written by older keiro-dsl versions lack it; regenerating the committed document
          adds it.
        </p>
      )
    case "inline":
      return (
        <p className="text-sm" data-testid="live-inline">
          No subscription to open: this owner is delivered inline, in the transaction that appends
          the events, so it has no durable subscription and no checkpoint of its own.
        </p>
      )
    case "not-mounted":
      return (
        <p className="text-sm" data-testid="live-not-mounted">
          Cannot link: this keiro host does not mount the inspection hooks that list its{" "}
          {subject.thing}s. The console probed {code(subject.probe)} and the host refused the
          command. That says nothing about whether the declaration is running.
        </p>
      )
    case "no-match":
      return (
        <p className="text-sm" data-testid="live-no-match">
          No {subject.thing} {subject.named} {code(join.value)}, the value this declaration joins
          by. The document describes a committed specification; the host may run another build or
          another service.
        </p>
      )
    case "ambiguous":
      return (
        <p className="text-sm" data-testid="live-ambiguous">
          No single link: {join.names.length} mounted process managers share the category{" "}
          {code(join.value)}, so the console does not choose one:{" "}
          {join.names.map((name, i) => (
            <span key={name}>
              {i > 0 && ", "}
              <Link {...links.processManager(name)} className="underline underline-offset-2">
                {name}
              </Link>
            </span>
          ))}
          .
        </p>
      )
    case "pending":
      return (
        <p className="text-sm text-muted-foreground" data-testid="live-pending">
          Reading what the host mounts…
        </p>
      )
    case "failed": {
      const failure = describeFailure(join.error)
      return (
        <p className="text-sm" data-testid="live-failed">
          Could not read what the host mounts, so there is no link:{" "}
          {failure.code && <>{code(failure.code)} </>}
          {failure.message}
        </p>
      )
    }
  }
}

function Section({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Live" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Live</h2>
      {children}
    </section>
  )
}

// One component per kind, so a declaration's page reads only the catalogue its own join needs.

function AggregateLive({ node }: { node: TopologyNode }) {
  const types = useAggregateTypes()
  return <JoinView join={aggregateJoin(node, catalogueOf(types))} kind={node.kind} />
}

function ProcessLive({ node }: { node: TopologyNode }) {
  const types = useProcessManagerTypes()
  return <JoinView join={processJoin(node, catalogueOf(types))} kind={node.kind} />
}

function WorkflowLive({ node }: { node: TopologyNode }) {
  const join = workflowJoin(node)
  const name = join.status === "linked" ? workflowDetails(node)?.stableName : undefined
  return (
    <>
      <JoinView join={join} kind={node.kind} />
      {name !== undefined && <WorkflowCountsSummary workflowName={name} />}
    </>
  )
}

/**
 * Where a declaration can be seen running. A link appears only through a join keiro
 * guarantees; otherwise the section says exactly why there is none. Kinds with no live
 * counterpart render nothing.
 */
export function LiveLinks({ node }: { node: TopologyNode }) {
  const reason = unjoinableReason(node.kind)
  if (reason)
    return (
      <Section>
        <p className="text-sm" data-testid="live-unjoinable">
          {reason}
        </p>
      </Section>
    )
  switch (node.kind) {
    case "aggregate":
      return (
        <Section>
          <AggregateLive node={node} />
        </Section>
      )
    case "process":
      return (
        <Section>
          <ProcessLive node={node} />
        </Section>
      )
    case "workflow":
      return (
        <Section>
          <WorkflowLive node={node} />
        </Section>
      )
    case "projection-owner":
      return (
        <Section>
          <JoinView join={projectionOwnerJoin(node)} kind={node.kind} />
        </Section>
      )
    default:
      return null
  }
}

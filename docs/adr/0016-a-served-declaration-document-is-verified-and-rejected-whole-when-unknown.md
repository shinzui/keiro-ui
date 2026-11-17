---
type: Architecture Decision Record
title: A served declaration document is verified and rejected whole when unknown
description: The console uses a declaration document a host serves only after hashing the exact bytes it received to the digest the host advertised, rejects it whole when its schema id, a node kind or a relation is unknown, and treats it as a statement about a committed specification, never as runtime state.
docId: ADR-16
status: Accepted
date: 2026-11-17
timestamp: 2026-11-17T22:15:00Z
generated:
  by: claude-code/claude-fable-5-2
  at: 2026-11-17T22:15:00Z
---

# A served declaration document is verified and rejected whole when unknown

## Context

Every other read the console makes returns runtime state: rows the host computed for that
request. The keiro service topology is different. It is one JSON document that `keiro-dsl
topology` writes from a service's specification, which the service commits and a keiro
inspection host mounts and serves unchanged at `/topology/show`, with a small header at
`/topology/summary` that names the document's schema id and the SHA-256 digest of its bytes.
The contract is `mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`.

Three properties of such a document are new to the console.

It is fetched in two requests, and a deployment can change between them, so the header and
the document can describe different files.

It is a versioned public contract. The upstream policy,
`mori://shinzui/keiro/okf/adrs/concepts/ADR-62`, lets keiro add object fields within a schema
id and requires a new schema id for a new node kind, a new relation or a changed meaning. A
consumer must ignore fields it does not know and must reject a document whose schema id, node
kind or relation it does not know, rather than drop what it cannot read. Dropping an unknown
relation would show an operator a service with edges missing and nothing to say so.

It describes the committed specification, not the running binary. The host never checks that
the document matches the code it runs, and the local stack deliberately mounts a document
about another service.

The console has no server of its own ([ADR-5](0005-no-backend-for-frontend.md)), so all of
this happens in the browser.

## Decision

The keiro client (`packages/client-keiro/src/topology.ts`, `client.topology`) is the only
place a served declaration document is read, and it applies four rules.

1. **Verify the bytes received.** The document is read through `HttpClient.getRaw`, which
   returns the response body's exact bytes. The client hashes those bytes and uses the
   document only when the digest equals the `document_sha256` of the summary read just
   before. It never hashes re-encoded text: decoding drops a byte-order mark and replaces
   invalid sequences, so re-encoding does not reproduce what the host hashed. The hash is a
   pure SHA-256 (`@noble/hashes`) in every context, because `crypto.subtle` does not exist
   when the static bundle is served over plain HTTP.

2. **Read in the order summary, then document, once per digest.** The summary is the mount
   probe and carries the schema id and the digest. A schema id the client does not know is
   refused before the document is requested. A verified document is kept by digest in the
   client instance, which belongs to one connection session
   ([ADR-15](0015-target-identity-and-disposable-connection-sessions.md)), so later reads
   cost one summary request and nothing crosses deployments. When the digests disagree the
   pair is read once more; a second disagreement is reported as a deployment that is
   changing, and nothing is shown.

3. **Reject whole, never in part.** The schema id is checked first. Then every node kind,
   every edge endpoint kind and every relation must belong to that schema id's vocabulary,
   each (`kind`, `name`) pair must be unique, and every edge endpoint must name a node. Any
   failure rejects the document and the console shows nothing from it, with a typed error
   naming the first offence. Everything else is loose: unknown object fields pass through,
   and a node's `details` is an open record with typed views applied on demand that answer
   "does not match" instead of failing.

4. **A declaration is not runtime state.** Screens present the document as what the
   specification declares. They never present it as what the host is running, never infer
   freshness, and show disagreement they can observe between the document and the host
   instead of hiding it.

A host that mounts no document and a host too old to know the route refuse the command the
same way, so the client reports one state, `RouteUnavailable`, and the console says the host
serves no topology without guessing which ([ADR-13](0013-honest-gates.md)).

## Consequences

A console released before keiro adds a schema id shows "this console does not understand
schema X" for such a document until the console is updated. That is intended: the
alternative is a partial picture presented as complete.

Adding support for a new schema id, node kind or relation is a change to the vocabulary
constants in `packages/client-keiro/src/topology.ts` together with the screens that label
them, never a relaxation of the checks.

Hashing and validating cost one pass over a document of tens of kilobytes per digest, in the
browser. The byte-exact read is a second code path in the shared HTTP client, kept small by
sharing everything but body handling with ordinary reads.

Tests that exercise verification need exact bytes. keiro's golden documents are copied
unchanged into `packages/testing/topology/`, excluded from formatting, and pinned by digest.

The same rules apply to any future document a host serves as a committed declaration.

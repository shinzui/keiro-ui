import { HttpResponse } from "msw"

import meta from "../fixtures/_meta.json"
import keiroManifest from "../manifests/keiro.json"
import kirokuManifest from "../manifests/kiroku.json"
import pgmqManifest from "../manifests/pgmq.json"
import shibuyaManifest from "../manifests/shibuya.json"
import type { FileMeta, Manifest, MetaFile, Surface } from "./types"

// Vite (the console's dev server and vitest) inlines every fixture as raw text, so the same
// handlers run in Node and in the browser worker.
const rawFiles = import.meta.glob("../fixtures/**/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export const fixtureMeta = meta as MetaFile

export const manifests: Record<Surface, Manifest> = {
  kiroku: kirokuManifest as Manifest,
  pgmq: pgmqManifest as Manifest,
  shibuya: shibuyaManifest as Manifest,
  keiro: keiroManifest as Manifest,
}

/** The raw body of `fixtures/<relative>` ("kiroku/streams.json"). */
export function fixtureText(relative: string): string {
  const text = rawFiles[`../fixtures/${relative}`]
  if (text === undefined) throw new Error(`no fixture ${relative}`)
  return text
}

export function hasFixture(relative: string): boolean {
  return rawFiles[`../fixtures/${relative}`] !== undefined
}

export function fileMeta(relative: string): FileMeta {
  const entry = fixtureMeta.files[relative]
  if (!entry) throw new Error(`no _meta.json entry for ${relative}`)
  return entry
}

export function rawResponse(
  body: string,
  status: number,
  contentType = "application/json",
): HttpResponse<string> {
  return new HttpResponse(body, { status, headers: { "content-type": contentType } })
}

/** The recorded response, status and content type included, exactly as recorded. */
export function fixtureResponse(relative: string): HttpResponse<string> {
  const entry = fileMeta(relative)
  return rawResponse(fixtureText(relative), entry.status, entry.contentType)
}

/** Every fixture file of a surface, keyed by relative path. */
export function surfaceFiles(surface: Surface): [string, FileMeta][] {
  return Object.entries(fixtureMeta.files).filter(([, entry]) => entry.surface === surface)
}

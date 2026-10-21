---
type: Navigation
title: keiro runtime console documentation
description: Where to start reading about the keiro runtime console, by what you are trying to do.
docId: DOC-1
tags: [console, navigation, overview]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:30:00Z
---

# keiro runtime console documentation

The keiro runtime console is a browser application for operating systems built on keiro,
kiroku, shibuya, and pgmq-hs. It is a static bundle that talks to each project's own
inspection endpoints directly; there is no backend of its own.

| If you want to…                                         | Read                                         |
| ------------------------------------------------------- | -------------------------------------------- |
| see the console working on your machine                 | [Getting started](getting-started.md)        |
| look up a screen, a URL, a shortcut, or a profile field | [Console reference](console-reference.md)    |
| serve the console in front of real inspection servers   | [Deploying the console](deployment.md)       |

What the console provides today, one record per capability with the tests that prove it, is
the capability catalog in `docs/capabilities/`. The decisions behind its shape are the
architecture decision records in `docs/adr/`.

# CLAUDE.md — Constello

Project context for Claude Code. Read this first, then `BUILD_PLAN.md` and `CONSTELLO_PHILOSOPHY.md`.

## What this is

Constello reads what a person carries *underneath* the things they gather — not the surface material. Every reading (Node, synthesis, pairwise) must reach for the fundamental thing the person carries, never describe the surface artifact.

## Where things live

- Build spec & plan: `BUILD_PLAN.md`, `CONSTELLO_BUILD.md`
- Philosophy: `CONSTELLO_PHILOSOPHY.md`, plus essays in `obsidian vault/`
- Credentials checklist: `CREDENTIALS.md`
- Web prototype: `apps/web/` (Next.js — text adapter §6.5, essence synthesis §7)
- Visual prototypes: `ui/`

## Working norms

- **Plan before action.** Produce a written plan + decisions checklist before scaffolding code.
- **Spec docs are editable.** The philosophy/build docs are Claude-authored — edit directly when warranted.
- **Defer defensive infrastructure.** No PII filters, content moderation, or abuse prevention until the algorithm reads true. Don't build for problems before there's something made.
- **Visual identity emulates constellations, not a literal night sky.** Stars = bright nodes of meaning, luminous in every theme. Gentle dark (never black); white stars always.

## Setup

App env comes from repo-root `.env.local`. Run: `cd apps/web && npm install && npm run dev`.

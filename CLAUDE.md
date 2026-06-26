# CLAUDE.md — Constello

Project context for Claude Code. Read this first, then `BUILD_PLAN.md` and `CONSTELLO_PHILOSOPHY.md`.

## What this is

A person's collections are the trace of a world they're building. Constello reads that world — the organizing principle behind why *these* things and not others — never the surface artifact. Recognition is when two worlds realize they exist in the same place — "hey, ure the same as me." Readings stay neutral and let depth emerge; they are not commanded to reach for it.

## Where things live

- Build spec & plan: `BUILD_PLAN.md`, `CONSTELLO_BUILD.md`
- Philosophy: `CONSTELLO_PHILOSOPHY.md`, plus essays in `obsidian vault/`
- Credentials checklist: `CREDENTIALS.md`
- Web prototype: `apps/web/` (Next.js — text adapter §6.5, essence synthesis §7)
- Visual prototypes: `ui/`

## Working norms
- **Conceptual / design work (not coding):** read `obsidian vault/CORE.md` + `INDEX.md` *first* — they carry the working discipline (no tokens/slogans, preserve Ethan's words verbatim, idea-docs + connecting-docs not territories). Riff only after loading them.
- **Plan before action.** Produce a written plan + decisions checklist before scaffolding code.
- **Spec docs are editable.** The philosophy/build docs are Claude-authored — edit directly when warranted.
- **Defer defensive infrastructure.** No PII filters, content moderation, or abuse prevention until the algorithm reads true. Don't build for problems before there's something made.
- **Visual identity emulates constellations, not a literal night sky.** Stars = bright nodes of meaning, luminous in every theme. Gentle dark (never black); white stars always.

## Setup

App env comes from repo-root `.env.local`. Run: `cd apps/web && npm install && npm run dev`.

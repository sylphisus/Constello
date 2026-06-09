# Constello

Prototype + spec for Constello — a system that reads what a person carries *underneath* the things they gather, not the surface material itself.

> **Private repo.** `.env.local` with live keys is committed for convenience. These keys are rotatable and not load-bearing. **Rotate before this repo is ever made public or shared.**

## Layout

| Path | What it is |
|------|------------|
| `apps/web/` | Next.js prototype — general text adapter (§6.5) + essence synthesis (§7) |
| `ui/` | Standalone HTML visual prototypes (`index.html`, `mobile.html`, `sky-three.html`) |
| `BUILD_PLAN.md` | Phased build plan, decisions (D1…), milestones (1.1…) |
| `CONSTELLO_BUILD.md` | Full build spec |
| `CONSTELLO_PHILOSOPHY.md` | Design philosophy driving the build |
| `CREDENTIALS.md` | Credentials & inputs checklist (companion to BUILD_PLAN) |
| `obsidian vault/` | Origin notes & design-philosophy essays (from the Obsidian vault) |
| `.claude/` | Local launch config |

## Run the web app

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
```

Env vars are read from the repo-root `.env.local` (already present). If you cloned fresh and it's missing, copy `.env.example` to `.env.local` and fill it in.

## For Claude Code

Start by reading `BUILD_PLAN.md` and `CONSTELLO_PHILOSOPHY.md`. The readings must reach for what the person carries underneath the material — never describe the surface.

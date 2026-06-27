// Post-install patch for the Quartz graph plugin (github:quartz-community/graph).
//
// Why: INDEX.md and CORE.md are navigational hubs that wikilink to every doc, so
// the published graph at docs.constello.xyz renders as a hub-and-spoke web instead
// of a constellation of real doc-to-doc links. This drops those two nodes (and
// their edges) from the graph while keeping the pages published.
//
// We patch the installed plugin's minified bundle rather than forking the plugin,
// because the fork's dist/ is gitignored and the lockfile records machine-absolute
// local paths — both break on Vercel. The graph plugin is pinned by commit in
// quartz.lock.json, so the minified strings below are deterministic. If upstream
// changes and the target is no longer found, this script exits non-zero so the
// build fails loudly instead of silently shipping the unfiltered graph.
//
// Runs in vercel.json between `quartz plugin install` and `quartz build`.

import fs from "node:fs"
import path from "node:path"

const PLUGIN_DIR = ".quartz/plugins/graph/dist"
// Both files embed the same client script; dist/components/index.js is the one
// Quartz actually bundles, dist/index.js is patched too for consistency.
const TARGETS = ["index.js", "components/index.js"]

const FIND = "for(var Ju in Ku)eu.set(Fu(Ju),Ku[Ju])"
const REPLACE =
  'for(var Ju in Ku){var __qz=Fu(Ju);if(__qz==="index"||__qz==="core")continue;eu.set(__qz,Ku[Ju])}'
// Marker proving the patch is present (covers already-patched re-runs).
const MARKER = '__qz==="index"||__qz==="core"'

let patchedAny = false

for (const rel of TARGETS) {
  const file = path.join(PLUGIN_DIR, rel)
  if (!fs.existsSync(file)) {
    console.error(`[patch-graph] expected file missing: ${file}`)
    process.exit(1)
  }
  let src = fs.readFileSync(file, "utf8")
  if (src.includes(MARKER)) {
    console.log(`[patch-graph] ${rel} already patched`)
    patchedAny = true
    continue
  }
  if (!src.includes(FIND)) {
    console.error(
      `[patch-graph] target string not found in ${rel}; upstream graph plugin changed. ` +
        `Update FIND/REPLACE in scripts/patch-graph.mjs.`,
    )
    process.exit(1)
  }
  src = src.replace(FIND, REPLACE)
  fs.writeFileSync(file, src)
  console.log(`[patch-graph] patched ${rel}`)
  patchedAny = true
}

if (!patchedAny) {
  console.error("[patch-graph] nothing patched")
  process.exit(1)
}
console.log("[patch-graph] graph hub nodes (index, core) excluded ✓")

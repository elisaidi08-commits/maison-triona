#!/usr/bin/env bash
# Hook PreToolUse (Write|Edit|MultiEdit) — Maison Triona
# Tant que le fichier .claude/PHASE contient « 0 », n'autorise l'écriture que dans
# docs/, .claude/ et CLAUDE.md (règle d'or n° 1). Passer .claude/PHASE à « 1 » au GO PHASE 1.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-.}"
phase=$(cat "$root/.claude/PHASE" 2>/dev/null || echo "1")
[ "$(echo "$phase" | tr -d '[:space:]')" = "0" ] || exit 0

ROOT="$root" node -e '
let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  const file = String((JSON.parse(raw).tool_input || {}).file_path || "");
  const root = process.env.ROOT.replace(/\/$/, "");
  const rel = file.startsWith(root + "/") ? file.slice(root.length + 1) : file;
  const allowed = rel === "CLAUDE.md" || rel.startsWith("docs/") || rel.startsWith(".claude/");
  if (!allowed) {
    console.error(`Bloqué : phase 0 en cours, écriture limitée à docs/, .claude/ et CLAUDE.md (fichier visé : ${rel}). Attendre « GO PHASE 1 ».`);
    process.exit(2);
  }
});
'

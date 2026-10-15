#!/usr/bin/env bash
# Hook PreToolUse (Bash, si la commande est un git commit) — Maison Triona
# Lance lint + typecheck avant chaque commit fait par Claude ; bloque si l'un échoue.
set -euo pipefail

command=$(node -e 'let r="";process.stdin.on("data",d=>r+=d).on("end",()=>{process.stdout.write(String((JSON.parse(r).tool_input||{}).command||""))})')

case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}"

# Avant la story 1.1, il n'y a pas encore de scripts npm : rien à vérifier
if [ ! -f package.json ]; then
  exit 0
fi

if ! npm run --silent lint >/tmp/maison-triona-lint.log 2>&1; then
  echo "Bloqué : npm run lint échoue. Corriger avant de committer (extrait ci-dessous)." >&2
  tail -n 20 /tmp/maison-triona-lint.log >&2
  exit 2
fi

if ! npm run --silent typecheck >/tmp/maison-triona-typecheck.log 2>&1; then
  echo "Bloqué : npm run typecheck échoue. Corriger avant de committer (extrait ci-dessous)." >&2
  tail -n 20 /tmp/maison-triona-typecheck.log >&2
  exit 2
fi

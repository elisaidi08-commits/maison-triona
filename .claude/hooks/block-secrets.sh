#!/usr/bin/env bash
# Hook PreToolUse (Write|Edit|MultiEdit) — Maison Triona
# Bloque l'écriture d'un fichier .env réel et de tout contenu qui ressemble à un secret.
# Entrée : JSON du hook sur stdin. Sortie : code 2 + message sur stderr pour bloquer.
set -euo pipefail

node -e '
let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  const input = JSON.parse(raw).tool_input || {};
  const file = String(input.file_path || "");
  const base = file.split("/").pop();
  const text = [input.content, input.new_string, ...(input.edits || []).map((e) => e.new_string)]
    .filter(Boolean)
    .join("\n");

  // Les secrets réels sont saisis à la main par Sady ; seul .env.example est versionné
  if (/^\.env(\..+)?$/.test(base) && base !== ".env.example") {
    console.error(`Bloqué : ${base} est réservé aux secrets réels. Sady le renseigne à la main ; seul .env.example est versionné.`);
    process.exit(2);
  }

  const patterns = [
    [/\bre_[A-Za-z0-9_]{20,}/, "clé Resend"],
    [/\bsk_(live|test)_[A-Za-z0-9]{16,}/, "clé secrète"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "clé privée"],
    [/\b(AKIA|ASIA)[A-Z0-9]{16}\b/, "clé AWS"],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "jeton GitHub"],
    [/\bsk[A-Za-z0-9]{40,}\b/, "jeton (Sanity ou autre)"],
    [/(api[_-]?key|secret|token|password)\s*[:=]\s*["\x27][^"\x27\s]{12,}["\x27]/i, "secret en clair"],
  ];
  const hit = patterns.find(([re]) => re.test(text));
  if (hit) {
    console.error(`Bloqué : ${hit[1]} détecté dans ${base}. Utiliser une variable d environnement (process.env) et la documenter dans .env.example sans valeur.`);
    process.exit(2);
  }
});
'

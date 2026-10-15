#!/usr/bin/env bash
# Hook PreToolUse (Write|Edit|MultiEdit) — Maison Triona
# Bloque l'ajout de scripts, polices, pixels ou intégrations tiers dans le code du site.
# Discrétion : aucun tracker, aucun réseau social, aucun appel réseau tiers depuis le navigateur.
set -euo pipefail

node -e '
let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  const input = JSON.parse(raw).tool_input || {};
  const file = String(input.file_path || "");
  // Seul le code livré au navigateur est contrôlé (pas docs/ ni .claude/)
  if (!/\/(src|public|app|messages)\/|\/next\.config\.[cm]?[jt]s$/.test(file)) process.exit(0);

  const text = [input.content, input.new_string, ...(input.edits || []).map((e) => e.new_string)]
    .filter(Boolean)
    .join("\n");

  const forbidden = [
    "googletagmanager.com", "google-analytics.com", "gtag(", "fonts.googleapis.com", "fonts.gstatic.com",
    "connect.facebook.net", "fbq(", "facebook.com/tr", "hotjar", "clarity.ms", "analytics.tiktok.com",
    "snap.licdn.com", "platform.twitter.com", "ads-twitter.com", "instagram.com/embed", "youtube.com/embed",
    "player.vimeo.com", "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com", "recaptcha", "hcaptcha",
  ];
  const hit = forbidden.find((d) => text.includes(d));
  if (hit) {
    console.error(`Bloqué : « ${hit} » dans ${file.split("/").pop()}. Le site ne charge aucune ressource tierce (polices via next/font, analytics via notre domaine). Voir CLAUDE.md § Discrétion.`);
    process.exit(2);
  }

  // Moodboard : référence de style interne, jamais dans le code ni dans public/ (brief assets §1)
  const moodboard = ["cosmos_", "docs/moodboard", "MOODBOARD PHOTO", "ASSETS PHOTO MAQUETTE", "unsplash.jpg"].find((m) => text.includes(m));
  if (moodboard) {
    console.error(`Bloqué : référence au moodboard (« ${moodboard} ») dans ${file.split("/").pop()}. Le moodboard ne sort jamais de docs/ : utiliser les assets générés de public/media/.`);
    process.exit(2);
  }

  // Plausible n est autorisé que comme destination de réécriture côté serveur (next.config)
  if (text.includes("plausible.io") && !/next\.config\.[cm]?[jt]s$/.test(file)) {
    console.error("Bloqué : Plausible doit être servi via notre domaine (réécriture dans next.config), jamais appelé directement depuis le navigateur.");
    process.exit(2);
  }
});
'

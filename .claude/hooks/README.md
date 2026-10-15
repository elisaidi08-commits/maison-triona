# Hooks proposés — Maison Triona (NON ACTIVÉS)

Ces scripts sont **inertes** : aucun fichier `.claude/settings.json` ne les référence. Ils ne s'exécutent qu'après une activation explicite décidée par Sady.

## Ce qu'ils font

| Script | Événement | Effet | Testé (15/10/2026) |
|---|---|---|---|
| `phase-guard.sh` | Avant Write / Edit | Si `.claude/PHASE` contient `0` : écriture autorisée seulement dans `docs/`, `.claude/`, `CLAUDE.md` (règle d'or n° 1). Sans fichier `PHASE` ou avec `1` : aucun effet. | 4 cas ✅ |
| `block-secrets.sh` | Avant Write / Edit | Refuse d'écrire un `.env` réel (seul `.env.example` passe) et tout motif de secret (clés Resend, privées, AWS, GitHub, Sanity, `apiKey = "…"`). | 5 cas ✅ |
| `block-third-party.sh` | Avant Write / Edit dans `src/`, `public/`, `app/`, `messages/`, `next.config.*` | Refuse Google Fonts, gtag, pixels Meta, Hotjar, Clarity, TikTok, LinkedIn, X, embeds Instagram / YouTube / Vimeo, CDN publics, captchas, et **toute référence au moodboard** (`cosmos_`, `docs/moodboard`, dossiers sources, Unsplash) ; Plausible autorisé **seulement** comme réécriture dans `next.config`. | 11 cas ✅ |
| `pre-commit-quality.sh` | Avant une commande `git commit` | Lance `npm run lint` puis `npm run typecheck` ; bloque si l'un échoue. Sans `package.json` (avant la story 1.1) : aucun effet. | 3 cas ✅ |

Tous lisent le JSON du hook avec `node` (pas besoin de `jq`) et bloquent par **code de sortie 2** avec un message explicatif, que Claude voit et peut corriger.

## Activer (quand Sady le décide)

```bash
cd "<racine du projet>"
chmod +x .claude/hooks/*.sh
# Créer .claude/settings.json à partir de settings.snippet.json (ou fusionner s'il existe déjà)
cp .claude/hooks/settings.snippet.json .claude/settings.json
# Optionnel, pour verrouiller la phase 0 :
echo 0 > .claude/PHASE      # puis « echo 1 > .claude/PHASE » au GO PHASE 1
```

Puis relancer Claude Code et vérifier avec `/hooks` que les quatre hooks apparaissent. Les hooks de projet ne s'exécutent qu'une fois le dossier marqué comme « de confiance ».

## Limites connues

- `block-secrets.sh` détecte des **motifs** : il réduit le risque, il ne remplace pas une revue (`security-privacy-reviewer`) ni un scanner de secrets en CI.
- `block-third-party.sh` contrôle ce que Claude écrit, pas une dépendance npm qui chargerait un script tiers : le script `check:third-party` de la CI (story 1.1) couvre le HTML produit.
- Le champ `if` des hooks Bash est appliqué « au mieux » par Claude Code ; le script revérifie donc lui-même que la commande est un `git commit`.
- Les règles `permissions.deny` du fragment empêchent Claude de **lire** les fichiers de secrets réels et de forcer un push ; elles ne restreignent rien d'autre.

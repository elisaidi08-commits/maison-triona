# Préproduction protégée — mode d'emploi (story 1.5)

> **Statut** (15/10/2026) : la partie **code** est faite (en-tête `X-Robots-Tag: noindex, nofollow` sur tout ce qui n'est pas la production Vercel, testé). La partie **Vercel** demande le compte de Sady : le dépôt n'est pas encore relié à Vercel.
> Référence : `docs/trust-contact-launch.md` annexe D.6 (option recommandée : protection standard + liens partageables, inclus dans Vercel Pro).

## 1. Relier le dépôt à Vercel (Sady, une fois)

1. Vercel → *Add New… → Project* → importer `elisaidi08-commits/maison-triona` (GitHub, dépôt privé).
2. Offre **Pro** (l'offre Hobby interdit l'usage commercial).
3. *Settings → Functions* : région **`cdg1`** (Paris).
4. *Settings → Node.js Version* : **24.x** (déjà imposé par `engines` dans `package.json`).
5. *Settings → Environment Variables* :

| Variable | Production | Preview | Valeur |
|---|---|---|---|
| `SITE_URL` | oui | oui | domaine réel en production `[À CONFIRMER]` ; URL de préproduction sinon |
| `SITE_INDEXABLE` | **`false`** jusqu'au jour de l'ouverture, puis `true` | `false` | — |

## 2. Protéger la préproduction

1. *Settings → Deployment Protection* → **Vercel Authentication** : activée pour les **Preview Deployments** (standard).
2. Pour Cat, sans compte : sur un déploiement de préproduction, *Share* → **Shareable Link** (révocable). L'envoyer à Cat ; le révoquer après la revue.
3. Ne jamais attribuer de domaine personnalisé à une branche sans vérifier l'en-tête `noindex` (Vercel ne l'ajoute plus dans ce cas ; notre code, si).

## 3. Vérifier (critères de la story 1.5)

```bash
curl -sI https://<url-de-preproduction>/fr | grep -i x-robots-tag   # → noindex, nofollow
```

- Sans lien partagé ni compte, la préproduction affiche l'écran de connexion Vercel.
- Aucune donnée réelle en préproduction (le coffre et l'e-mail arrivent en stories 3.2 et 3.3, avec une base et un fournisseur de test).

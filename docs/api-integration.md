# Correspondance frontend / API

Base API: `VITE_API_BASE_URL` (par défaut `/api/v1`). En développement, Vite relaie ces requêtes vers `VITE_API_PROXY_TARGET` (par défaut `http://127.0.0.1:3000`), ce qui évite les blocages CORS du navigateur. Pour une API distante ou en production, définissez `VITE_API_BASE_URL` sur l’URL HTTPS de l’API et configurez CORS côté backend. L’API utilise des requêtes JSON et les réponses sont enveloppées dans `success` et `data`, sauf erreurs. Authentification Bearer: access token retourné par la connexion; `POST /auth/refresh` échange le refresh token. Le profil et ses rôles effectifs sont rechargés auprès du serveur.

| Fonctionnalité | Endpoint | Rôle / contexte | État |
| --- | --- | --- | --- |
| Connexion | `POST /auth/login` | Public | INTÉGRÉ |
| Profil et contrôle de rôle | `POST /auth/profile` | Authentifié | INTÉGRÉ |
| Renouvellement / déconnexion | `POST /auth/refresh`, `POST /auth/logout` | Refresh token / utilisateur connecté | INTÉGRÉ |
| Tableau de bord global | `POST /stats/system` | `super_admin`; aucun tenant sélectionné | INTÉGRÉ |
| Tableau de bord tenant | `POST /schools/list`, listes d’élèves et d’agents | `tenant_admin`; tenant injecté par le middleware | INTÉGRÉ |
| Tenants: lecture / création | `POST /tenants/list`, `POST /tenants/create` | `super_admin` | INTÉGRÉ |
| Écoles: lecture globale / tenant | `POST /schools/all`, `POST /schools/list` | Global ou tenant courant | INTÉGRÉ |
| Écoles: création | `POST /schools/create` | Tenant courant, avec `X-Tenant-ID` pour le super-admin | INTÉGRÉ |
| Agents: lecture / création | `POST /agents`, `POST /teachers/profiles/create/{teacher,director,accountant}` | Permission backend et tenant courant | INTÉGRÉ |
| Élèves: lecture / création | `POST /students/list`, `POST /students/create` | Permissions backend et tenant courant | INTÉGRÉ |
| Configuration prix SaaS | `POST /platform/billing/config`, `POST /platform/billing/config/update` | `super_admin` | INTÉGRÉ |
| Contrats SaaS | `POST /platform/subscriptions/list`, `/create`, `/update/:id/status` | `super_admin` | INTÉGRÉ |
| Factures SaaS | `POST /platform/billing/invoices/list`, `/generate` | `super_admin` | INTÉGRÉ |
| Finances scolaires par école | `POST /stats/finance`, `/stats/payroll` avec `school_id` | Tenant courant et rôle/permissions backend | INTÉGRÉ |
| Rapports financiers | `POST /finance/reports/outstanding`, `/finance/reports/payments-between` | Tenant courant, module Finance | INTÉGRÉ |
| Factures et paiements scolaires | `POST /finance/invoices/list`, `/finance/payments/list`, `/finance/payments/register` | Module Finance; encaissement selon permission `register-payment` | INTÉGRÉ |
| Export annuel de paie | `POST /rapports/export-excel` avec `school_id` et `year` (CSV) | Tenant courant, module Finance et permission de rapport de paie | INTÉGRÉ |

Le refresh token est à usage unique et tourne à chaque renouvellement : le client stocke immédiatement le nouveau refresh token et le nouvel access token. L’access token reste en `sessionStorage` pendant sa durée de vie backend (24 heures), ce qui permet de restaurer la session sans consommer un nouveau refresh token à chaque actualisation de page. À expiration, les requêtes `401` partagent un seul renouvellement en cours, y compris sous React Strict Mode; les requêtes concurrentes réutilisent la nouvelle paire de jetons. Un refresh refusé vide la session et renvoie à la connexion. Un `403` indiquant `Module Finance not subscribed or expired` reflète l’abonnement du tenant et non un problème CORS.

## Facturation SaaS

La configuration conserve un tarif mensuel par élève, un tarif par agent et un code devise. Les deux tarifs initiaux valent `0.00`; `0.50` par élève est un exemple à saisir par le super-administrateur, pas un tarif imposé.

Lors de `POST /platform/billing/invoices/generate`, le serveur crée une facture `pending` par tenant ayant un abonnement actif. Il capture le mois, le nombre de lignes `students` du tenant, le nombre de `teacher_profiles` de statut `active`, les deux tarifs et le total. Le montant est calculé en centimes côté serveur. Une contrainte unique `(tenant_id, period_start)` et `createMany(skipDuplicates)` rendent le cycle rejouable sans doublons. Le modèle d’élève actuel n’a pas de statut d’archivage; tous ses profils sont comptés. Les agents sont les profils d’enseignants/directeurs/comptables actifs.

La génération d’une facture ne confirme pas un paiement, ne débite pas un tenant et ne suspend pas automatiquement un accès. Aucun fournisseur de paiement ni workflow de rapprochement n’existe encore. Pour une exécution périodique réelle, planifier l’appel authentifié à `/platform/billing/invoices/generate` depuis un ordonnanceur serveur à la date choisie; l’opération est idempotente.

## Fonctionnalités backend non présentées dans ce portail

- Paiement/collecte SaaS, reçus, rapprochement, relances et taxes: endpoint manquant.
- Création de factures scolaires et remboursements: routes backend disponibles, écrans non intégrés.
- Modification/suppression des tenants, suppression d’écoles, révocation/suppression individuelle d’agents, permissions granulaires dans l’interface: non intégrés.
- Présence, notes, examens, paie et communication: modules disponibles via l’API, non recopiés dans cette console initiale.

Toutes les actions scoped tenant passent par `X-Tenant-ID` uniquement pour le super-admin; pour un tenant-admin, le middleware prend son tenant depuis l’identité authentifiée et ne fait pas confiance au choix du navigateur. Les permissions et l’isolation restent imposées côté API.

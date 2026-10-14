# ÉcolePilot Admin

Portail React/TypeScript pour les rôles `super_admin` et `tenant_admin`. Il communique uniquement avec l’API Express : le navigateur n’accède jamais directement à MySQL.

## Démarrage

```sh
npm ci
cp .env.example .env
npm run dev
```

Le backend doit écouter sur `http://127.0.0.1:3000` par défaut; Vite relaie les appels API via son proxy de développement. Configurez `VITE_API_PROXY_TARGET` si le backend écoute ailleurs. En production, configurez `VITE_API_BASE_URL` sur l’URL HTTPS de l’API et limitez CORS à l’origine du portail. Le compte connecté doit avoir le rôle `super_admin` ou `tenant_admin`, attribué par le backend.

## Fonctionnalités connectées

- Connexion, restauration avec refresh token, déconnexion et vérification serveur du profil.
- Tableau de bord global (`POST /stats/system`) et tenant.
- Liste et création de tenants (le compte administrateur tenant est créé par le backend).
- Liste globale ou tenant des écoles et création dans le tenant sélectionné.
- Liste et création des directeurs, enseignants et comptables par les routes d’agents.
- Liste et création d’élèves par les routes existantes.
- Tarifs SaaS configurables, contrats, suspension/réactivation et génération/liste de factures.
- Vue financière scolaire par école, soldes dus, rapport de paiements par période et export annuel des salaires en CSV.
- Consultation des factures/paiements et enregistrement d’encaissements pour les comptes auxquels le backend accorde la permission correspondante.

Les limites d’intégration, le calcul des ressources facturables et le déclenchement périodique sont décrits dans `docs/api-integration.md`.

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm run preview
```

## Sécurité et déploiement

Les jetons d’accès et de renouvellement sont conservés dans `sessionStorage` pour restaurer la session dans l’onglet courant. L’access token dure 24 heures selon la configuration backend; le refresh token est remplacé à chaque renouvellement réussi. Le stockage navigateur reste exposé au risque XSS, et les variables `VITE_*` sont publiques et ne doivent contenir aucun secret. En production, servez le portail en HTTPS, définissez `VITE_API_BASE_URL` vers l’API HTTPS et limitez `CORS_ORIGIN` backend aux origines frontend de confiance.
# school_saas_admin_space

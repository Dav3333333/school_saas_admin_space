# Déploiement

1. Construire le frontend avec `npm ci && npm run build` dans `admin_spaces/`.
2. Déployer `admin_spaces/dist` sur un hébergement statique avec fallback des routes SPA vers `index.html`.
3. Fournir `VITE_API_BASE_URL` au moment de la compilation. Toute valeur `VITE_*` est publique.
4. Servir frontend et API en HTTPS, puis limiter `CORS_ORIGIN` backend à l’origine exacte du portail.
5. Appliquer la migration SaaS avec `npm run prisma:migrate:deploy` depuis la racine backend.
6. Configurer un ordonnanceur serveur pour appeler mensuellement `POST /api/v1/platform/billing/invoices/generate` avec un jeton super-admin protégé. Ne jamais placer ce jeton dans le frontend.
7. Vérifier le login, le profil, l’isolation tenant et la génération idempotente dans un environnement non productif.

Pour la production, privilégier à terme des cookies `HttpOnly`, `Secure`, `SameSite` et une protection CSRF côté backend. Le frontend courant stocke l’access token et le refresh token tournant en `sessionStorage` pour restaurer la session dans le même onglet; ce choix reste exposé au risque XSS et ne remplace pas une stratégie cookie.

# Architecture

- `src/auth`: restauration de session, profil serveur et contrôle des rôles.
- `src/lib/api.ts`: client Axios, Bearer token, refresh token en session et contexte tenant pour les routes scoped.
- `src/components`: shell responsive, navigation et états chargement/erreur/vide.
- `src/pages`: tableaux de bord, tenants, écoles, agents, élèves et abonnements.
- TanStack Query gère le cache de données API; les mutations invalident les listes touchées.
- Les deux jetons sont conservés en session pour éviter un renouvellement à chaque rechargement; le refresh tournant est partagé entre restauration et réponses `401`.

Les rôles locaux ne sont jamais la source d’autorisation: le portail charge `/auth/profile` et les routes backend restent l’autorité. Le changement de tenant dans l’interface ne s’applique qu’aux requêtes du super-admin qui nécessitent un contexte; le backend contrôle et vérifie ce tenant.

La facturation de plateforme est indépendante des modèles de factures et paiements scolaires. Les montants et volumes sont copiés dans `SaasInvoice` à l’émission, de sorte que les changements de tarifs ultérieurs ne réécrivent pas le passé.

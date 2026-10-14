# Vérification et tests

Depuis la racine backend:

```sh
npm run build
npm test
npx prisma validate
```

Depuis `admin_spaces/`:

```sh
npm run build
npm run lint
```

Les tests backend couvrent les règles pures de facturation (arrondi en cents, montants invalides et capacité de colonne) et la validation de la période/de la configuration. Ils ne constituent pas un test d’intégration avec MySQL ni un test de paiement réel. Les opérations et permissions HTTP de la facturation restent à tester avec une base de données d’intégration.

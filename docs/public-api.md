# API publique

La documentation interactive est disponible sous `/api/docs` (par exemple
`https://code.gouv.fr/sill/api/docs`). Elle décrit uniquement `GET /api/v2/catalogi.json`.
La spécification OpenAPI est disponible sous `/api/openapi.json`.

Swagger UI et ses ressources sont servis localement par l’API, indépendamment de
React. Le lien du footer ne charge aucune dépendance Swagger dans l’application.
Le validateur distant de Swagger UI est désactivé.

## Contrat et génération

Le contrat JSON v2 est dérivé du type `Software` existant dans
`core/usecases/readWriteSillData/types.ts`. `publicApi/types.ts` adapte uniquement
sa représentation JSON (Date et URL deviennent des chaînes, les propriétés
potentiellement undefined deviennent optionnelles) et trois exceptions historiques :
mots-clés Wikidata, auteurs sans @type et auteur du déréférencement parfois absent.

Le schéma Zod de `publicApi/schema.ts` est contraint à être exactement égal à ce
type dérivé : une dérive de type ou de champ, même optionnel ou imbriqué, fait échouer
la compilation. Les organisations récursives réutilisent aussi le type d’origine.
OpenAPI continue d’être généré depuis ce schéma Zod 3 contrôlé.

`pnpm --filter api build` génère `api/dist/src/rpc/publicApi/openapi.json` depuis ces
schémas avec `@asteasolutions/zod-to-openapi` 7.3.4, compatible avec Zod 3.
`pnpm --filter api generate:openapi` permet aussi d’inspecter une spécification
générée dans les sources (fichier ignoré par Git). En développement, la documentation
est générée depuis les schémas au démarrage du serveur.

Le même schéma valide la réponse sérialisée de l’export à chaque renouvellement du
cache de deux heures. Une réponse non conforme provoque une erreur serveur plutôt
que la publication silencieuse d’un contrat différent. Les tests utilisent des
extraits publics de l’export SILL du 18 septembre 2026, dont des valeurs historiques
Wikidata et des logiciels déréférencés. Ces variantes sont explicitement documentées.

Les évolutions compatibles restent en v2 ; une rupture nécessite une nouvelle
version. Actualiser le schéma, ses descriptions et les tests lors d’une évolution.

## Anciens accès

Les exports `/api/catalogi.json` et `/api/sill.json` sont dépréciés mais conservés.
La procédure tRPC `getSoftwares` a été supprimée et ne constitue pas un alias de la v2.
Les procédures tRPC du frontend ne sont pas documentées comme API d’intégration.

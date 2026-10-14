# Spécification fonctionnelle et technique — Phase 6 : RH & Paie (ESSIG-GEST)

```text
Document       : docs/superpowers/specs/phase-6-rh-paie.md
Version        : 1.1
Statut         : À VALIDER — décisions métier bloquantes identifiées
Phase          : 6 — Ressources humaines et paie
Dépendances    : Phase 1 (Référentiel), Phase 2 (Personnes), Phase 5 (Trésorerie)
Auteur         : Agent principal ESSIG-GEST
Date           : 2026-10-12
```

## 0. Instructions d'exécution pour les agents

Cette spécification décrit la cible fonctionnelle. Elle ne prouve pas que les tables, modèles, endpoints ou composants mentionnés existent déjà.

**Règle impérative : auditer avant de modifier.** Aucun code métier ne doit être écrit avant que les livrables de la section 18 soient produits et validés.

Les agents doivent :
1. lire les instructions du dépôt, les décisions Superpowers/SDD, les conventions de code et l'état réel des phases 1 à 5 ;
2. réutiliser les modèles, services, permissions, journaux d'audit et mécanismes de trésorerie existants quand ils répondent au besoin ;
3. ne pas créer de table, rôle, endpoint, abstraction ou dépendance redondante sans justification documentée ;
4. signaler les contradictions entre cette spécification et le code existant, puis proposer une décision avant de poursuivre ;
5. livrer par petites tâches testées, sans contourner ni affaiblir les tests existants ;
6. mettre à jour le plan, la matrice de correspondance SQL/Django, la documentation OpenAPI et `progress.md`.

Une fonctionnalité n'est pas terminée parce que son écran existe : elle doit être sécurisée côté serveur, transactionnelle si elle touche aux finances, auditée, testée et intégrée aux conventions du dépôt.

---

## 1. Objectif

Fournir un module RH/Paie permettant de :
- gérer les enseignants et personnels administratifs ;
- gérer leurs informations professionnelles et affectations aux établissements/pôles ;
- paramétrer les règles de rémunération ;
- préparer, calculer, contrôler, valider et suivre les paies ;
- demander, autoriser, verser et rembourser les avances sur salaire ;
- consulter la masse salariale par période et établissement ;
- produire les mouvements de trésorerie liés aux décaissements, en cohérence avec la Phase 5 ;
- préparer les données et métadonnées nécessaires aux bulletins PDF (génération documentaire selon la Phase 9) ;
- alimenter les futurs rapports, notamment `v_masse_salariale` et `v_paie_enseignant`, si ces vues sont confirmées par l'architecture existante.

Le module est transactionnel, audité et historisé. Une opération financière confirmée ne doit jamais être supprimée ni modifiée silencieusement.

## 2. Périmètre

### 2.1 Inclus
- Fiches RH des enseignants et personnels administratifs ;
- affectations datées ;
- grilles et paramètres de rémunération ;
- cycles de paie et lignes de paie ;
- primes, retenues et remboursements d'avances ;
- validation et suivi du paiement ;
- avances sur salaire ;
- masse salariale et filtres par période/établissement ;
- journal d'audit ;
- intégration avec la trésorerie ;
- préparation des bulletins de paie.

### 2.2 Exclus de la v1
- gestion complète des congés, absences et maladies ;
- recrutement, candidatures et entretiens ;
- évaluations professionnelles et formation ;
- médecine du travail ;
- télétransmission officielle des déclarations sociales/fiscales ;
- calcul automatique exhaustif des impôts et cotisations, sauf si les règles applicables sont spécifiées et validées ;
- portail autonome pour les agents ;
- virements bancaires de masse.

Le stockage de documents contractuels peut être réutilisé si une fonctionnalité documentaire existe déjà, mais la rédaction et la validation juridique des contrats sont hors périmètre.

## 3. Acteurs et autorisations

Les rôles ci-dessous sont des rôles fonctionnels attendus, **pas une autorisation de créer de nouveaux rôles techniques**. L'agent doit les mapper aux rôles et permissions effectivement définis dans `backend/comptes/`.

| Capacité | Rôle fonctionnel attendu |
|---|---|
| Administrer les paramètres RH/paie et effectuer les corrections exceptionnelles | ADMIN autorisé |
| Gérer les dossiers RH et affectations | RH autorisé |
| Préparer/calculer les paies | RH et/ou TRESORIER, selon arbitrage |
| Autoriser une paie et contrôler le décaissement | TRESORIER autorisé |
| Autoriser une avance | DIRECTION autorisée |
| Exécuter le versement d'une avance | TRESORIER autorisé |
| Consulter les agrégats | DIRECTION et rôles autorisés |
| Consulter l'audit en lecture seule | AUDIT et administrateurs habilités |

Toute permission doit être vérifiée côté serveur sur chaque endpoint et chaque action métier. Le masquage d'un bouton dans React n'est jamais une mesure de sécurité suffisante.

Les contrôles doivent aussi tenir compte du périmètre d'établissement de l'utilisateur si l'application applique un cloisonnement par établissement. L'accès transversal doit être explicite et audité.

## 4. Modèle conceptuel

Le modèle cible distingue les notions suivantes :

1. **Personne** : identité de référence, réutilisée depuis la Phase 2. Ne pas dupliquer les informations d'identité déjà gérées par cette phase.
2. **Profil RH** : informations propres au rôle professionnel (enseignant ou personnel administratif), matricule et dates de service.
3. **Affectation** : rattachement d'un agent à un établissement/pôle pendant une période.
4. **Paramètres de rémunération** : grille, catégorie, échelon, statut/contrat et éventuelles règles spécifiques.
5. **Cycle de paie** : période de paie, état du cycle et opérations de clôture.
6. **Paie** : résultat calculé pour un agent, une période et, si nécessaire, une affectation.
7. **Lignes de paie** : détails explicables du montant de base, primes, retenues, remboursements d'avance et autres composantes autorisées.
8. **Avance** : demande et autorisation d'un montant à verser à un agent.
9. **Mouvement de trésorerie** : enregistrement financier issu du mécanisme canonique de la Phase 5.
10. **Audit** : journal immuable ou append-only conforme au mécanisme central existant.

Ces notions sont conceptuelles. Avant de créer des tables, l'agent doit déterminer si les structures existantes couvrent déjà tout ou partie de ces besoins.

## 5. Règles métier

### 5.1 Monnaie et précision
- Devise fonctionnelle : FCFA, sauf paramètre de devise déjà imposé par l'application.
- Tous les montants sont des entiers FCFA dans le domaine métier ; aucun `float` ni type flottant ne doit intervenir dans les calculs.
- En base, respecter le schéma existant. Si une migration est nécessaire, utiliser un type décimal sans décimales ou un entier compatible avec les montants et contraintes réels du projet.
- Valider les bornes minimales et maximales, et prévenir les dépassements de capacité.
- La règle d'arrondi doit être explicite et testée pour tout calcul qui produit un montant non entier. En l'absence de règle validée, bloquer ce calcul plutôt que d'inventer une convention.

### 5.2 Personne, profil et affectation
- L'identité d'une personne est distincte de son profil RH et de ses affectations.
- Une personne peut avoir un ou plusieurs profils professionnels si le modèle métier et les règles du groupe le permettent ; sinon, cette possibilité doit être explicitement interdite.
- Chaque affectation possède une date de début, une date de fin facultative, un établissement/pôle, un type et un statut.
- Les intervalles sont définis de façon non ambiguë. Convention recommandée : début inclus, fin exclue (`[date_debut, date_fin)`), à confirmer selon les données existantes.
- Une affectation terminée ne doit pas être supprimée pour corriger l'historique ; elle doit être clôturée ou corrigée via une opération auditée.
- Empêcher les chevauchements incompatibles pour une même personne, un même établissement et un même type d'affectation. Les affectations multi-établissements ne sont permises que si les règles de rémunération le définissent.
- Toute contrainte de chevauchement doit être vérifiée dans le service métier et, si le moteur SQL le permet, protégée au niveau base de données.

### 5.3 Grilles et paramètres salariaux
- Une grille est applicable à partir d'une date d'effet et, facultativement, jusqu'à une date de fin.
- À une date donnée, une combinaison corps/catégorie/échelon ne doit pas résoudre vers plusieurs grilles concurrentes.
- Une modification de grille ne doit pas modifier rétroactivement les paies déjà calculées ou validées.
- Le calcul doit conserver une photographie des paramètres effectivement appliqués (montant de base, identifiant/version de grille, éléments de rémunération et règles pertinentes), ou un mécanisme équivalent permettant de reproduire et d'expliquer le résultat.
- Les changements de grille et de paramètres sont autorisés uniquement aux rôles habilités et doivent être audités.

### 5.4 Période et cycle de paie
- Une période est identifiée par des dates de début et de fin, un type de période et un statut. La périodicité exacte doit être décidée avant implémentation.
- Il doit être impossible de créer accidentellement deux paies actives pour le même agent et la même période, selon la granularité de rémunération validée.
- Une paie doit référencer son cycle de paie et conserver sa période exacte ; ne pas se limiter à un champ texte « mois/année ».
- Les cycles doivent permettre de distinguer préparation, calcul, validation, paiement/rapprochement et clôture, selon les capacités de la trésorerie existante.

### 5.5 Calcul de paie
Le calcul s'effectue côté backend, dans un service métier indépendant de HTTP. Le frontend ne calcule jamais les montants faisant foi.

Le service doit :
1. vérifier que l'agent est éligible pour la période ;
2. résoudre les affectations et paramètres de rémunération applicables aux dates concernées ;
3. appliquer la règle de proratisation si l'agent n'a pas travaillé/été affecté pendant toute la période, uniquement après validation de cette règle ;
4. charger les primes, retenues et autres composantes autorisées ;
5. déterminer les remboursements d'avance planifiés et non déjà imputés ;
6. calculer le net à payer selon la formule métier validée ;
7. refuser les montants négatifs et toute incohérence de données ;
8. persister le résultat et ses lignes explicatives dans une transaction ;
9. enregistrer les paramètres de calcul et les erreurs de validation utiles.

Formule minimale lorsque seules les composantes prévues sont activées :

`net_a_payer = base + total_primes - total_retenues - remboursements_avance`

La formule devra être étendue si des cotisations, impôts ou autres composantes sont ajoutés. Il est interdit de traiter une retenue comme un paiement de trésorerie distinct si elle ne correspond pas à un décaissement réel.

Une nouvelle exécution de calcul ne doit pas écraser une paie validée ou payée. Pour une paie non validée, le recalcul doit être explicite, contrôlé, historisé et interdit si des opérations financières ont déjà été associées.

### 5.6 Immutabilité et corrections
- Une paie validée est immuable pour les champs qui déterminent le montant et les bénéficiaires.
- Une paie payée ou rapprochée ne peut pas être modifiée ou supprimée.
- Les corrections passent par un mécanisme explicite d'ajustement, d'annulation ou de régularisation, avec auteur, motif, date et référence à l'opération d'origine.
- L'annulation ne supprime jamais l'opération initiale. Si un décaissement a réellement eu lieu, l'écriture inverse ne doit être passée que si le remboursement/retour des fonds a effectivement eu lieu ou selon le workflow financier approuvé. Une annulation administrative seule ne doit pas prétendre qu'un mouvement de trésorerie inverse a eu lieu.
- Les actions sensibles exigent un motif lorsque cela est pertinent et doivent être auditées.

### 5.7 Avances sur salaire
- Une avance suit des états distincts : demandée, autorisée, refusée, versée, en remboursement, remboursée et éventuellement annulée selon les règles validées.
- L'autorisation n'est pas un décaissement. Seul le versement confirmé génère le mouvement de trésorerie sortant.
- Une demande refusée exige un motif.
- Le solde est dérivé des versements effectifs moins les remboursements effectivement imputés. Il ne doit pas être modifiable directement.
- Chaque remboursement est une opération distincte, liée à l'avance et, le cas échéant, à la ligne de paie qui le retient.
- Empêcher les remboursements supérieurs au solde restant, y compris lors d'opérations concurrentes.
- Une retenue de paie et un remboursement manuel ne doivent jamais rembourser deux fois le même montant.
- Le plafond d'avance, la méthode de remboursement, le montant maximal de retenue et le traitement des agents sortants sont des décisions métier bloquantes.
- Une avance ne peut pas être considérée comme remboursée tant que le solde dérivé n'est pas nul.

### 5.8 Trésorerie
- Réutiliser exclusivement le modèle, les services et les règles canoniques de la Phase 5.
- Toute opération RH qui provoque un décaissement doit créer ou référencer un mouvement de trésorerie avec compte, date effective, montant, libellé, type, référence source et auteur selon le contrat de la Phase 5.
- La création de la paie/avance et de son mouvement associé doit être atomique si les deux écritures résident dans la même base et le même système transactionnel.
- Si le mouvement est créé par un service externe ou asynchrone, appliquer un mécanisme d'idempotence/outbox ou le mécanisme existant ; documenter les garanties et les reprises.
- Chaque opération source doit disposer d'une clé d'idempotence ou d'une contrainte équivalente afin qu'une double requête, un retry ou deux traitements concurrents ne produisent pas de double décaissement.
- Ne pas marquer une paie comme payée sur la seule base de sa validation. Le statut payé doit correspondre à la preuve définie par la Phase 5 : mouvement confirmé, transaction comptabilisée ou rapprochement, selon le modèle existant.
- Une erreur pendant une opération atomique doit annuler toutes les écritures locales. Une reprise doit être sûre et ne pas dupliquer les mouvements.

### 5.9 Masse salariale
- La masse salariale est un agrégat calculé à partir des paies et lignes correspondant aux statuts et périodes demandés.
- La réponse doit préciser ce qu'elle représente : montants calculés, validés, payés ou nets à payer. Ne pas mélanger ces bases dans un seul total ambigu.
- Les filtres minimaux sont période et établissement ; les filtres par statut, type de personnel et catégorie sont à prévoir si les données le permettent.
- Les agrégats ne sont pas stockés en dur sans nécessité démontrée. Si une vue SQL existe, vérifier sa définition, sa fraîcheur et sa compatibilité avec les règles métier.
- Les sommes doivent être calculées par agrégation exacte en base ou avec des entiers, jamais par flottants.

### 5.10 Audit
Auditer au minimum : création/modification/désactivation d'un dossier RH, affectation, modification de grille, calcul/recalcul, validation, paiement, annulation/ajustement, avance, remboursement et génération de bulletin.

L'événement d'audit doit inclure l'auteur, l'horodatage, l'action, le type et l'identifiant d'objet, le résultat, le motif éventuel, les changements pertinents et l'identifiant de corrélation de la requête si disponible. Réutiliser le journal central de `backend/core/`.

Ne jamais journaliser de secrets, jetons, mots de passe ou données personnelles non nécessaires. Les données de paie étant sensibles, appliquer les permissions et règles de rétention du projet.

## 6. Données et contraintes

### 6.1 Audit préalable obligatoire
Inspecter `db/migrations/`, `db/tests/`, les modèles et migrations Django, les serializers, services, vues, routes, permissions, tâches asynchrones et écrans React. Vérifier les vues SQL de reporting et leur définition réelle.

Produire `db/CORRESPONDANCE.md` (ou mettre à jour le document existant) avec :
- table/colonne SQL ;
- modèle/champ Django ;
- type et nullabilité ;
- clés étrangères et contraintes ;
- source de vérité ;
- stratégie de migration ;
- écarts et décisions.

### 6.2 Champs conceptuels minimaux
Les noms ci-dessous sont indicatifs et ne justifient pas la création automatique de nouvelles tables.

**Profil enseignant**
- référence à la personne de la Phase 2 ;
- matricule unique selon la règle métier retenue ;
- statut professionnel ;
- diplômes/spécialité si nécessaires au métier ;
- dates d'entrée et de sortie ;
- état actif/inactif.

**Profil administratif**
- référence à la personne ;
- matricule ;
- fonction/service ;
- dates d'entrée et de sortie ;
- état actif/inactif.

**Affectation**
- agent/personne ;
- établissement/pôle ;
- type ;
- début, fin ;
- statut ;
- métadonnées d'audit.

**Paramètre salarial**
- corps/catégorie/échelon ou équivalent métier ;
- montant de base entier ;
- date d'effet et fin éventuelle ;
- statut/version ;
- auteur et dates d'audit.

**Cycle de paie**
- période de début/fin ;
- type/périodicité ;
- statut ;
- dates et auteurs des transitions ;
- établissement ou périmètre, si applicable.

**Paie**
- agent ;
- période/cycle ;
- affectation(s) pertinente(s) ;
- état ;
- total de base, primes, retenues, remboursement et net ;
- photographie des paramètres de calcul ;
- dates/auteurs de calcul et validation ;
- référence au mouvement de trésorerie lorsque applicable ;
- motif et référence d'ajustement/annulation.

**Ligne de paie**
- paie ;
- type de composante ;
- libellé/code ;
- montant entier signé ou montant non négatif avec sens explicite, selon la convention choisie ;
- source et référence d'origine ;
- ordre d'affichage ;
- données nécessaires à l'explication du calcul.

**Avance**
- agent ;
- montant autorisé ;
- statut et transitions ;
- motif de demande/refus ;
- dates/auteurs ;
- mouvement de trésorerie de versement ;
- solde calculé à partir du registre des opérations.

**Opération de remboursement**
- avance ;
- montant ;
- date effective ;
- source (retenue de paie ou remboursement manuel) ;
- référence de la paie ou de l'opération de trésorerie si applicable ;
- auteur et idempotence.

Les champs dérivés tels que `solde_restant` ne doivent pas être une source de vérité. Un cache n'est acceptable qu'avec stratégie de recalcul, cohérence et tests explicites.

## 7. Workflows et transitions

### 7.1 Paie
Workflow cible, à adapter aux états réellement utilisés dans le dépôt :

`BROUILLON → CALCULÉE → VALIDÉE → PAYÉE/CONFIRMÉE → CLÔTURÉE`

Une paie non validée peut être recalculée selon des règles explicites. Une paie validée ne revient pas silencieusement en brouillon. L'annulation et l'ajustement sont des actions dédiées, soumises à permission et motif. Toute transition non prévue doit être rejetée côté serveur.

### 7.2 Avance
`DEMANDÉE → AUTORISÉE → VERSÉE → EN_REMBOURSEMENT → REMBOURSÉE`

Une demande peut être refusée avant versement. L'annulation après versement exige un traitement financier réel et traçable. Les noms exacts des états peuvent suivre les conventions existantes, mais leur sens ne doit pas être confondu.

### 7.3 Concurrence
Les opérations de validation, versement, remboursement et imputation doivent verrouiller ou protéger les enregistrements nécessaires, selon les capacités de la base (`select_for_update`, contraintes uniques ou mécanisme équivalent). Tester deux requêtes concurrentes qui ciblent la même paie ou le même solde d'avance.

## 8. API cible

Base indicative : `/api/v1/`. Confirmer le routage et les conventions du projet avant de créer les routes.

- Enseignants : liste, détail, création, mise à jour partielle, désactivation, affectations.
- Personnel administratif : liste, détail, création, mise à jour partielle, désactivation.
- Affectations : liste, détail, création, mise à jour, clôture.
- Grilles : lecture, création et modification selon permissions.
- Cycles/paies : liste filtrable, détail, calcul, recalcul autorisé, validation, paiement/confirmation, annulation/ajustement, bulletin, masse salariale.
- Avances : liste, détail, demande, autorisation, refus, versement, remboursement et consultation du solde.

Les opérations métier utilisent des actions explicites plutôt qu'un `PATCH` arbitraire de statut. Le client ne peut pas choisir directement les champs calculés, l'auteur de validation, le mouvement de trésorerie ou le solde.

Chaque endpoint doit avoir :
- authentification et permission explicites ;
- validation des entrées et de l'état courant ;
- pagination, tri, filtres et recherche conformes aux conventions de l'API ;
- schéma OpenAPI ;
- réponses d'erreur cohérentes ;
- tests de permissions et de règles métier.

Codes indicatifs :
- `400` : format ou données invalides ;
- `401` : non authentifié ;
- `403` : action interdite ;
- `404` : ressource inexistante ou non visible selon la politique de sécurité ;
- `409` : conflit d'état, doublon/idempotence ou concurrence ;
- `422` : règle métier non satisfaite, si cette convention est utilisée par l'API existante.

Ne pas introduire un nouveau format d'erreur si le projet en possède déjà un.

## 9. Frontend React

### 9.1 Écrans
- enseignants ;
- personnel administratif ;
- affectations ;
- paramètres/grilles salariales ;
- cycles et paies ;
- détail de paie avec lignes explicatives ;
- avances et remboursements ;
- tableau de masse salariale ;
- bulletin et historique des opérations.

### 9.2 Exigences
- réutiliser les composants, le design system, les patterns de formulaire et les conventions de navigation du projet ;
- tableaux paginés avec filtres serveur ;
- formulaires React Hook Form/Zod si ces bibliothèques sont déjà les conventions du dépôt ;
- générer/actualiser les types depuis OpenAPI selon la procédure existante ;
- afficher clairement les statuts, la période, le montant et la base de calcul ;
- présenter les lignes de paie et les retenues de façon explicable ;
- demander confirmation et motif pour les actions irréversibles/sensibles ;
- gérer chargement, erreur, absence de données, succès et conflits ;
- éviter le double clic et afficher l'état d'une opération en cours ;
- ne jamais calculer côté frontend les montants faisant foi ;
- masquer les actions non autorisées pour l'expérience utilisateur, sans remplacer les permissions backend ;
- respecter les règles d'accessibilité et les composants existants.

## 10. Validations backend minimales

- matricule conforme à la politique d'unicité décidée ;
- montants entiers et dans les bornes autorisées ;
- net à payer non négatif ;
- dates et intervalles cohérents ;
- affectations et paramètres applicables à la période ;
- absence de grille ambiguë à la date de calcul ;
- unicité logique d'une paie par agent/période selon la granularité validée ;
- transitions de statut permises uniquement ;
- paie validée/payée non modifiable ;
- action financière idempotente ;
- avance versée seulement après autorisation ;
- remboursement inférieur ou égal au solde courant ;
- aucune double imputation d'un remboursement ;
- compte de trésorerie valide et autorisé ;
- établissement accessible par l'utilisateur ;
- motif obligatoire pour les refus, annulations et ajustements sensibles ;
- aucune modification directe des champs dérivés par le client.

Les validations doivent être appliquées dans les services métier et renforcées en base lorsque possible. Les validations uniquement présentes dans le serializer ou le frontend ne suffisent pas pour les invariants financiers.

## 11. Sécurité, confidentialité et exploitation

- appliquer le principe du moindre privilège ;
- limiter les données personnelles retournées par les listes ;
- vérifier les permissions sur les objets et le périmètre établissement ;
- protéger les endpoints d'export et de bulletin comme les données de paie ;
- journaliser les actions sans exposer de secrets ;
- limiter les accès aux documents générés ;
- éviter les traces de requête contenant des informations de paie complètes ;
- prévoir les contrôles de sauvegarde, de restauration et de rétention conformément aux règles globales du projet ;
- ne pas prétendre assurer une conformité juridique/sociale complète tant que les règles locales applicables et leur validation ne sont pas documentées.

## 12. Tests obligatoires

### 12.1 Tests unitaires métier
- calcul de base valide ;
- primes et retenues ;
- remboursement d'avance correctement imputé ;
- proratisation, uniquement si la règle est décidée ;
- montant net négatif rejeté ;
- grille absente ou ambiguë rejetée ;
- recalcul interdit pour une paie validée ;
- transition d'état invalide rejetée ;
- avance au plafond rejetée selon la règle adoptée ;
- remboursement supérieur au solde rejeté ;
- calcul exact sans flottants.

### 12.2 Tests API et RBAC
- matrice de permissions pour chaque action ;
- utilisateur hors périmètre établissement ;
- validation des champs calculés et champs protégés ;
- filtres, recherche et pagination ;
- erreurs métier et conflits ;
- documentation OpenAPI générée sans erreur.

### 12.3 Tests d'intégration financière
- validation/confirmation de paie et mouvement selon le workflow retenu ;
- versement d'avance et mouvement unique ;
- rollback en cas d'échec ;
- retry de requête sans doublon ;
- annulation/ajustement conforme à la réalité financière ;
- remboursement manuel et retenue de paie sans double imputation ;
- rapprochement entre paies, opérations et mouvements de trésorerie.

### 12.4 Tests de concurrence et non-régression
- double validation simultanée ;
- double versement simultané ;
- remboursements simultanés dépassant ensemble le solde ;
- suite existante verte ;
- absence de régression sur les phases 1 à 5.

## 13. Critères d'acceptation

La phase n'est terminée que lorsque :
- [ ] audit de l'existant et décisions bloquantes documentés ;
- [ ] modèle SQL/Django cohérent et correspondance actualisée ;
- [ ] migrations sûres, vérifiées et compatibles avec les données existantes ;
- [ ] services métier indépendants de HTTP ;
- [ ] transitions d'état et invariants protégés ;
- [ ] opérations financières idempotentes et transactionnelles ;
- [ ] audit effectif ;
- [ ] permissions et périmètre établissement testés côté serveur ;
- [ ] OpenAPI valide et types frontend régénérés ;
- [ ] interfaces intégrées au design system existant ;
- [ ] tests unitaires, API, intégration, concurrence et non-régression verts ;
- [ ] `manage.py check`, `makemigrations --check`, `pytest` et `ruff check .` réussis si ces commandes correspondent au dépôt ;
- [ ] `npm run typecheck`, `npm test` et `npm run build` réussis si ces scripts existent ;
- [ ] `progress.md`, plan de phase et documentation de correspondance mis à jour ;
- [ ] aucun TODO bloquant non documenté et aucune donnée de test sensible ;
- [ ] revue finale des migrations, permissions et flux financiers effectuée.

Si une commande n'existe pas dans le dépôt, l'agent doit indiquer la commande équivalente et ne pas inventer un résultat.

## 14. Décisions métier bloquantes

Les décisions suivantes doivent être recherchées dans la documentation, les données, les tests et les pratiques déjà implémentées. Si elles ne sont pas déterminables, proposer une décision argumentée et la faire valider avant le code métier.

| ID | Décision | Questions à trancher |
|---|---|---|
| D1 | Périodicité | Mensuelle, quinzaine ou autre ? Quelle clé d'unicité ? |
| D2 | Éligibilité/proratisation | Comment calculer une période partielle, une entrée ou une sortie en cours de période ? |
| D3 | Vacataires | À l'heure, à la vacation, au forfait ou selon plusieurs modes ? |
| D4 | Primes/retenues | Catalogue paramétrable, saisie libre contrôlée ou les deux ? Quelles pièces justificatives ? |
| D5 | Avances | Plafond fixe, ratio du salaire ou paramètre ? Quel traitement des agents sortants ? |
| D6 | Remboursements | Montant fixe, pourcentage ou échéancier ? Plafond de retenue par paie ? |
| D7 | Validation/paiement | La validation autorise-t-elle le paiement ou constitue-t-elle une étape distincte ? Quelle preuve fait passer à PAYÉE ? |
| D8 | Comptes de trésorerie | Quel compte est utilisé, qui le choisit et comment vérifier son autorisation ? |
| D9 | Ajustements/annulations | Qui peut les autoriser ? Quel traitement si les fonds ont déjà été décaissés ? |
| D10 | Cotisations/fiscalité | Quels éléments sont inclus en v1 et quelles règles sont validées ? |
| D11 | Bulletin | Champs obligatoires, modèle, numérotation, accès et dépendance exacte à la Phase 9 ? |
| D12 | RBAC | Correspondance exacte avec les rôles/permissions existants dans `backend/comptes/` ? |
| D13 | Identité RH | Matricule unique global ou par type de personnel ? Une personne peut-elle cumuler les deux profils ? |
| D14 | Reporting | Définition métier de la masse salariale : calculée, validée, payée, brute ou nette ? |

Chaque décision doit être consignée dans `.superpowers/sdd/` ou dans une section « Decisions » de la spécification, avec statut (`PROPOSÉE`, `VALIDÉE`, `REJETÉE`), justification, conséquences et date. Les hypothèses ne doivent pas être codées comme si elles étaient validées.

## 15. Risques et mesures

| Risque | Niveau | Mesure |
|---|---|---|
| Divergence SQL/Django | Critique | Audit et correspondance avant migration |
| Double décaissement | Critique | Idempotence, contraintes, verrouillage et tests de retry |
| Paie modifiée après validation | Critique | Invariants serveur, snapshot de calcul, audit |
| Mauvaise période ou mauvaise grille | Élevé | Résolution datée et tests de frontière |
| Remboursement imputé deux fois | Critique | Registre des opérations et unicité d'imputation |
| Rôles ou périmètres incorrects | Élevé | Mapping RBAC et tests par objet/établissement |
| Montants flottants | Critique | Types exacts et tests ciblés |
| Vue de masse salariale incohérente | Élevé | Définition des statuts inclus et tests de rapprochement |
| Annulation financière fictive | Critique | Séparer annulation métier et retour effectif des fonds |
| Données RH exposées | Élevé | Permissions minimales et contrôle des exports |

## 16. Traçabilité

Maintenir une matrice de traçabilité reliant chaque exigence à :
- source de la règle ;
- décision métier associée ;
- table et colonne SQL ;
- modèle/champ Django ;
- service métier ;
- permission ;
- endpoint/OpenAPI ;
- écran/composant ;
- test ;
- statut d'implémentation.

Aucune ligne ne doit être marquée terminée sans test ou justification documentée lorsque le test n'est pas applicable.

## 17. Dépendances et évolutions futures

- gestion des congés et absences ;
- portail agent en lecture seule ;
- génération PDF complète et archivage sécurisé ;
- notifications ;
- intégration bancaire ;
- déclarations sociales/fiscales ;
- règles de cotisations et de fiscalité après validation métier et juridique.

Ces éléments nécessitent des spécifications séparées ou une extension validée de celle-ci.

## 18. Livrables obligatoires avant implémentation

L'agent principal doit produire, dans cet ordre :

1. **Audit de l'existant** : tables SQL/migrations, tests, modèles Django, services, endpoints, permissions, rôles, pages React, vues de reporting et mécanismes Phase 5.
2. **Matrice d'état** : `EXISTANT / PARTIEL / MANQUANT / À CORRIGER`, avec chemins de fichiers et preuves.
3. **Correspondance SQL/Django** : créer ou actualiser `db/CORRESPONDANCE.md`.
4. **Registre des décisions** : résoudre les décisions D1 à D14 par preuve existante ou proposition soumise à validation.
5. **Plan d'implémentation** : `docs/superpowers/plans/phase-6-rh-paie.md`, découpé en tâches petites, ordonnées, testables et réversibles.
6. **Plan de tests** : préciser les tests unitaires, API, intégration, concurrence, sécurité et non-régression.
7. **Revue de cohérence** : confirmer que le plan respecte l'architecture et les conventions du dépôt.

**Interdiction de commencer le code métier avant validation de ces livrables et des décisions bloquantes.** Des travaux de reconnaissance, d'audit et de documentation peuvent être réalisés avant validation.

## 19. Ordre d'implémentation après validation

1. Aligner et valider le modèle conceptuel sur l'existant.
2. Mettre en place les contraintes et migrations minimales nécessaires.
3. Implémenter les services de profils RH et d'affectations.
4. Implémenter les paramètres salariaux et leur résolution temporelle.
5. Implémenter le cycle de paie, les lignes détaillées et le calcul déterministe.
6. Implémenter les transitions, validations et mécanismes d'ajustement.
7. Implémenter les avances, versements, remboursements et protections contre les doubles imputations.
8. Intégrer la trésorerie via ses services canoniques et tester l'idempotence.
9. Ajouter audit, permissions et périmètres à chaque étape — pas uniquement à la fin.
10. Exposer l'API documentée et régénérer les types frontend.
11. Intégrer les écrans React.
12. Exécuter les tests, contrôles de qualité et tests de non-régression.
13. Mettre à jour documentation, traçabilité et `progress.md`.

Chaque étape doit être livrée en incréments vérifiables. Ne pas attendre la fin du module pour tester les invariants financiers.

---

**Fin de la spécification — Phase 6 RH & Paie, version 1.1.**

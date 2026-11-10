# ESSIG_GEST — Analyse consolidée des audits backend
**Date des rapports analysés : 14 octobre 2026**  
**Périmètre :** `comptes`, `core`, `referentiel`, `personnes`, `scolarite`, `tresorerie`, `rh_paie`.

## 1. Synthèse exécutive

Les rapports décrivent une base backend inégalement mature. Les fondations (`comptes`, `core`, `referentiel`, `personnes`) sont globalement solides, avec quelques corrections déjà consignées. Les risques les plus élevés se situent dans les parcours métier réellement exécutés par l’API, notamment la trésorerie, la scolarité et les opérations financières RH/paie.

**Point essentiel : les addenda déclarent plusieurs corrections réalisées le 14/10/2026, mais cela ne constitue pas à lui seul une preuve de validation de bout en bout.** Les audits indiquent encore 27 échecs de tests préexistants à la fin de la session, ainsi que des décisions métier et contrôles de sécurité qui doivent rester explicitement bloquants. Le contenu du ZIP a été analysé ; le code source courant du dépôt n’a pas été réexécuté dans le cadre de ce rapport.

### Verdict par module

| Module | Verdict des audits | Suite à donner |
|---|---|---|
| `comptes` | Sain ; permissions et JWT correctement couverts. Un commentaire TODO est obsolète. | Nettoyage mineur, conserver les tests RBAC/JWT. |
| `core` | Les primitives sont globalement saines, mais l’adoption a été incohérente dans les modules financiers. | Vérifier l’adoption effective de l’audit, des suppressions protégées et des erreurs typées. |
| `referentiel` | Risque de concurrence autour de l’année scolaire courante ; l’addendum indique qu’un verrou et un test de concurrence ont été ajoutés. | Rejouer le test de concurrence sur le moteur de base réellement utilisé en production. |
| `personnes` | Globalement mature ; atomicité de création d’étudiant et verrouillage de la pièce de dossier indiqués comme corrigés. | Vérifier les tests de régression et les permissions de modification de `PieceDossier`. |
| `scolarite` | Plusieurs erreurs API identifiées puis deux erreurs de champs corrigées. Des fonctionnalités restent volontairement incomplètes : génération d’échéancier complète et matérialisation des frais obligatoires. | Traiter comme périmètre fonctionnel non livré, pas comme une simple dette cosmétique. |
| `tresorerie` | Risque critique : services non branchés à l’API, serializers DRF mal déclarés et permissions incompatibles avec le RBAC ont été signalés puis déclarés corrigés. Plusieurs bugs de services et protections du grand livre ont aussi été identifiés. | Priorité absolue : tests API de bout en bout, intégrité comptable, idempotence, annulation par contre-écriture et protection du grand livre. |
| `rh_paie` | Des corrections de workflow, d’atomicité, de champs de sérialisation et d’adoption de `core` sont consignées. Une duplication du chemin de paiement reste documentée. | Vérifier les parcours réels HTTP et verrouiller la mise en production tant que les contrôles financiers ne sont pas validés. |

## 2. Risques prioritaires

### P0 — À bloquer jusqu’à validation formelle

1. **Paiements et mouvements de trésorerie** : aucun paiement réel ni mouvement comptable ne doit être autorisé tant que les tests d’intégration ne prouvent pas qu’une opération API déclenche exactement les écritures attendues, dans une transaction atomique.
2. **Validation effective des salaires** : vérifier les transitions de statut, les rôles autorisés, le refus des validations prématurées et l’impossibilité de forger les champs de workflow depuis le client.
3. **Régularisation définitive des avances** : contrôler le mouvement associé, l’année scolaire, l’idempotence, le verrouillage concurrent et la cohérence du statut.
4. **Modification/suppression des données financières** : le grand livre `Mouvement` a été signalé comme insuffisamment protégé au niveau modèle. Vérifier l’API, l’admin Django, les scripts et les appels ORM ; ne pas se contenter de rendre un ViewSet en lecture seule.
5. **Annulations et corrections comptables** : l’audit indique que le workflow D9 reste hors périmètre v1. Ne pas autoriser une annulation implicite ou une suppression d’écriture ; exiger une décision métier et un mécanisme explicite de contre-écriture.
6. **Résultats de tests** : les 27 échecs restant à la fin de la session doivent être listés, reproduits et classés individuellement avant toute déclaration « prêt pour production ».

### P1 — Bloquants fonctionnels

- **Trésorerie** : confirmer sur le dépôt actuel que les quatre créations (`Virement`, `Encaissement`, `Depense`, `ArreteCaisse`) appellent les services métiers et que ces services produisent les mouvements attendus. Tester également validation, annulation, imputation, arrêtés de caisse et erreurs de solde.
- **Scolarité** : ne pas déclarer la Phase 3B livrée tant que `generer_echeancier` n’est pas le générateur métier validé et que `materialiser_frais_obligatoires` n’a pas de vraie implémentation ou n’est pas explicitement retirée du flux. Le stub `return []` est un risque de fausse réussite fonctionnelle.
- **Affectations et personnes RH** : les champs d’audit absents des modèles ont été ajoutés selon l’addendum. Vérifier migrations appliquées, schéma OpenAPI et POST/PATCH/GET sur les trois endpoints concernés.
- **Permissions** : confirmer que tous les contrôles financiers utilisent les rôles du RBAC du projet et qu’un utilisateur sans rôle, `LECTURE` seul ou appartenant à une autre école ne peut pas effectuer d’écriture non autorisée.

### P2 — Cohérence et dette technique

- Harmoniser les ViewSets financiers avec `core._BaseCrudViewSet`, `AuditLogMixin`, `SuppressionProtegeeMixin` et les erreurs typées.
- Clarifier l’implémentation canonique de l’imputation d’encaissement : la variante FIFO de `scolarite` et la variante à imputations explicites de `tresorerie` ont des sémantiques différentes. Ne pas les fusionner sans décision métier.
- Clarifier le contrat de `montant_paye` pour les salaires administratifs : l’addendum retient la prise en charge des paiements partiels/échelonnés et précise que chaque paiement doit couvrir exactement le reste dû courant.
- Vérifier l’arrondi des bourses et prévenir leur application en double.
- Nettoyer le commentaire obsolète sur `derniere_connexion` dans `comptes`.
- Revoir la cohérence de la date de début d’année scolaire dans les scripts de seed (septembre documenté contre 1er octobre signalé).

## 3. Ordre d’exécution recommandé

### Étape 0 — Établir l’état réel du dépôt
- Créer une branche dédiée à la stabilisation.
- Relever le commit courant, les migrations présentes et leur état.
- Exécuter `manage.py check`, `makemigrations --check`, la génération OpenAPI et toute la suite de tests.
- Exporter la liste complète des échecs avec commande, fichier, test, traceback et statut (régression / préexistant / environnement / décision métier).
- Ne pas effacer ou reclasser un échec comme « préexistant » sans reproduction et justification vérifiables.

**Critère de sortie :** inventaire reproductible des tests et migrations, sans modifications fonctionnelles pendant cette étape.

### Étape 1 — Sécuriser les opérations financières
- Ajouter ou vérifier des tests API réels pour créer, lire, valider, payer, imputer, annuler et supprimer/refuser la suppression.
- Vérifier qu’une création métier et toutes ses écritures sont atomiques : en cas d’échec, aucune écriture partielle ne subsiste.
- Ajouter des tests de concurrence avec deux transactions distinctes pour les doubles paiements, doubles imputations et doubles validations.
- Tester l’idempotence : une seconde requête identique ne crée pas de second mouvement.
- Vérifier le rapprochement entre objet métier, mouvement débit/crédit, compte, école et année scolaire.
- Ajouter une protection robuste sur `Mouvement` : règles d’immutabilité, suppression interdite si référencé/comptabilisé, et voie de correction via contre-écriture selon une règle approuvée.
- Vérifier les permissions sur API, Django admin et chemins de service/ORM accessibles aux scripts.

**Critère de sortie :** tests d’intégration verts pour tous les parcours financiers ; aucune création d’objet sans ses écritures attendues ; aucune double écriture possible dans les scénarios testés.

### Étape 2 — Stabiliser RH/paie et avances
- Tester le cycle salaire : brouillon → validation autorisée → paiement complet ou partiel selon le contrat métier.
- Tester refus de paiement avant validation, paiement au-delà du reste dû, double paiement concurrent, mauvais compte, année scolaire manquante et bénéficiaire incohérent.
- Vérifier la règle confirmée dans les audits : pour salaire administratif, `montant_paye` représente les sommes déjà versées ; chaque nouveau paiement couvre exactement le reste dû courant ; le statut `PAYÉ` n’est atteint qu’à solde nul.
- Tester la régularisation d’avance : une seule régularisation effective, mouvement lié à l’avance, date et année scolaire valides, statut cohérent, rollback complet si une étape échoue.
- Vérifier que les champs de workflow sont en lecture seule côté API et que les rôles d’approbation sont explicites.
- Documenter le chemin de paiement HTTP comme chemin canonique ; garder les fonctions de service non branchées clairement marquées comme non appelables tant qu’elles ne sont pas unifiées.

**Critère de sortie :** tests API et tests de concurrence verts ; aucune transition financière non autorisée.

### Étape 3 — Fermer les écarts de scolarité
- Décider et documenter le générateur d’échéancier canonique.
- Remplacer le placeholder actif uniquement après validation de la règle métier, ou empêcher explicitement le flux de prétendre avoir créé un échéancier complet.
- Implémenter les frais obligatoires ou retirer leur appel du flux jusqu’à livraison, sans fausse réussite.
- Tester les inscriptions avec plusieurs échéances, bourses, paiement partiel, annulation et recalcul du reste à payer.
- Tester les GET avec filtres et tris des ViewSets concernés, pas seulement les POST.

**Critère de sortie :** inscription, échéancier, frais et encaissement cohérents sur un scénario complet d’élève.

### Étape 4 — Cohérence transversale
- Adopter les ViewSets de base et les mécanismes communs `core` dans les modules concernés.
- Uniformiser les codes d’erreur publics ; ne pas exposer `str(e)` brut comme contrat API.
- Vérifier les journaux d’audit pour création, modification, validation, paiement, régularisation et refus.
- Tester l’année scolaire courante sur le moteur de base utilisé en production.
- Vérifier migrations neuves depuis une base vide et migrations sur une base existante.

### Étape 5 — Autorisation de mise en production
- Exécuter toute la suite sur une base isolée représentative de la production.
- Exiger zéro régression non expliquée et un rapport signé des exceptions acceptées.
- Faire une recette métier avec scénarios et montants réalistes mais données de test.
- Confirmer sauvegarde/restauration, journalisation, permissions, et procédure de reprise après échec.
- Activer les opérations financières progressivement, avec supervision et possibilité de désactivation.

## 4. Décisions métier à consigner explicitement

Les audits mentionnent les décisions suivantes ; certaines sont déjà notées comme tranchées dans les addenda, mais elles doivent rester documentées dans la spécification source :

- **D5 — Avances** : flux à une étape et absence de plafond retenus selon l’addendum. Faire confirmer cette règle par le responsable métier et la consigner.
- **D6 — Remboursement des avances** : préciser si la régularisation est obligatoirement en une fois ou si les retenues échelonnées sont prévues. L’addendum ne décrit pas une solution structurelle complète pour l’échelonnement.
- **D7 — Preuve de paiement** : l’addendum retient « mouvement créé = payé ». Il faut préciser si cette règle est suffisante en production et quelle référence/preuve doit être conservée.
- **D8 — Compte de trésorerie** : le choix du compte est libre actuellement selon l’audit. Définir les comptes autorisés par école, année et type d’opération.
- **D9 — Annulation/ajustement** : explicitement hors périmètre v1 selon l’addendum. Garder ces actions bloquées jusqu’à définition des rôles, du workflow et de la contre-écriture.
- **Imputation d’encaissement** : décider si l’imputation explicite est la règle v1 ou si une allocation FIFO doit être supportée.
- **Échéancier et frais obligatoires** : approuver la règle métier avant d’activer la version complète.

## 5. Prompt opérationnel à donner à l’agent de code

> Tu travailles sur ESSIG_GEST, un backend Django/DRF de gestion scolaire, RH, paie et trésorerie. Ta mission est de stabiliser l’existant, pas d’ajouter des fonctionnalités nouvelles.
>
> **Règles impératives**
> 1. Commence par lire les audits datés du 14/10/2026 et vérifier l’état réel du dépôt. Les rapports décrivent des corrections qui doivent être confirmées, pas présumées.
> 2. Travaille en TDD : écris un test qui reproduit le défaut, exécute-le pour constater l’échec, corrige le minimum, puis exécute le test ciblé et la suite pertinente.
> 3. Ne change aucune règle métier ambiguë sans décision écrite. Ne fusionne pas les implémentations d’imputation ou de paiement sans documenter la décision et les migrations nécessaires.
> 4. Jusqu’à validation formelle, ne déclenche aucun paiement réel, aucune validation effective de salaire, aucune régularisation définitive d’avance et aucune modification/suppression irréversible de données financières.
> 5. Toute opération financière doit être atomique, protégée par les permissions RBAC réelles, verrouillée contre la concurrence, idempotente ou explicitement protégée contre les doubles soumissions, et traçable dans le journal d’audit.
> 6. Ne considère jamais un test de service isolé comme preuve suffisante : teste le chemin HTTP réel avec les permissions, serializers, ViewSets, services et effets en base.
> 7. Ne masque pas les erreurs avec `except Exception` ou des retours silencieux. Utilise le contrat d’erreur commun du projet.
> 8. Ne supprime pas de code/fichier suspect sans vérifier les imports, les usages, l’historique Git et les tests.
> 9. N’annonce pas qu’une phase est terminée tant que les tests, migrations, schéma OpenAPI et critères métier correspondants ne sont pas validés.
>
> **Ordre de travail**
> A. Inventorier le dépôt et reproduire les 27 échecs de tests signalés dans le rapport ; produire un tableau avec cause, preuve, correction prévue et statut.
> B. Sécuriser la trésorerie : tests API pour encaissement, virement, dépense, arrêté de caisse, imputation, validation, annulation et protection du modèle `Mouvement`.
> C. Sécuriser RH/paie : validation, paiements complets/partiels, avances, concurrence, immutabilité, rôles et journaux d’audit.
> D. Fermer les placeholders et incohérences de scolarité après décision métier explicite.
> E. Harmoniser l’adoption de `core`, les erreurs API et les migrations.
>
> **Pour chaque lot, livre obligatoirement**
> - diagnostic reproduit et fichiers/lignes concernés ;
> - test de régression ajouté ;
> - correctif minimal ;
> - commandes exécutées et résultats exacts ;
> - migrations créées et justification ;
> - risques résiduels et décisions métier encore nécessaires ;
> - verdict `VALIDÉ`, `BLOQUÉ` ou `À REVOIR`, avec preuves.
>
> **Critères de fin**
> - `manage.py check` passe ;
> - `makemigrations --check` ne détecte aucun changement oublié ;
> - génération OpenAPI passe ;
> - tests ciblés et tests complets ont un résultat expliqué et reproductible ;
> - les tests API prouvent l’intégrité des mouvements et l’absence de double écriture ;
> - aucune opération financière à risque n’est activée tant que les critères P0 ne sont pas satisfaits.

## 6. Décision de pilotage recommandée

**Ne pas déclarer le backend prêt pour la production financière à partir de ces audits seuls.** Les corrections rapportées sont substantielles et positives, mais les 27 échecs restants, la protection du grand livre, les parcours HTTP et les règles métier D5–D9 exigent encore une validation démontrable. Le prochain livrable de l’équipe doit être un **rapport de vérification sur le dépôt courant**, pas une nouvelle fonctionnalité.

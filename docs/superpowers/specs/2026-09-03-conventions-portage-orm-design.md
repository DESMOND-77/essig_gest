# Conventions de portage SQL → Django ORM

**Date :** 2026-09-03
**Statut :** design validé, applicable à tous les modules métier
**Portée :** règles uniformes pour porter le modèle de données (référence
`db/migrations/*.sql` + `docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md`)
vers des modèles Django. Ne couvre pas le contenu fonctionnel des modules (traité module par module).

---

## 1. Contexte

Décision T3 (`2026-08-30-choix-technologies-sis-design.md`) : **Django (ORM + migrations) est la
source de vérité de l'application**. `db/migrations/*.sql` (49 tables + 13 vues) et
`db/tests/*.sql` restent la **référence de conception**. Les 6 modules métier
(`referentiel`, `personnes`, `scolarite`, `tresorerie`, `paie`, `resultats`) vont être portés un
par un ; ce document fige les règles transverses pour éviter des divergences silencieuses et des
arbitrages répétés.

---

## 2. Décisions

### D-ORM-1 — Type de clé primaire et de clé étrangère : `BIGINT`

Tous les PK et FK des modèles Django utilisent le défaut Django
(`DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"` → `BIGINT`), **y compris** là où
`db/migrations` déclare `INT UNSIGNED`.

- **Justification :** défaut Django, aucun `AutoField`/`PositiveIntegerField` explicite à
  disséminer ; `mouvement.id`, `journal_audit.id` et tous les `mouvement_id` sont déjà
  `BIGINT UNSIGNED` dans le SQL de référence ; le surcoût de stockage est négligeable à l'échelle
  (un groupe scolaire, dizaines de milliers de lignes/an) ; une base neuve est créée par les
  migrations Django, pas par `db/migrations`.
- **Conséquence :** lors du diff `sqlmigrate` ↔ `.sql` de référence (D-ORM-9), **l'écart de type
  entier PK/FK est un écart accepté d'office** — ne pas le corriger, ne pas le consigner à chaque
  fois. Tout le reste (colonnes, nullabilité, longueurs `VARCHAR`, `UNIQUE`, index, FK ciblées,
  `ON DELETE`, colonnes générées, `CHECK`) doit correspondre.
- Le SQL de référence n'est **pas** réécrit pour cet alignement (il reste de la conception).

### D-ORM-2 — Types de champs normalisés

| Domaine | Champ Django |
|---|---|
| Montant FCFA | `DecimalField(max_digits=12, decimal_places=0)` |
| Note /20 | `DecimalField(max_digits=4, decimal_places=2, null=True)` selon le cas |
| Pondération % | `DecimalField(max_digits=5, decimal_places=2)` |
| Booléen | `BooleanField(default=...)` explicite |
| Date métier | `DateField` ; horodatage technique `DateTimeField` |
| JSON (`journal_audit`) | `JSONField(null=True)` |
| IP | `GenericIPAddressField(null=True, blank=True)` |

Jamais de `FloatField` pour une grandeur financière ou une note.

### D-ORM-3 — Nom de table

`class Meta: db_table = "<nom cible du design>"` sur **chaque** modèle : `snake_case` **singulier**,
sans accent, français (`etudiant`, `modalite_paiement`, `option_filiere`). Pas de préfixe d'app,
pas de pluriel automatique Django.

### D-ORM-4 — Énumérations

- `ENUM(...)` du design → `models.TextChoices` interne + `CharField(max_length=<max des valeurs>,
  choices=Xxx.choices)`. Les **valeurs** stockées sont exactement celles du SQL (MAJUSCULES :
  `'INSCRIPTION'`, `'LMD'`, `'SEPT'`, `'DEBIT'`…).
- Les référentiels extensibles par la donnée — `type_frais`, `type_piece`, `categorie_mouvement`,
  `modalite_formation` — sont de **vrais modèles** (table + FK), pas des `TextChoices`
  (cf. design D12).

### D-ORM-5 — Colonnes générées

Choix **par colonne**, à consigner dans la spec du module concerné :

- **`GeneratedField(expression=..., output_field=..., db_persist=True)`** quand l'expression est
  simple, mono-ligne et exprimable en ORM :
  `modalite_paiement.montant_total`, `affectation_enseignement.montant_prevu`,
  `billetage.montant`, `arrete_caisse.ecart`.
- **Calcul en service ou en vue, aucun champ stocké**, quand le calcul dépend d'autres lignes ou
  de règles (agrégations, `max/min`, moyennes) : `resultat_matiere.note_retenue` / `validee` /
  `credits_acquis`, `resultat_periode.moyenne_ponderee`, toutes les grandeurs des vues `v_*`
  (`avance`, `reste`, `etat_payement`, soldes, bilans). Conforme à la spec §2 (« calculées par des
  vues, jamais saisies »).
- `classe.libelle_auto` : `GeneratedField` si l'expression de concaténation reste triviale, sinon
  propriété calculée / champ rempli au `save()` du service — à trancher en P1.

### D-ORM-6 — Contraintes

- Chaque `UNIQUE (...)` composite du design → `Meta.constraints = [UniqueConstraint(fields=[...],
  name="unq_<table>_<cols>")]`.
- Chaque `CHECK` MySQL du SQL de référence → `Meta.constraints = [CheckConstraint(condition=Q(...),
  name="ck_<table>_<regle>")]` lorsqu'exprimable (ex. « exactement une des deux FK non nulle selon
  `cible` » sur `imputation_encaissement`).
- Les invariants non exprimables en `CHECK` simple (ex. « Σ pondération d'une (matiere, classe,
  session) = 100 », « Σ imputation = encaissement.montant_total ») sont validés dans le **service**
  + un **test** dédié, et documentés comme tels dans la spec du module.
- Index non-uniques du design → `Meta.indexes`.

### D-ORM-7 — `on_delete`

- Défaut : `models.RESTRICT`.
- `models.CASCADE` **uniquement** sur les filles strictes listées au design §5 :
  `imputation_encaissement`→`encaissement`, `billetage`→`arrete_caisse`,
  `note_evaluation`→`evaluation`, `affiliation`→`etudiant`, `piece_dossier`→`inscription`.
- `models.SET_NULL` (champ `null=True`) sur les FK d'audit / de traçabilité
  (`cree_par`, `modifie_par`, `deliberee_par`, `validee_par`, `fait_par`, `engage_par`,
  `valide_par`, `genere_par`, `journal_audit.utilisateur`).

### D-ORM-8 — Bloc d'audit

Mixin abstrait `Auditable` (dans `core`) : `cree_par` (FK `comptes.Utilisateur`, `SET_NULL`,
`related_name="+"`), `cree_le` (`auto_now_add`), `modifie_par`, `modifie_le` (`auto_now`).
Appliqué aux tables transactionnelles listées au design §5 (`inscription`, `frais_inscription`,
`echeance`, `encaissement`, `mouvement`, `virement`, `depense`, `salaire_enseignant`,
`salaire_administration`, `avance_personnel`, `note_evaluation`, `resultat_*`, `deliberation`,
`bourse`, `arrete_caisse`). Les colonnes techniques `cree_le`/`modifie_le` viennent **en plus** du
`journal_audit` générique (`AuditLogMixin` côté ViewSet), qui reste la trace détaillée.

### D-ORM-9 — Procédure de synchronisation (obligatoire par module)

1. `python manage.py makemigrations <app>`
2. `python manage.py sqlmigrate <app> <NNNN>` → comparer au(x) `db/migrations/00X_*.sql`
   correspondant(s) : colonnes présentes, nullabilité, longueurs `VARCHAR`, `DEFAULT`, `UNIQUE`
   composites, index, FK ciblées, `ON DELETE`, colonnes générées, `CHECK`. (Le type entier des
   PK/FK est un écart accepté — D-ORM-1.)
3. Consigner les écarts **acceptés** (et leur motif) dans la spec du module, section `Écarts au
   SQL de référence`.
4. Porter les assertions de `db/tests/test_00X_*.sql` en tests `pytest` (intégrité + règles).
5. Portes vertes : `ruff check .`, `python manage.py check`, `makemigrations --check --dry-run`,
   `pytest`, `spectacular` 0 Error.

### D-ORM-10 — Dénormalisations conservées

Les redondances voulues du design (`inscription.ecole_id` et `inscription.annee_scolaire_id`
dérivables via `classe → niveau → ecole`) sont **maintenues par le service** à la création/màj,
avec un test de cohérence. Pas de trigger SQL.

### D-ORM-11 — `derniere_connexion`

Dette existante : `Utilisateur.derniere_connexion` (design transverse) coexiste avec `last_login`
d'`AbstractBaseUser`. À résoudre hors périmètre de portage (signal `user_logged_in` qui alimente
`derniere_connexion`, ou suppression de la colonne). Ne pas ajouter d'autre colonne d'horodatage
de connexion entre-temps.

---

## 3. Impact immédiat

- `comptes` (`Utilisateur`, `Role`, `UtilisateurRole`, `JournalAudit`) : déjà en `BigAutoField`,
  `db_table` explicites, `JournalAudit` conforme → **rien à reprendre**.
- `utilisateur_role.ecole_id` (`PositiveIntegerField` sans FK) : converti en `ForeignKey(
  "referentiel.Ecole", null=True, on_delete=RESTRICT, db_index=True)` en Phase 1 (tâche P1.2).

## 4. Hors périmètre

- Réécrire `db/migrations/*.sql` pour aligner les types entiers : inutile (conception).
- Reproduire les vues `v_*` en SQL Django managé : les vues sont exposées en lecture seule
  (querysets / `django-rest-framework` sur `managed = False` ou annotations), traité au module
  « Rapports ».

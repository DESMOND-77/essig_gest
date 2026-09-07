import { z } from "zod";
import type { Descripteur } from "../descripteur";

// Un champ nombre non requis : l'input `valueAsNumber` renvoie NaN quand il est
// vide ; on l'accepte (sérialisé en `null` côté API).
const entierOptionnel = z.union([z.number().int(), z.nan()]).optional();

export const niveauDescripteur: Descripteur = {
  titre: "Niveaux",
  endpoint: "referentiel/niveaux",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "libelle", entete: "Libellé" },
    { cle: "ordre", entete: "Ordre" },
    { cle: "ecole_libelle", entete: "École" },
  ],
  filtres: [{ nom: "ecole", label: "École", fkEndpoint: "referentiel/ecoles" }],
  champs: [
    { nom: "ecole", label: "École", type: "fk", requis: true, fkEndpoint: "referentiel/ecoles", fkLabel: (o) => String(o.nom) },
    { nom: "code", label: "Code", type: "text", requis: true },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
    { nom: "ordre", label: "Ordre", type: "number", requis: true },
    { nom: "credits_requis", label: "Crédits requis", type: "number" },
    { nom: "a_soutenance", label: "Avec soutenance", type: "checkbox" },
    { nom: "a_examen_national", label: "Avec examen national", type: "checkbox" },
  ],
  schema: z.object({
    ecole: z.number({ error: "Obligatoire" }),
    code: z.string().min(1, "Obligatoire").max(10),
    libelle: z.string().min(1, "Obligatoire").max(60),
    ordre: z.number({ error: "Obligatoire" }).int(),
    credits_requis: entierOptionnel,
    a_soutenance: z.boolean().optional(),
    a_examen_national: z.boolean().optional(),
  }),
};

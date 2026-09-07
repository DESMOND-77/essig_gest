import { z } from "zod";
import type { Descripteur } from "../descripteur";

const entierOptionnel = z.union([z.number().int(), z.nan()]).optional();

export const matiereDescripteur: Descripteur = {
  titre: "Matières",
  endpoint: "referentiel/matieres",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "nom", entete: "Nom" },
    { cle: "semestre", entete: "Semestre" },
    { cle: "coefficient", entete: "Coef." },
    { cle: "niveau_libelle", entete: "Niveau" },
  ],
  filtres: [
    { nom: "niveau", label: "Niveau", fkEndpoint: "referentiel/niveaux" },
    {
      nom: "semestre",
      label: "Semestre",
      options: [
        { valeur: "S1", label: "S1" },
        { valeur: "S2", label: "S2" },
      ],
    },
  ],
  champs: [
    { nom: "niveau", label: "Niveau", type: "fk", requis: true, fkEndpoint: "referentiel/niveaux", fkLabel: (o) => String(o.code) },
    { nom: "option_filiere", label: "Option de filière", type: "fk", requis: true, fkEndpoint: "referentiel/options-filiere", fkLabel: (o) => String(o.sigle || o.nom) },
    {
      nom: "semestre",
      label: "Semestre",
      type: "select",
      requis: true,
      options: [
        { valeur: "S1", label: "S1" },
        { valeur: "S2", label: "S2" },
      ],
    },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "code", label: "Code", type: "text", requis: true },
    { nom: "coefficient", label: "Coefficient", type: "number", requis: true },
    { nom: "credits", label: "Crédits", type: "number" },
    { nom: "volume_horaire", label: "Volume horaire", type: "number", requis: true },
  ],
  schema: z.object({
    niveau: z.number({ error: "Obligatoire" }),
    option_filiere: z.number({ error: "Obligatoire" }),
    semestre: z.enum(["S1", "S2"]),
    nom: z.string().min(1, "Obligatoire").max(120),
    code: z.string().min(1, "Obligatoire").max(20),
    coefficient: z.number({ error: "Obligatoire" }).int(),
    credits: entierOptionnel,
    volume_horaire: z.number({ error: "Obligatoire" }).int(),
  }),
};

import { z } from "zod";
import type { Descripteur } from "../descripteur";

export const filiereDescripteur: Descripteur = {
  titre: "Filières",
  endpoint: "referentiel/filieres",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "sigle", entete: "Sigle" },
    { cle: "ecole_libelle", entete: "École" },
  ],
  filtres: [{ nom: "ecole", label: "École", fkEndpoint: "referentiel/ecoles" }],
  champs: [
    { nom: "ecole", label: "École", type: "fk", requis: true, fkEndpoint: "referentiel/ecoles", fkLabel: (o) => String(o.nom) },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "sigle", label: "Sigle", type: "text", requis: true },
  ],
  schema: z.object({
    ecole: z.number({ error: "Obligatoire" }),
    nom: z.string().min(1, "Obligatoire").max(80),
    sigle: z.string().min(1, "Obligatoire").max(15),
  }),
};

import { z } from "zod";
import type { Descripteur } from "../descripteur";

export const optionFiliereDescripteur: Descripteur = {
  titre: "Options de filière",
  endpoint: "referentiel/options-filiere",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "sigle", entete: "Sigle" },
    { cle: "filiere_libelle", entete: "Filière" },
  ],
  filtres: [{ nom: "filiere", label: "Filière", fkEndpoint: "referentiel/filieres" }],
  champs: [
    { nom: "filiere", label: "Filière", type: "fk", requis: true, fkEndpoint: "referentiel/filieres", fkLabel: (o) => String(o.sigle) },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "sigle", label: "Sigle", type: "text" },
  ],
  schema: z.object({
    filiere: z.number({ error: "Obligatoire" }),
    nom: z.string().min(1, "Obligatoire").max(80),
    sigle: z.string().max(15).optional().or(z.literal("")),
  }),
};

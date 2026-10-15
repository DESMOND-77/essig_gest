import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const personnelAdministratifDescripteur: Descripteur = {
  titre: "Personnel administratif",
  endpoint: "rh-paie/personnel-administratif",
  roleEcriture: ["COMPTABLE", "DAF"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "prenom", entete: "Prénom" },
    { cle: "poste", entete: "Poste" },
    { cle: "ecole_nom", entete: "École" },
    { cle: "actif", entete: "Actif" },
  ],
  filtres: [
    { nom: "ecole", label: "École", fkEndpoint: "referentiel/ecoles" },
    {
      nom: "actif",
      label: "Actif",
      options: [
        { valeur: "true", label: "Actif" },
        { valeur: "false", label: "Inactif" },
      ],
    },
  ],
  champs: [
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "prenom", label: "Prénom", type: "text", requis: true },
    { nom: "poste", label: "Poste", type: "text", requis: true },
    {
      nom: "ecole",
      label: "École",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/ecoles",
      fkLabel: (o) => String(o.nom),
    },
    { nom: "telephone", label: "Téléphone", type: "text" },
    { nom: "email", label: "Email", type: "text" },
    { nom: "salaire_base", label: "Salaire de base (FCFA)", type: "number", requis: true },
    { nom: "date_embauche", label: "Date d'embauche", type: "text" },
    { nom: "actif", label: "Actif", type: "checkbox" },
  ],
  schema: z.object({
    nom: z.string().min(1, "Obligatoire").max(60),
    prenom: z.string().min(1, "Obligatoire").max(120),
    poste: z.string().min(1, "Obligatoire").max(120),
    ecole: z.number({ error: "Obligatoire" }),
    telephone: z.string().max(60).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
    salaire_base: z.number({ error: "Obligatoire" }).min(0),
    date_embauche: z.string().optional().or(z.literal("")),
    actif: z.boolean().optional(),
  }),
};

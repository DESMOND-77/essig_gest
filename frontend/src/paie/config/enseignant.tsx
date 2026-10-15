import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const enseignantDescripteur: Descripteur = {
  titre: "Enseignants",
  endpoint: "rh-paie/enseignants",
  roleEcriture: ["COMPTABLE", "DAF"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "prenom", entete: "Prénom" },
    { cle: "statut", entete: "Statut" },
    { cle: "specialite", entete: "Spécialité" },
    { cle: "actif", entete: "Actif" },
  ],
  filtres: [
    {
      nom: "statut",
      label: "Statut",
      options: [
        { valeur: "VACATAIRE", label: "Vacataire" },
        { valeur: "PERMANENT", label: "Permanent" },
      ],
    },
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
    { nom: "telephone", label: "Téléphone", type: "text" },
    { nom: "email", label: "Email", type: "text" },
    { nom: "specialite", label: "Spécialité", type: "text" },
    {
      nom: "statut",
      label: "Statut",
      type: "select",
      requis: true,
      options: [
        { valeur: "VACATAIRE", label: "Vacataire" },
        { valeur: "PERMANENT", label: "Permanent" },
      ],
    },
    { nom: "taux_horaire", label: "Taux horaire (FCFA)", type: "number" },
    { nom: "actif", label: "Actif", type: "checkbox" },
  ],
  schema: z.object({
    nom: z.string().min(1, "Obligatoire").max(60),
    prenom: z.string().min(1, "Obligatoire").max(120),
    telephone: z.string().max(60).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
    specialite: z.string().max(120).optional().or(z.literal("")),
    statut: z.enum(["VACATAIRE", "PERMANENT"]),
    taux_horaire: z.number().min(0).optional(),
    actif: z.boolean().optional(),
  }),
};

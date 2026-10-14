import { z } from "zod";
import type { Descripteur } from "../descripteur";

export const ecoleDescripteur: Descripteur = {
  titre: "Écoles",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "logo", entete: "Logo" },
    { cle: "nom", entete: "Nom" },
    { cle: "sigle", entete: "Sigle" },
    { cle: "regime", entete: "Régime" },
  ],
  filtres: [
    {
      nom: "regime",
      label: "Régime",
      options: [
        { valeur: "LMD", label: "LMD" },
        { valeur: "CLASSIQUE", label: "Classique" },
      ],
    },
  ],
  champs: [
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "sigle", label: "Sigle", type: "text" },
    {
      nom: "regime",
      label: "Régime",
      type: "select",
      requis: true,
      options: [
        { valeur: "LMD", label: "LMD" },
        { valeur: "CLASSIQUE", label: "Classique" },
      ],
    },
    { nom: "contacts", label: "Contacts", type: "text" },
    { nom: "email", label: "Email", type: "text" },
    { nom: "adresse", label: "Adresse", type: "text" },
    { nom: "logo", label: "Logo", type: "file", aide: "PNG, JPG ou WEBP, 2 Mo maximum." },
  ],
  schema: z.object({
    nom: z.string().min(1, "Obligatoire").max(120),
    sigle: z.string().max(20).optional().or(z.literal("")),
    regime: z.enum(["LMD", "CLASSIQUE"]),
    contacts: z.string().max(120).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
    adresse: z.string().max(255).optional().or(z.literal("")),
    logo: z.unknown().optional(),
  }),
};

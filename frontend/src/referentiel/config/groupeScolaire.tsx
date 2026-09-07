import { z } from "zod";
import type { Descripteur } from "../descripteur";

export const groupeScolaireDescripteur: Descripteur = {
  titre: "Groupes scolaires",
  endpoint: "referentiel/groupes-scolaires",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "sigle", entete: "Sigle" },
    { cle: "contacts", entete: "Contacts" },
    { cle: "email", entete: "Email" },
    { cle: "adresse", entete: "Adresse" },
  ],
  champs: [
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "sigle", label: "Sigle", type: "text" },
    { nom: "contacts", label: "Contacts", type: "text" },
    { nom: "email", label: "Email", type: "text" },
    { nom: "adresse", label: "Adresse", type: "text" },
  ],
  schema: z.object({
    nom: z.string().min(1, "Obligatoire").max(120),
    sigle: z.string().max(20).optional().or(z.literal("")),
    contacts: z.string().max(120).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
    adresse: z.string().max(255).optional().or(z.literal("")),
  }),
};

import { z } from "zod";
import type { Descripteur } from "../descripteur";

export const ecoleDescripteur: Descripteur = {
  titre: "Écoles",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "sigle", entete: "Sigle" },
    { cle: "pole", entete: "Pôle" },
    { cle: "regime", entete: "Régime" },
    { cle: "groupe_scolaire_libelle", entete: "Groupe" },
  ],
  filtres: [
    { nom: "pole", label: "Pôle", options: ["ESSIG", "UPSS", "CFPA", "CICI"].map((v) => ({ valeur: v, label: v })) },
    {
      nom: "regime",
      label: "Régime",
      options: [
        { valeur: "LMD", label: "LMD" },
        { valeur: "CLASSIQUE", label: "Classique" },
      ],
    },
    { nom: "groupe_scolaire", label: "Groupe", fkEndpoint: "referentiel/groupes-scolaires" },
  ],
  champs: [
    { nom: "groupe_scolaire", label: "Groupe scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/groupes-scolaires", fkLabel: (o) => String(o.nom) },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "sigle", label: "Sigle", type: "text" },
    { nom: "pole", label: "Pôle", type: "select", requis: true, options: ["ESSIG", "UPSS", "CFPA", "CICI"].map((v) => ({ valeur: v, label: v })) },
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
  ],
  schema: z.object({
    groupe_scolaire: z.number({ error: "Obligatoire" }),
    nom: z.string().min(1, "Obligatoire").max(120),
    sigle: z.string().max(20).optional().or(z.literal("")),
    pole: z.enum(["ESSIG", "UPSS", "CFPA", "CICI"]),
    regime: z.enum(["LMD", "CLASSIQUE"]),
    contacts: z.string().max(120).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
  }),
};

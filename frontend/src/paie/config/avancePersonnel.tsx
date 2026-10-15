import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const avancePersonnelDescripteur: Descripteur = {
  titre: "Avances sur salaire",
  endpoint: "rh-paie/avances-personnel",
  roleEcriture: ["COMPTABLE", "DAF"],
  rechercheActive: false,
  colonnes: [
    { cle: "beneficiaire", entete: "Bénéficiaire" },
    { cle: "enseignant_nom", entete: "Enseignant" },
    { cle: "personnel_administratif_nom", entete: "Personnel" },
    { cle: "montant", entete: "Montant" },
    { cle: "regularisee", entete: "Régularisée" },
  ],
  filtres: [
    {
      nom: "beneficiaire",
      label: "Bénéficiaire",
      options: [
        { valeur: "ENSEIGNANT", label: "Enseignant" },
        { valeur: "ADMIN", label: "Personnel administratif" },
      ],
    },
    {
      nom: "regularisee",
      label: "Régularisée",
      options: [
        { valeur: "true", label: "Oui" },
        { valeur: "false", label: "Non" },
      ],
    },
  ],
  champs: [
    {
      nom: "beneficiaire",
      label: "Bénéficiaire",
      type: "select",
      requis: true,
      options: [
        { valeur: "ENSEIGNANT", label: "Enseignant" },
        { valeur: "ADMIN", label: "Personnel administratif" },
      ],
    },
    {
      nom: "enseignant",
      label: "Enseignant",
      type: "fk",
      fkEndpoint: "rh-paie/enseignants",
      fkLabel: (o) => `${String(o.nom)} ${String(o.prenom)}`,
    },
    {
      nom: "personnel_administratif",
      label: "Personnel administratif",
      type: "fk",
      fkEndpoint: "rh-paie/personnel-administratif",
      fkLabel: (o) => `${String(o.nom)} ${String(o.prenom)}`,
    },
    { nom: "date", label: "Date", type: "text", requis: true },
    { nom: "montant", label: "Montant (FCFA)", type: "number", requis: true },
    { nom: "motif", label: "Motif", type: "text" },
    {
      nom: "compte",
      label: "Compte",
      type: "fk",
      requis: true,
      fkEndpoint: "tresorerie/comptes",
      fkLabel: (o) => `${String(o.code)} - ${String(o.libelle)}`,
    },
  ],
  schema: z.object({
    beneficiaire: z.enum(["ENSEIGNANT", "ADMIN"]),
    enseignant: z.number().optional(),
    personnel_administratif: z.number().optional(),
    date: z.string().min(1, "Obligatoire"),
    montant: z.number({ error: "Obligatoire" }).min(0),
    motif: z.string().max(255).optional().or(z.literal("")),
    compte: z.number({ error: "Obligatoire" }),
  }),
};

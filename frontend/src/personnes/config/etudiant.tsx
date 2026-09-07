import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

const POLES = ["ESSIG", "UPSS", "CFPA", "CICI"].map((v) => ({ valeur: v, label: v }));
const SEXES = [
  { valeur: "M", label: "Masculin" },
  { valeur: "F", label: "Féminin" },
];
const MATRIMONIAL = [
  { valeur: "CELIBATAIRE", label: "Célibataire" },
  { valeur: "MARIE", label: "Marié(e)" },
  { valeur: "AUTRE", label: "Autre" },
];

export const etudiantDescripteur: Descripteur = {
  titre: "Étudiants",
  endpoint: "personnes/etudiants",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "matricule", entete: "Matricule" },
    { cle: "nom", entete: "Nom" },
    { cle: "prenoms", entete: "Prénoms" },
    { cle: "sexe", entete: "Sexe" },
    { cle: "nationalite", entete: "Nationalité" },
  ],
  filtres: [
    { nom: "sexe", label: "Sexe", options: SEXES },
    {
      nom: "a_le_bac",
      label: "BAC",
      options: [
        { valeur: "true", label: "Oui" },
        { valeur: "false", label: "Non" },
      ],
    },
  ],
  champs: [
    { nom: "pole", label: "Pôle", type: "select", requis: true, creationSeule: true, options: POLES },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "prenoms", label: "Prénoms", type: "text", requis: true },
    { nom: "sexe", label: "Sexe", type: "select", requis: true, options: SEXES },
    { nom: "date_naissance", label: "Date de naissance", type: "text", aide: "AAAA-MM-JJ" },
    { nom: "lieu_naissance", label: "Lieu de naissance", type: "text" },
    { nom: "nationalite", label: "Nationalité", type: "text" },
    { nom: "email", label: "Email", type: "text" },
    { nom: "telephone", label: "Téléphone", type: "text" },
    { nom: "adresse", label: "Adresse", type: "text" },
    { nom: "situation_matrimoniale", label: "Situation matrimoniale", type: "select", options: MATRIMONIAL },
  ],
  schema: z.object({
    pole: z.enum(["ESSIG", "UPSS", "CFPA", "CICI"]).optional(),
    nom: z.string().min(1, "Obligatoire").max(60),
    prenoms: z.string().min(1, "Obligatoire").max(120),
    sexe: z.enum(["M", "F"]),
    date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ").optional().or(z.literal("")),
    lieu_naissance: z.string().max(120).optional().or(z.literal("")),
    nationalite: z.string().max(60).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
    telephone: z.string().max(40).optional().or(z.literal("")),
    adresse: z.string().max(255).optional().or(z.literal("")),
    situation_matrimoniale: z.enum(["CELIBATAIRE", "MARIE", "AUTRE"]).optional().or(z.literal("")),
  }),
};

import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const pieceDossierDescripteur: Descripteur = {
  titre: "Pièces du dossier",
  endpoint: "personnes/pieces-dossier",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: false,
  colonnes: [
    { cle: "inscription", entete: "Inscription" },
    { cle: "type_piece", entete: "Type de pièce" },
    { cle: "fournie", entete: "Fournie", rendu: (l) => (l.fournie ? "Oui" : "Non") },
    { cle: "date_reception", entete: "Reçue le" },
  ],
  filtres: [
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
    { nom: "type_piece", label: "Type", fkEndpoint: "personnes/types-piece" },
    {
      nom: "fournie",
      label: "Fournie",
      options: [
        { valeur: "true", label: "Oui" },
        { valeur: "false", label: "Non" },
      ],
    },
  ],
  champs: [
    { nom: "inscription", label: "Inscription", type: "fk", requis: true, fkEndpoint: "personnes/inscriptions", fkLabel: (o) => `#${o.numero_ordre} — ${o.etudiant_libelle ?? o.etudiant}` },
    { nom: "type_piece", label: "Type de pièce", type: "fk", requis: true, fkEndpoint: "personnes/types-piece", fkLabel: (o) => String(o.libelle) },
    { nom: "fournie", label: "Fournie", type: "checkbox" },
    { nom: "date_reception", label: "Date de réception", type: "text", aide: "AAAA-MM-JJ" },
  ],
  schema: z.object({
    inscription: z.number({ error: "Obligatoire" }),
    type_piece: z.number({ error: "Obligatoire" }),
    fournie: z.boolean().optional(),
    date_reception: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ").optional().or(z.literal("")),
  }),
};

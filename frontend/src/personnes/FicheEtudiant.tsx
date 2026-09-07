import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { DataState } from "../components/DataState";
import { createResourceHooks } from "../lib/resource";

type Affiliation = {
  id: number;
  type: string;
  nom: string;
  prenom: string;
  contact: string;
  profession?: string | null;
};
type SituationBac = {
  a_le_bac: boolean;
  annee_obtention?: number | null;
  serie?: string | null;
  mention?: string | null;
  etablissement?: string | null;
  ville?: string | null;
} | null;
type Etudiant = Record<string, unknown> & {
  id: number;
  matricule: string;
  nom: string;
  prenoms: string;
  affiliations: Affiliation[];
  situation_bac: SituationBac;
};

const IDENTITE: [string, string][] = [
  ["matricule", "Matricule"],
  ["nom", "Nom"],
  ["prenoms", "Prénoms"],
  ["sexe", "Sexe"],
  ["date_naissance", "Date de naissance"],
  ["lieu_naissance", "Lieu de naissance"],
  ["nationalite", "Nationalité"],
  ["email", "Email"],
  ["telephone", "Téléphone"],
  ["adresse", "Adresse"],
  ["situation_matrimoniale", "Situation matrimoniale"],
];

export function FicheEtudiant() {
  const { id } = useParams();
  const hooks = useMemo(
    () => createResourceHooks<Etudiant>("personnes/etudiants"),
    [],
  );
  const { data, isLoading, isError, refetch } = hooks.useDetail(Number(id));

  if (isLoading) return <DataState statut="chargement" />;
  if (isError || !data) return <DataState statut="erreur" onReessayer={refetch} />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        {data.matricule} — {data.nom} {data.prenoms}
      </h1>

      <section>
        <h2 className="mb-2 font-medium">Identité</h2>
        <dl className="grid grid-cols-[180px_1fr] gap-y-1 text-sm">
          {IDENTITE.map(([cle, label]) => (
            <div key={cle} className="contents">
              <dt className="text-gray-500">{label}</dt>
              <dd>
                {data[cle] == null || data[cle] === "" ? "—" : String(data[cle])}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Affiliations</h2>
        {data.affiliations.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune affiliation enregistrée.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">Type</th>
                <th className="py-1">Nom</th>
                <th className="py-1">Prénom</th>
                <th className="py-1">Contact</th>
                <th className="py-1">Profession</th>
              </tr>
            </thead>
            <tbody>
              {data.affiliations.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-1">{a.type}</td>
                  <td className="py-1">{a.nom}</td>
                  <td className="py-1">{a.prenom}</td>
                  <td className="py-1">{a.contact}</td>
                  <td className="py-1">{a.profession ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Situation BAC</h2>
        {!data.situation_bac ? (
          <p className="text-sm text-gray-500">Pas d'information BAC.</p>
        ) : (
          <dl className="grid grid-cols-[180px_1fr] gap-y-1 text-sm">
            <dt className="text-gray-500">A le BAC</dt>
            <dd>{data.situation_bac.a_le_bac ? "Oui" : "Non"}</dd>
            <dt className="text-gray-500">Année</dt>
            <dd>{data.situation_bac.annee_obtention ?? "—"}</dd>
            <dt className="text-gray-500">Série</dt>
            <dd>{data.situation_bac.serie ?? "—"}</dd>
            <dt className="text-gray-500">Mention</dt>
            <dd>{data.situation_bac.mention ?? "—"}</dd>
            <dt className="text-gray-500">Établissement</dt>
            <dd>{data.situation_bac.etablissement ?? "—"}</dd>
            <dt className="text-gray-500">Ville</dt>
            <dd>{data.situation_bac.ville ?? "—"}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}

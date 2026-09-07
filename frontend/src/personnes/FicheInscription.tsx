import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { DataState } from "../components/DataState";
import { createResourceHooks } from "../lib/resource";

type Echeance = {
  id: number;
  numero: number;
  montant_prevu: string;
  date_prevue: string;
  pris_en_charge_bourse: boolean;
};
type PieceDossier = {
  id: number;
  type_piece: number;
  fournie: boolean;
  date_reception?: string | null;
};
type Inscription = Record<string, unknown> & {
  id: number;
  numero_ordre: number;
  etudiant_libelle?: string;
  classe_libelle?: string;
  type: string;
  statut: string;
  etat: string;
  est_boursier: boolean;
  date_inscription: string;
  echeances: Echeance[];
  pieces_dossier: PieceDossier[];
};

export function FicheInscription() {
  const { id } = useParams();
  const hooks = useMemo(
    () => createResourceHooks<Inscription>("personnes/inscriptions"),
    [],
  );
  const { data, isLoading, isError, refetch } = hooks.useDetail(Number(id));

  if (isLoading) return <DataState statut="chargement" />;
  if (isError || !data) return <DataState statut="erreur" onReessayer={refetch} />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        Inscription n° {data.numero_ordre} — {data.etudiant_libelle}
      </h1>
      <dl className="grid grid-cols-[180px_1fr] gap-y-1 text-sm">
        <dt className="text-gray-500">Classe</dt>
        <dd>{data.classe_libelle ?? "—"}</dd>
        <dt className="text-gray-500">Type</dt>
        <dd>{data.type}</dd>
        <dt className="text-gray-500">Statut</dt>
        <dd>{data.statut}</dd>
        <dt className="text-gray-500">État</dt>
        <dd>{data.etat}</dd>
        <dt className="text-gray-500">Boursier</dt>
        <dd>{data.est_boursier ? "Oui" : "Non"}</dd>
        <dt className="text-gray-500">Date d'inscription</dt>
        <dd>{data.date_inscription}</dd>
      </dl>

      <section>
        <h2 className="mb-2 font-medium">Échéancier</h2>
        {data.echeances.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune échéance.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">N°</th>
                <th className="py-1">Montant prévu</th>
                <th className="py-1">Date prévue</th>
                <th className="py-1">Bourse</th>
              </tr>
            </thead>
            <tbody>
              {data.echeances.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-1">{e.numero}</td>
                  <td className="py-1">{e.montant_prevu}</td>
                  <td className="py-1">{e.date_prevue}</td>
                  <td className="py-1">{e.pris_en_charge_bourse ? "Oui" : "Non"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Pièces du dossier</h2>
        {data.pieces_dossier.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune pièce enregistrée.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">Type</th>
                <th className="py-1">Fournie</th>
                <th className="py-1">Reçue le</th>
              </tr>
            </thead>
            <tbody>
              {data.pieces_dossier.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1">{p.type_piece}</td>
                  <td className="py-1">{p.fournie ? "Oui" : "Non"}</td>
                  <td className="py-1">{p.date_reception ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

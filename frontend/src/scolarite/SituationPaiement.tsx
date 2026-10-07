import React, { useMemo, useState, useEffect, useCallback } from "react";
import { DataState } from "../components/DataState";
import { createResourceHooks } from "../lib/resource";
import { useToast } from "../components/ToastProvider";

type InscriptionListe = {
  id: number;
  date_inscription: string;
  statut: string;
  etudiant: {
    id: number;
    nom: string;
    prenoms: string;
    matricule: string;
  };
  classe: {
    nom: string;
  };
  niveau: {
    code: string;
    libelle: string;
  };
  annee_scolaire: {
    libelle: string;
  };
};
type EcheanceListe = {
  id: number;
  inscription_id: number;
  numero: number;
  montant: number;
  date_echeance: string;
  date_paiement: string | null;
  montant_paye: number;
};

export function SituationPaiement() {
  const { toast } = useToast();

  // Create hook instances with useMemo for stability
  const inscriptionsHook = React.useMemo(() =>
    createResourceHooks<InscriptionListe>("personnes/inscriptions"), []);

  const echeancesHook = React.useMemo(() =>
    createResourceHooks<EcheanceListe>("scolarite/echeances"), []);

  // Call hooks directly in component body (following ResourcePage pattern)
  const inscriptionsResult = inscriptionsHook.useListe({});
  const { data: inscriptionsData, isLoading: inscriptionsLoading, isError: inscriptionsError } = inscriptionsResult;

  const echeancesResult = echeancesHook.useListe({});
  const { data: echeancesData, isLoading: echeancesLoading, isError: echeancesError } = echeancesResult;

  // State for our component
  const [inscriptions, setInscriptions] = useState<InscriptionListe[]>([]);
  const [echeances, setEcheances] = useState<EcheanceListe[]>([]);
  const [isComponentLoading, setIsComponentLoading] = useState<boolean>(true);
  const [isComponentError, setIsComponentError] = useState<boolean>(false);

  // Update state when hook data changes
  useEffect(() => {
    if (inscriptionsData?.results) {
      setInscriptions(inscriptionsData.results);
    }
  }, [inscriptionsData?.results]);

  useEffect(() => {
    if (echeancesData?.results) {
      setEcheances(echeancesData.results);
    }
  }, [echeancesData?.results]);

  // Update loading/error states
  useEffect(() => {
    const isLoading = inscriptionsLoading || echeancesLoading;
    const hasError = inscriptionsError || echeancesError;

    setIsComponentLoading(isLoading);
    setIsComponentError(hasError);

    if (hasError) {
      toast("Impossible de charger les données de situation de paiement");
    }
  }, [inscriptionsLoading, echeancesLoading, inscriptionsError, echeancesError, toast]);

  // Calculate payment situation for each inscription
  const situationsPaiement = useMemo(() => {
    // Group écheances by inscription
    const echeancesParInscription: Record<number, EcheanceListe[]> = {};
    echeances.forEach(echeance => {
      if (!echeancesParInscription[echeance.inscription_id]) {
        echeancesParInscription[echeance.inscription_id] = [];
      }
      echeancesParInscription[echeance.inscription_id].push(echeance);
    });

    return inscriptions.map(inscription => {
      const listeEcheances = echeancesParInscription[inscription.id] || [];

      const totalDu = listeEcheances.reduce((sum, e) => sum + e.montant, 0);
      const totalPaye = listeEcheances.reduce((sum, e) => sum + e.montant_paye, 0);
      const resteAPayer = totalDu - totalPaye;

      // Determine global status
      let statutGlobal: string;
      if (listeEcheances.length === 0) {
        statutGlobal = "Sans échéance";
      } else if (totalPaye === 0) {
        statutGlobal = "Impayé";
      } else if (totalPaye >= totalDu) {
        statutGlobal = "Payé";
      } else {
        statutGlobal = "Partiellement payé";
      }

      return {
        ...inscription,
        totalDu,
        totalPaye,
        resteAPayer,
        statutGlobal,
        echeances: listeEcheances
      };
    });
  }, [inscriptions, echeances]);

  // Refresh data
  const loadData = useCallback(async () => {
    try {
      inscriptionsHook.useListe({}).refetch();
      echeancesHook.useListe({}).refetch();
    } catch (error) {
      toast("Une erreur est survenue lors du chargement des données");
    }
  }, [toast]);

  if (isComponentLoading) {
    return <DataState statut="chargement" />;
  }

  if (isComponentError) {
    return <DataState statut="erreur" onReessayer={loadData} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Situation de paiement</h1>
        <div className="flex space-x-2">
          <button
            onClick={loadData}
            className="btn btn-sm btn-outline"
          >
            Actualiser
          </button>
        </div>
      </div>

      {situationsPaiement.length === 0 ? (
        <DataState statut="vide" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Étudiant
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Classe
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Inscription
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Total dû
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Total payé
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Reste à payer
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Statut
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Détails
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {situationsPaiement.map((situation, _) => (
                <tr key={situation.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {situation.etudiant.nom} {situation.etudiant.prenoms}
                    <br />
                    <span className="text-xs text-gray-500">({situation.etudiant.matricule})</span>
                  </td>
                  <td className="py-3 px-4">
                    {situation.classe.nom}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">#{situation.id}</span><br />
                    <span className="text-xs">{situation.date_inscription}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {situation.totalDu.toLocaleString()} FCFA
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {situation.totalPaye.toLocaleString()} FCFA
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    <span className={situation.resteAPayer > 0 ? "text-red-600" : "text-green-600"}>
                      {situation.resteAPayer.toLocaleString()} FCFA
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={
                      situation.statutGlobal === "Payé" ? "text-green-600" :
                      situation.statutGlobal === "Partiellement payé" ? "text-yellow-600" :
                      situation.statutGlobal === "Impayé" ? "text-red-600" :
                      situation.statutGlobal === "Sans échéance" ? "text-gray-500" :
                      "text-gray-600"
                    }>
                      {situation.statutGlobal}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      className="btn btn-xs btn-outline"
                      title="Voir détail"
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
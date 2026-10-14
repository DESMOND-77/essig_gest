import React, { useState, useEffect } from "react";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { useSearchParams } from "react-router-dom";
import { obtenirTableauBordTresorerie } from "../../lib/tresorerie";
import { Chip } from "../../components/Chip";

export const TableauBord = () => {
  const { utilisateur } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Default filters
  const filters = {
    jours: parseInt(searchParams.get('jours') || '30', 10),
    ecoleId: searchParams.get('ecoleId') || undefined,
    anneeScolaireId: searchParams.get('anneeScolaireId') || undefined,
    compteId: searchParams.get('compteId') || undefined,
    limiteMontant: parseInt(searchParams.get('limiteMontant') || '1000', 10),
    limit: parseInt(searchParams.get('limit') || '10', 10),
  };

  const [tableauBordData, setTableauBordData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      setIsError(null);
      try {
        // We'll call our aggregation function that now includes solde par compte
        const data = await obtenirTableauBordTresorerie();
        if (isMounted) {
          setTableauBordData(data);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setIsError(error.message);
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [filters.jours, filters.ecoleId, filters.anneeScolaireId, filters.compteId, filters.limiteMontant, filters.limit]);

  if (isLoading) {
    return <div className="text-center py-8">Chargement du tableau de bord...</div>;
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p>Erreur lors du chargement du tableau de bord</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded border px-3 py-1 text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!tableauBordData) {
    return <div className="text-center py-8">Aucune donnée disponible</div>;
  }

  // We'll destructure the data, but we'll check for existence
  const {
    soldeParType = {},
    soldeParCompte = [],
    flux = { entrants: 0, sortants: 0, net: 0 },
    encaissementsRecents = [],
    depensesRecentes = [],
    ecartsCaisse = [],
    previsionnel = {},
  } = tableauBordData;

  // We'll compute alertes based on the data (simple example)
  const alertes = [];

  // Solde négatif par compte
  soldeParCompte.forEach((compte) => {
    if (compte.solde < 0) {
      alertes.push({
        type: "compte_negatif",
        message: `Le compte ${compte.compte_libelle} a un solde négatif`,
        compte_code: compte.compte_code,
        solde: compte.solde,
      });
    }
  });

  // Écarts de caisse importants (already filtered by backend, but we can add if ecart != 0)
  ecartsCaisse.forEach((ecart) => {
    if (ecart.ecart !== 0) {
      alertes.push({
        type: "ecart_caisse",
        message: `Écart de caisse détecté pour l'arrêté du ${ecart.date}`,
        arrete_id: ecart.id,
        ecart: ecart.ecart,
      });
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord de la trésorerie</h1>

      {/* Filtres */}
      <section className="border rounded p-6 mb-4">
        <h2 className="mb-4 font-semibold">Filtres</h2>
        <div className="grid grid-cols-[200px_1fr_200px_1fr_200px_1fr_200px_1fr_200px_1fr] gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Période (jours)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={filters.jours}
              onChange={(e) => {
                const valeur = parseInt(e.target.value, 10);
                if (!isNaN(valeur)) {
                  const queryParams = new URLSearchParams(searchParams);
                  queryParams.set('jours', valeur.toString());
                  window.history.replaceState(null, '', `${window.location.pathname}?${queryParams}`);
                }
              }}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Compte (ID)</label>
            <input
              type="number"
              min="1"
              value={filters.compteId || ''}
              onChange={(e) => {
                const valeur = e.target.value;
                const queryParams = new URLSearchParams(searchParams);
                if (valeur) {
                  queryParams.set('compteId', valeur);
                } else {
                  queryParams.delete('compteId');
                }
                window.history.replaceState(null, '', `${window.location.pathname}?${queryParams}`);
              }}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Limite d'écard (FCFA)</label>
            <input
              type="number"
              min="0"
              value={filters.limiteMontant}
              onChange={(e) => {
                const valeur = parseInt(e.target.value, 10);
                if (!isNaN(valeur)) {
                  const queryParams = new URLSearchParams(searchParams);
                  queryParams.set('limiteMontant', valeur.toString());
                  window.history.replaceState(null, '', `${window.location.pathname}?${queryParams}`);
                }
              }}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de récents</label>
            <input
              type="number"
              min="1"
              value={filters.limit}
              onChange={(e) => {
                const valeur = parseInt(e.target.value, 10);
                if (!isNaN(valeur)) {
                  const queryParams = new URLSearchParams(searchParams);
                  queryParams.set('limit', valeur.toString());
                  window.history.replaceState(null, '', `${window.location.pathname}?${queryParams}`);
                }
              }}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
        </div>
      </section>

      {/* Soldes par compte */}
      <section className="border rounded p-6">
        <h2 className="mb-4 font-semibold">Soldes par compte</h2>
        {soldeParCompte.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun compte trouvé.</p>
        ) : (
          <div className="space-y-2">
            {soldeParCompte.map((compte) => (
              <div key={compte.compte_code} className="flex justify-between items-center">
                <span className="font-medium">{compte.compte_libelle || compte.compte_code}</span>
                <span className={compte.solde < 0 ? "font-medium text-red-600" : "font-medium text-green-600"}>
                  {compte.solde.toLocaleString()} FCFA
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Soldes par type de compte */}
      <section className="border rounded p-6">
        <h2 className="mb-4 font-semibold">Soldes par type de compte</h2>
        {Object.keys(soldeParType).length === 0 ? (
          <p className="text-sm text-gray-500">Aucun type de compte trouvé.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(soldeParType).map(([type, solde]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="font-medium">{type}</span>
                <span className={parseFloat(solde) < 0 ? "font-medium text-red-600" : "font-medium text-green-600"}>
                  {parseFloat(solde).toLocaleString()} FCFA
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Entrées, sorties et flux net */}
      <section className="border rounded p-6">
        <h2 className="mb-4 font-semibold">Entrées, sorties et flux net (dernières {filters.jours} jours)</h2>
        <div class="grid grid-cols-[200px_1fr_200px_1fr_200px_1fr] gap-4">
          <div>
            <span className="font-medium">Entrées :</span>
            <span className="font-medium text-green-600">{flux.entrants.toLocaleString()} FCFA</span>
          </div>
          <div>
            <span className="font-medium">Sorties :</span>
            <span className="font-medium text-red-600">{flux.sortants.toLocaleString()} FCFA</span>
          </div>
          <div>
            <span className="font-medium">Net :</span>
            <span className={flux.net < 0 ? "font-medium text-red-600" : "font-medium text-green-600"}>
              {flux.net.toLocaleString()} FCFA
            </span>
          </div>
        </div>
      </section>

      {/* Encaissements récents */}
      <section className="border rounded p-6">
        <h2 className="mb-4 font-semibold">Encaissements récents (derniers {filters.limit})</h2>
        {encaissementsRecents.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun encaissement récent.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Montant</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Numéro de reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {encaissementsRecents.map((encaissement) => (
                <tr key={encaissement.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">{encaissement.date}</td>
                  <td className="py-3 px-4 text-right font-medium">{encaissement.montant_total.toLocaleString()} FCFA</td>
                  <td className="py-3 px-4">{encaissement.recu_numero || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Dépenses récentes */}
      <section className="border rounded p-6">
        <h2 className="mb-4 font-semibold">Dépenses récentes (dernières {filters.limit})</h2>
        {depensesRecentes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune dépense récente.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Montant</th>
                <th className="px-2 py-4 text-left text-xs font-medium text-gray-500">Désignation</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {depensesRecentes.map((depense) => (
                <tr key={depense.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">{depense.date}</td>
                  <td className="py-3 px-4 text-right font-medium">{depense.montant.toLocaleString()} FCFA</td>
                  <td className="py-3 px-4">{depense.designation || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Écarts de caisse importants */}
      <section className="border rounded p-6">
        <h2 className="mb-4 font-semibold">Écarts de caisse importants ({filters.limiteMontant} FCFA)</h2>
        {ecartsCaisse.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun écart de caisse important.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Compte</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">Écart (FCFA)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ecartsCaisse.map((ecart) => (
                <tr key={ecart.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">{ecart.date}</td>
                  <td className="py-3 px-4">{ecart.compte_libelle}</td>
                  <td className={ecart.ecart < 0 ? "font-medium text-red-600" : ecart.ecart > 0 ? "font-medium text-green-600" : "font-medium text-gray-600"}>
                    {ecart.ecart.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Alertes */}
      {alertes.length > 0 && (
        <section className="border rounded p-6">
          <h2 className="mb-4 font-semibold">Alertes</h2>
          <div className="space-y-2">
            {alertes.map((alerte, index) => (
              <div key={index} className="border rounded p-4">
                <div className="flex items-start">
                  <Chip
                    variante={alerte.type === "compte_negatif" ? "error" : alerte.type === "ecart_caisse" ? "warning" : "info"}
                    label={alerte.type}
                  />
                  <span className="ml-3">{alerte.message}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
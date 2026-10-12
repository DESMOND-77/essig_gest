import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { messageErreur } from "../../lib/errors";
import { Chip } from "../../components/Chip";
import { createResourceHooks } from "../../lib/resource";
import { enregistrerBilletageBatch } from "../../lib/tresorerie";

type BilletageLigne = {
  denomination: number; // FCFA, positive integer
  quantite: number; // integer >= 0
};

// Create resource hooks outside the component to ensure they're stable
const arreteCaisseHooks = createResourceHooks("arretes-caisse");

export const BilletageForm = () => {
  const { arreteId } = useParams<{ arreteId: string }>();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { toast } = useToast();

  const [lignes, setLignes] = useState<BilletageLigne[]>([{ denomination: 0, quantite: 0 }]);
  const [totalBilletage, setTotalBilletage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Loading states
  const isLoading = isSubmitting || isLoadingDetail;

  // Use resource hooks for arretes-caisse to fetch detail
  const detalleId = arreteId ? Number(arreteId) : undefined;
  // Using type assertion as useDetail handles undefined id via its enabled flag (Number.isFinite(id))
  const { data: arreteCaisseDetail, isLoading: isLoadingDetail, isError: isErrorDetail } = arreteCaisseHooks.useDetail(
    detalleId as number
  );

  // Extract solde physique and statut from detail
  const solde_physique = arreteCaisseDetail?.solde_physique ?? null;
  const statutArrete = arreteCaisseDetail?.statut ?? undefined;

  // Calculate total billetage
  useEffect(() => {
    const total = lignes.reduce((sum, ligne) => sum + ligne.denomination * ligne.quantite, 0);
    setTotalBilletage(total);
  }, [lignes]);

  // Validate that total billetage matches solde physique
  const validationError =
    solde_physique !== null && totalBilletage !== solde_physique
      ? `Le total du billetage (${totalBilletage.toLocaleString()} FCFA) ne correspond pas au solde physique de l'arrêté (${solde_physique.toLocaleString()} FCFA)`
      : "";

  // Check if the arrete caisse is editable
  const estEditable = statutArrete === "OUVERT" || statutArrete === "EN_COURS";

  const handleAddLigne = () => {
    setLignes([...lignes, { denomination: 0, quantite: 0 }]);
  };

  const handleRemoveLigne = (index: number) => {
    if (lignes.length > 1) {
      setLignes(lignes.filter((_, i) => i !== index));
    }
  };

  const handleChangeDenomination = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      const newLignes = [...lignes];
      newLignes[index] = { ...newLignes[index], denomination: num };
      setLignes(newLignes);
    }
  };

  const handleChangeQuantite = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      const newLignes = [...lignes];
      newLignes[index] = { ...newLignes[index], quantite: num };
      setLignes(newLignes);
    }
  };

  const handleSubmit = async () => {
    if (validationError) {
      toast(validationError, "erreur");
      return;
    }

    if (!estEditable) {
      toast("L'arrêté de caisse n'est plus éditable", "erreur");
      return;
    }

    if (!arreteId) {
      toast("ID d'arrêté de caisse manquant", "erreur");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the batch billetage endpoint using the service
      const arreteIdNum = Number(arreteId);
      await enregistrerBilletageBatch(arreteIdNum, lignes);

      toast("Billetage enregistré avec succès");
      // Navigate back to the arrete caisse detail
      navigate(`/tresorerie/arretes-caisse/${arreteId}`);
    } catch (error: any) {
      // Handle error from the service
      if (error.status === 400 && error.payload) {
        // Handle validation errors from the backend
        toast(messageErreur(error.status, error.payload), "erreur");
      } else {
        toast(messageErreur(error.status ?? 500, error.payload ?? null), "erreur");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (isErrorDetail) {
    return <div>Erreur de chargement de l'arrêté de caisse</div>;
  }

  if (!arreteId) {
    return <div>ID d'arrêté de caisse manquant</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Saisie du billetage</h1>
      <div className="mb-4">
        <h2 className="mb-2 font-semibold">Arrêté de caisse #{arreteId}</h2>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="font-semibold mr-2">Statut :</span>
            <Chip
              variante={statutArrete === "VALIDE" ? "success" : statutArrete === "OUVERT" ? "warning" : "info"}
              label={statutArrete || "—"}
            />
          </div>
          <div className="flex items-center">
            <span className="font-semibold mr-2">Solde physique :</span>
            <span className="font-mono">{solde_physique !== null ? solde_physique.toLocaleString() + " FCFA" : "—"}</span>
          </div>
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="bg-red-50 rounded p-4">
          <h2 className="mb-2 font-medium">Erreur de validation</h2>
          <p className="text-sm">{validationError}</p>
        </div>
      )}

      {/* Editable warning */}
      {!estEditable && (
        <div className="bg-yellow-50 rounded p-4">
          <h2 className="mb-2 font-medium">Attention</h2>
          <p className="text-sm">
            L'arrêté de caisse n'est plus éditable. Vous ne pouvez pas modifier le billetage.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="mb-2 font-medium">Lignes de billetage</h2>
        {lignes.map((ligne, index) => (
          <div key={index} className="border rounded p-4 mb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium">Ligne {index + 1}</h3>
              <button
                type="button"
                onClick={() => handleRemoveLigne(index)}
                disabled={lignes.length === 1}
                className="rounded border px-2 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Supprimer
              </button>
            </div>
            <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-4">
              <div>
                <label className="text-sm font-medium" htmlRef={`denomination-${index}`}>
                  Dénomination (FCFA)
                </label>
                <input
                  id={`denomination-${index}`}
                  type="number"
                  min={0}
                  step={1}
                  value={ligne.denomination}
                  onChange={(e) => handleChangeDenomination(index, e.target.value)}
                  className="rounded border px-2 py-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlRef={`quantite-${index}`}>
                  Quantité
                </label>
                <input
                  id={`quantite-${index}`}
                  type="number"
                  min={0}
                  step={1}
                  value={ligne.quantite}
                  onChange={(e) => handleChangeQuantite(index, e.target.value)}
                  className="rounded border px-2 py-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Montant (FCFA)</label>
                <span className="font-mono">
                  {(ligne.denomination * ligne.quantite).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAddLigne}
            disabled={!estEditable}
            className="rounded border px-3 py-1 text-sm"
          >
            Ajouter une ligne
          </button>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 font-medium">Total du billetage</h2>
          <p className="text-lg font-semibold">{totalBilletage.toLocaleString()} FCFA</p>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !estEditable || !!validationError}
            className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
          >
            Enregistrer le billetage
          </button>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { creerEncaissement, obtenirEncaissement, annulerEncaissement, validerEncaissement, calculerResteDuInscription } from "../../lib/tresorerie";
import { messageErreur } from "../../lib/errors";
import { z } from "zod";
import { encaissementDescripteur } from "../config/encaissement";
import { Chip } from "../../components/Chip";
import { createResourceHooks } from "../../lib/resource";

type EncaissementValues = z.infer<typeof encaissementDescripteur.schema>;

// Create resource hooks outside the component to ensure they're stable
const encaissementHooks = createResourceHooks("encaissements");
const inscriptionHooks = createResourceHooks("personnes/inscriptions");
const compteHooks = createResourceHooks("comptes");

export const EncaissementForm = () => {
  const { utilisateur } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const { mutateAsync: createEncaissementMutation } = encaissementHooks.useCreer();
  const { mutateAsync: updateEncaissementMutation } = encaissementHooks.useModifier();

  const [encaissementId, setEncaissementId] = useState<number | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [inscriptionId, setInscriptionId] = useState<number | undefined>(undefined);
  const [resteDu, setResteDu] = useState<number | null>(null);

  // Fetch the encaissement detail for display after creation/update or for edit mode
  // Using type assertion as useDetail handles undefined id via its enabled flag (Number.isFinite(id))
  const { data: detalle, isLoading: isLoadingDetalle, isError: isErrorDetalle, refetch: refetchDetalle } =
    encaissementHooks.useDetail(encaissementId ?? undefined as number);

  const encaissementData = detalle;

  // Fetch inscriptions for the select
  const { data: inscriptionsData, isLoading: isLoadingInscriptions } = inscriptionHooks.useListe();

  // Fetch comptes for the select
  const { data: comptesData, isLoading: isLoadingComptes } = compteHooks.useListe();

  // Fetch reste du when inscriptionId changes
  const fetchResteDu = useCallback(async (id: number) => {
    try {
      const reste = await calculerResteDuInscription(id);
      setResteDu(reste);
    } catch (error) {
      console.error(error);
      setResteDu(null);
      toast("Erreur lors du chargement du reste dû", "erreur");
    }
  }, [toast]);

  const onInscriptionChange = (value: string) => {
    const id = Number(value);
    setInscriptionId(id);
    if (!isNaN(id)) {
      fetchResteDu(id);
    } else {
      setResteDu(null);
    }
  };

  // Determine if we are in edit mode based on routeId
  // Using useEffect to avoid calling setState during render
  useEffect(() => {
    if (routeId && routeId !== "nouveau") {
      const id = Number(routeId);
      if (!isNaN(id)) {
        setIsEditMode(true);
        setEncaissementId(id);
      } else {
        setIsEditMode(false);
        setEncaissementId(undefined);
      }
    } else {
      setIsEditMode(false);
      setEncaissementId(undefined);
    }
  }, [routeId]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EncaissementValues>({
    resolver: zodResolver(encaissementDescripteur.schema as z.ZodType<EncaissementValues, any, any>),
    defaultValues: {
      inscription: undefined,
      date: undefined,
      montant_total: undefined,
      mode: undefined,
      compte: undefined,
      reference: undefined,
    },
  });

  // Populate form when we have the encaissement data in edit mode
  useEffect(() => {
    if (isEditMode && encaissementData) {
      // Strip non-editable fields (those not in the schema)
      const { statut, recu_numero, mouvement, ...editableData } = encaissementData;
      // Also remove any other fields not in the schema (like engag_par, etc.) but they are not in the model for encaissement?
      // We'll rely on the schema to validate.
      // Reset the form with the editable data
      reset(editableData as EncaissementValues);
      setInscriptionId(editableData.inscription);
      if (editableData.inscription) {
        fetchResteDu(editableData.inscription);
      }
    }
  }, [isEditMode, encaissementData, fetchResteDu]); // reset is stable, no need in deps

  const onSubmit: SubmitHandler<EncaissementValues> = async (data) => {
    try {
      if (isEditMode && encaissementId) {
        // Update existing encaissement
        await updateEncaissementMutation({
          id: encaissementId,
          corps: data as Partial<EncaissementValues>,
        });
        toast("Encaissement mis à jour avec succès");
        // Navigate back to the list or detail? We'll stay on the same page and refetch.
        await refetchDetalle();
      } else {
        // Create new encaissement
        const newEncaissement = await createEncaissementMutation(data);
        setEncaissementId(newEncaissement.id);
        toast("Encaissement créé avec succès");
        // After creation, we can navigate to the detail page? Or stay and show the detail.
        // We'll stay and show the detail (already handled by setting encaissementId).
        // Optionally, we can navigate to the detail page to avoid resubmission on refresh.
        // navigate(`/tresorerie/encaissements/${newEncaissement.id}`);
        // For now, we'll just show the detail.
      }
    } catch (e) {
      const err = e as { status?: number; payload?: Record<string, unknown> };
      if (err.status === 400 && err.payload) {
        for (const [champ, msg] of Object.entries(champErreurs(err.payload))) {
          setError(champ as never, { message: msg });
        }
      } else {
        toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
      }
    }
  };

  // Check if the user can validate or annuler
  const peutValiderOuAnnuler = useMemo(() => {
    if (!utilisateur?.roles) return false;
    const roles = utilisateur.roles;
    // Check if the user has COMPTABLE or DAF role
    return roles.includes("COMPTABLE") || roles.includes("DAF");
  }, [utilisateur?.roles]);

  const statut = encaissementData?.statut;
  const peutValider = peutValiderOuAnnuler && statut === "EN_COURS";
  const peutAnnuler = peutValiderOuAnnuler && statut === "EN_COURS";

  const handleValider = async () => {
    try {
      if (!encaissementId) return;
      await validerEncaissement(encaissementId);
      await refetchDetalle();
      toast("Encaissement validé");
    } catch (error) {
      toast("Erreur lors de la validation", "erreur");
    }
  };

  const handleAnnuler = async () => {
    try {
      if (!encaissementId) return;
      await annulerEncaissement(encaissementId);
      await refetchDetalle();
      toast("Encaissement annulé");
    } catch (error) {
      toast("Erreur lors de l'annulation", "erreur");
    }
  };

  const isLoading =
    isSubmitting ||
    isLoadingInscriptions ||
    isLoadingComptes ||
    isLoadingDetalle;

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (isErrorDetalle) {
    return <div>Erreur de chargement</div>;
  }

  // Calculate payment treatment message
  const paiementMessage = useMemo(() => {
    if (!encaissementData) return null;
    const montantTotal = encaissementData.montant_total;
    const imputations = encaissementData.imputations || [];
    const sommeImputations = imputations.reduce((sum, imp) => sum + imp.montant, 0);
    if (sommeImputations < montantTotal) {
      const restant = montantTotal - sommeImputations;
      return `Paiement partiel : reste à imputer ${restant.toLocaleString()} FCFA`;
    } else if (sommeImputations > montantTotal) {
      const tropPercu = sommeImputations - montantTotal;
      return `Trop-perçu : ${tropPercu.toLocaleString()} FCFA à rembourser`;
    } else {
      return "Paiement exact";
    }
  }, [encaissementData]);

  const formTitle = isEditMode ? "Modifier l'encaissement" : "Nouvel encaissement";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{formTitle}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="inscription">
            Inscription
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="inscription"
            {...register("inscription", {
              valueAsNumber: true,
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
            onChange={(e) => onInscriptionChange(e.target.value)}
          >
            <option value="">—</option>
            {inscriptionsData?.results?.map((inscription: any) => (
              <option key={inscription.id} value={inscription.id}>
                N°{inscription.numero_ordre} - {inscription.etudiant?.numero_ordre} ({inscription.etudiant?.personne?.nom} {inscription.etudiant?.personne?.prenom})
              </option>
            ))}
          </select>
          {errors.inscription && (
            <span className="text-xs text-red-600">{errors.inscription.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="date">
            Date
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="date"
            type="text"
            {...register("date", {
              pattern: {
                value: /^\d{4}-\d{2}-\d{2}$/,
                message: "Format AAAA-MM-JJ",
              },
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
            placeholder="AAAA-MM-JJ"
          />
          {errors.date && (
            <span className="text-xs text-red-600">{errors.date.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="montant_total">
            Montant total (FCFA)
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="montant_total"
            type="number"
            {...register("montant_total", {
              valueAsNumber: true,
              min: 1,
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
          />
          {errors.montant_total && (
            <span className="text-xs text-red-600">{errors.montant_total.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="mode">
            Mode de paiement
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="mode"
            {...register("mode", { required: "Obligatoire" })}
            className="rounded border px-2 py-1"
          >
            <option value="">—</option>
            {encaissementDescripteur.champs
              .find((c) => c.nom === "mode")!
              .options!.map((opt) => (
                <option key={opt.valeur} value={opt.valeur}>
                  {opt.label}
                </option>
              ))}
          </select>
          {errors.mode && (
            <span className="text-xs text-red-600">{errors.mode.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="compte">
            Compte de crédit
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="compte"
            {...register("compte", {
              valueAsNumber: true,
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
          >
            <option value="">—</option>
            {comptesData?.results?.map((compte: any) => (
              <option key={compte.id} value={compte.id}>
                {compte.code} - {compte.libelle}
              </option>
            ))}
          </select>
          {errors.compte && (
            <span className="text-xs text-red-600">{errors.compte.message}</span>
          )}
        </div>

        {/* Reference field (optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reference">
            Référence de paiement
          </label>
          <input
            id="reference"
            type="text"
            {...register("reference")}
            className="rounded border px-2 py-1"
          />
          {errors.reference && (
            <span className="text-xs text-red-600">{errors.reference.message}</span>
          )}
        </div>

        {/* Submit button */}
        <div className="space-y-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`rounded bg-gray-800 px-3 py-1 text-sm text-white ${
              isEditMode ? "" : ""
            }`}
          >
            {isEditMode ? "Mettre à jour" : "Créer l'encaissement"}
          </button>
        </div>
      </form>

      {/* Reste dû informatif */}
      {inscriptionId !== undefined && resteDu !== null && (
        <div className="bg-blue-50 rounded p-4">
          <h2 className="mb-2 font-medium">Reste dû pour l'inscription</h2>
          <p className="text-lg font-semibold">{resteDu.toLocaleString()} FCFA</p>
        </div>
      )}

      {/* Payment treatment message */}
      {paiementMessage && (
        <div className="bg-yellow-50 rounded p-4">
          <p className="text-sm font-medium">{paiementMessage}</p>
        </div>
      )}

      {/* Display the created encaissement details */}
      {encaissementId && encaissementData && (
        <section className="border rounded p-6">
          <h2 className="mb-4 font-semibold">{isEditMode ? "Encaissement modifié" : "Encaissement créé"}</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <span className="font-semibold mr-2">Numéro de reçu :</span>
              <span className="bg-gray-200 rounded px-3 py-1 text-sm">
                {encaissementData.recu_numero || "—"}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Statut :</span>
              <Chip
                variante={statut === "VALIDE" ? "success" : statut === "EN_COURS" ? "warning" : "error"}
                label={statut || "—"}
              />
            </div>
          </div>

          {/* Imputations */}
          {encaissementData.imputations && encaissementData.imputations.length > 0 && (
            <>
              <h3 className="mb-2 font-medium">Imputations</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Échéance</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Frais d'inscription</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Montant imputé (FCFA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {encaissementData.imputations.map((imputation) => (
                    <tr key={imputation.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {imputation.echeance_libelle || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {imputation.frais_inscription_libelle || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {imputation.montant.toLocaleString()} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Actions: Valider and Annuler */}
          {peutValiderOuAnnuler && (
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={handleAnnuler}
                disabled={isSubmitting}
                className="rounded border px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleValider}
                disabled={isSubmitting || !peutValider}
                className={`rounded bg-gray-800 px-3 py-1 text-sm text-white ${
                  !peutValider ? "opacity-50" : ""
                }`}
              >
                Valider
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

// Helper function to extract field errors from payload
function champErreurs(payload: Record<string, unknown>): Record<string, string> {
  // Assuming the payload is an object with field names as keys and error messages as strings
  // Adjust according to the actual error format from the backend
  const errors: Record<string, string> = {};
  for (const key in payload) {
    if (typeof payload[key] === "string") {
      errors[key] = payload[key];
    }
  }
  return errors;
}
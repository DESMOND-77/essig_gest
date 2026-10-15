import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { z } from "zod";
import { virementDescripteur } from "../config/virement";
import { Chip } from "../../components/Chip";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  creerVirement,
  engagerVirement,
  validerVirement,
  annulerVirement,
  obtenirVirement,
  listerComptes
} from "../../lib/tresorerie";
import { messageErreur } from "../../lib/errors";

// Define Variante type to match Chip component
type Variante = "success" | "warning" | "error" | "info";

type VirementValues = z.infer<typeof virementDescripteur.schema>;

export const VirementForm = () => {
  const { utilisateur } = useAuth();
  const { toast } = useToast();
  const [virementId, setVirementId] = useState<number | undefined>(undefined);
  const [comptes, setComptes] = useState<Array<{ id: number; code: string; libelle: string }>>([]);
  const [loadingComptes, setLoadingComptes] = useState<boolean>(true);
  const [virementDetail, setVirementDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Fetch comptes for selects
  useEffect(() => {
    const fetchComptes = async () => {
      setLoadingComptes(true);
      try {
        const data = await listerComptes();
        // Assuming data is an array of compte objects with id, code, libelle
        setComptes(data);
      } catch (error) {
        toast("Erreur lors du chargement des comptes", "erreur");
        console.error(error);
      } finally {
        setLoadingComptes(false);
      }
    };
    fetchComptes();
  }, [toast]);

  // Fetch virement detail when virementId changes
  useEffect(() => {
    if (virementId !== undefined) {
      const fetchDetail = async () => {
        setLoadingDetail(true);
        setErrorDetail(null);
        try {
          const data = await obtenirVirement(virementId);
          setVirementDetail(data);
        } catch (error) {
          setErrorDetail("Erreur lors du chargement du virement");
          console.error(error);
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchDetail();
    }
  }, [virementId, toast]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState,
  } = useForm<VirementValues>({
    resolver: zodResolver(virementDescripteur.schema as z.ZodType<VirementValues, any, any>),
    defaultValues: {
      compte_source: undefined,
      compte_destination: undefined,
      montant: undefined,
      date: undefined,
      motif: undefined,
    },
  });

  const onSubmit: SubmitHandler<VirementValues> = async (data) => {
    try {
      // Validation: comptes distincts (also done by schema refine)
      if (data.compte_source === data.compte_destination) {
        toast("Le compte source et le compte destination doivent être différents", "erreur");
        return;
      }
      const newVirement = await creerVirement(data);
      setVirementId(newVirement.id);
      toast("Virement créé avec succès");
      reset();
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

  // Helper to extract field errors from payload
  const champErreurs = (payload: Record<string, unknown>): Record<string, string> => {
    const errors: Record<string, string> = {};
    for (const key in payload) {
      if (typeof payload[key] === "string") {
        errors[key] = payload[key];
      }
    }
    return errors;
  };

  // Permission d'écriture indicative côté UI uniquement ; le backend revérifie tout
  // (TresoreriePermission pour engager, TresorerieValidationPermission pour valider/annuler).
  const roles = utilisateur?.roles ?? [];
  const peutEcrire = roles.includes("COMPTABLE") || roles.includes("DAF");

  // Flux maker-checker à 3 étapes : BROUILLON -> (engager) -> EN_ATTENTE_VALIDATION ->
  // (valider, crée les mouvements) -> VALIDE. `annuler` est possible depuis n'importe quel
  // statut sauf ANNULE lui-même.
  const statut = virementDetail?.statut;
  const peutEngagerVirement = peutEcrire && statut === "BROUILLON";
  const peutValiderVirement = peutEcrire && statut === "EN_ATTENTE_VALIDATION";
  const peutAnnulerVirement = peutEcrire && statut !== undefined && statut !== "ANNULE";

  const handleEngager = async () => {
    if (!virementId) return;
    try {
      const updatedData = await engagerVirement(virementId);
      setVirementDetail(updatedData);
      toast("Virement engagé, en attente de validation");
    } catch (error) {
      toast("Erreur lors de l'engagement", "erreur");
      console.error(error);
    }
  };

  const [confirmation, setConfirmation] = useState<null | "valider" | "annuler">(null);

  const handleValider = async () => {
    if (!virementId) return;
    try {
      const updatedData = await validerVirement(virementId);
      setVirementDetail(updatedData);
      toast("Virement validé");
    } catch (error) {
      toast("Erreur lors de la validation", "erreur");
      console.error(error);
    } finally {
      setConfirmation(null);
    }
  };

  const handleAnnuler = async () => {
    if (!virementId) return;
    try {
      const updatedData = await annulerVirement(virementId);
      setVirementDetail(updatedData);
      toast("Virement annulé");
    } catch (error) {
      toast("Erreur lors de l'annulation", "erreur");
      console.error(error);
    } finally {
      setConfirmation(null);
    }
  };

  if (formState.isSubmitting) {
    return <div>Chargement...</div>;
  }

  if (errorDetail) {
    return <div>{errorDetail}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{virementId ? "Virement" : "Nouveau virement"}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="compte_source">
            Compte source
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="compte_source"
            {...register("compte_source", {
              valueAsNumber: true,
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
            disabled={loadingComptes}
          >
            <option value="">—</option>
            {comptes.map((compte) => (
              <option key={compte.id} value={compte.id}>
                {compte.code} - {compte.libelle}
              </option>
            ))}
          </select>
          {formState.errors.compte_source && (
            <span className="text-xs text-red-600">{formState.errors.compte_source?.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="compte_destination">
            Compte destination
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="compte_destination"
            {...register("compte_destination", {
              valueAsNumber: true,
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
            disabled={loadingComptes}
          >
            <option value="">—</option>
            {comptes.map((compte) => (
              <option key={compte.id} value={compte.id}>
                {compte.code} - {compte.libelle}
              </option>
            ))}
          </select>
          {formState.errors.compte_destination && (
            <span className="text-xs text-red-600">{formState.errors.compte_destination?.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="montant">
            Montant (FCFA)
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="montant"
            type="number"
            {...register("montant", {
              valueAsNumber: true,
              min: 1,
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
          />
          {formState.errors.montant && (
            <span className="text-xs text-red-600">{formState.errors.montant?.message}</span>
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
              validate: (value) => {
                if (!value) return true; // Let required handle empty values
                const date = new Date(value);
                const isValid = !isNaN(date.getTime()) && value === date.toISOString().split('T')[0];
                return isValid || "Date invalide";
              },
              required: "Obligatoire",
            })}
            className="rounded border px-2 py-1"
            placeholder="AAAA-MM-JJ"
          />
          {formState.errors.date && (
            <span className="text-xs text-red-600">{formState.errors.date?.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="motif">
            Motif
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="motif"
            type="text"
            {...register("motif", {
              required: "Obligatoire",
              maxLength: 255,
            })}
            className="rounded border px-2 py-1"
          />
          {formState.errors.motif && (
            <span className="text-xs text-red-600">{formState.errors.motif?.message}</span>
          )}
        </div>
      </form>

      {/* Display the virement details if we have an ID */}
      {virementId && virementDetail && (
        <section className="border rounded p-6">
          <h2 className="mb-4 font-semibold">Détails du virement</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <span className="font-semibold mr-2">Statut :</span>
              <Chip
                variante={(statut === "VALIDE" ? "success" : statut === "EN_ATTENTE_VALIDATION" ? "warning" : statut === "BROUILLON" ? "info" : statut === "ANNULE" ? "error" : "grey") as Variante}
                label={statut || "—"}
              />
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Date :</span>
              <span>{virementDetail.date || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Compte source :</span>
              <span>{virementDetail.compte_source_code || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Compte destination :</span>
              <span>{virementDetail.compte_destination_code || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Montant :</span>
              <span className="font-medium">{virementDetail.montant?.toLocaleString()} FCFA</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Motif :</span>
              <span>{virementDetail.motif || "—"}</span>
            </div>
          </div>

          {/* Actions : Engager (maker), Valider (checker, poste les mouvements), Annuler */}
          {peutEcrire && (
            <div className="flex justify-end gap-2 pt-4">
              {peutEngagerVirement && (
                <button
                  type="button"
                  onClick={handleEngager}
                  disabled={loadingDetail || formState.isSubmitting}
                  className="rounded border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                >
                  Engager
                </button>
              )}
              {peutValiderVirement && (
                <button
                  type="button"
                  onClick={() => setConfirmation("valider")}
                  disabled={loadingDetail || formState.isSubmitting}
                  className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
                >
                  Valider
                </button>
              )}
              {peutAnnulerVirement && (
                <button
                  type="button"
                  onClick={() => setConfirmation("annuler")}
                  disabled={loadingDetail || formState.isSubmitting}
                  className="rounded border px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Annuler
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        ouvert={confirmation === "valider"}
        titre="Confirmer la validation"
        description="Les mouvements comptables seront créés et le virement passera au statut VALIDÉ."
        labelConfirmer="Valider"
        varianteConfirmer="neutre"
        onConfirmer={handleValider}
        onAnnuler={() => setConfirmation(null)}
      />
      <ConfirmDialog
        ouvert={confirmation === "annuler"}
        titre="Confirmer l'annulation"
        description="Cette action est définitive."
        labelConfirmer="Annuler le virement"
        varianteConfirmer="danger"
        onConfirmer={handleAnnuler}
        onAnnuler={() => setConfirmation(null)}
      />
    </div>
  );
};
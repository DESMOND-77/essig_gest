import React from "react";
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../components/ToastProvider";
import { createResourceHooks } from "../../lib/resource";
import { messageErreur } from "../../lib/errors";
import { z } from "zod";
import { arreteCaisseDescripteur } from "../config/arreteCaisse";
import { Chip } from "../../components/Chip";
import { obtenirSoldeTheoriqueCaisse } from "../../lib/tresorerie";

interface ArreteCaisseData {
  id: number;
  compte_code?: string;
  date?: string;
  solde_theorique?: number | null;
  solde_physique?: number | null;
  ecart?: number | null;
  statut?: string;
  fait_par_nom?: string;
  valide_par_nom?: string;
}

type ArreteCaisseValues = z.infer<typeof arreteCaisseDescripteur.schema>;

// Create resource hooks outside the component to ensure they're stable
const arreteCaisseHooks = createResourceHooks<ArreteCaisseData>("arretes-caisse");
const compteHooks = createResourceHooks("comptes");

export const ArreteCaisseForm = () => {
  const { toast } = useToast();
  // We'll assume we have an action to validate the arrete caisse
  const { mutateAsync: createArreteCaisse } = arreteCaisseHooks.useCreer();

  const [compteTheoriqueSolde, setCompteTheoriqueSolde] = useState<number | null>(null);
  const [ecart, setEcart] = useState<number | null>(null);
  const [arretelId, setArretelId] = useState<number | undefined>(undefined);

  // We'll refetch the arrete caisse when arretelId changes
  const detailId = arretelId ?? undefined;
  // Using type assertion as useDetail handles undefined id via its enabled flag (Number.isFinite(id))
  const { data: arreteCaisseDetail, isLoading: isLoadingDetail, isError: isErrorDetail } =
    arreteCaisseHooks.useDetail(detailId as number);

  // Fetch comptes of type CAISSE for the select
  const { data: comptesData, isLoading: isLoadingComptes } = compteHooks.useListe({ type: "CAISSE", actif: "true" });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    formState,
  } = useForm<ArreteCaisseValues>({
    resolver: zodResolver(arreteCaisseDescripteur.schema as z.ZodType<ArreteCaisseValues, any, any>),
    defaultValues: {
      compte: undefined,
      date: undefined,
      solde_physique: undefined,
      solde_theorique: undefined, // We will not include this in the form as it's computed by the backend
      ecart: undefined, // We will not include this in the form
      fait_par: undefined,
      valide_par: undefined,
      statut: undefined,
    },
  });

  const { errors, isSubmitting } = formState;

  // Loading states
  const isLoading = isSubmitting || isLoadingDetail || isLoadingComptes;

  const onSubmit: SubmitHandler<ArreteCaisseValues> = async (data) => {
    try {
      // We don't send the fields that are set by the server (solde_theorique, ecart, fait_par, valide_par, statut)
      // The data doesn't contain server-only fields (solde_theorique, ecart, fait_par, valide_par, statut)
      // as they're excluded from the form, so we can send it directly
      const arreteData: ArreteCaisseValues = data;
      const newArreteCaisse = await createArreteCaisse(arreteData);
      if (newArreteCaisse && newArreteCaisse.id) {
        setArretelId(newArreteCaisse.id);
      }
      // After creation, we fetch the arrete caisse to get the solde théorique and écart
      // We'll refetch the detail
      toast("Arrêté de caisse créé avec succès");
      reset();
      // We'll set the solde_physique to empty so the user can enter a new one if needed
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


  // We'll compute the écart indicatif when solde_physique is entered and we have soldeTheorique
  const handleSoldePhysiqueChange = useCallback((value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      // Update the form value for solde_physique
      setValue("solde_physique", num);
    }
    // We'll compute le écart indicatif si nous avons soldeTheorique
    if (compteTheoriqueSolde !== null && !isNaN(num)) {
      setEcart(num - compteTheoriqueSolde);
    } else {
      setEcart(null);
    }
  }, [compteTheoriqueSolde, setValue]);

  // We'll fetch the solde théorique when compte and date change
  // We'll need to get the compte and date from the form.
  // We'll use useEffect to watch the form values of compte and date.
  // But we don't have easy access to the form values. We'll use the register's onChange to update state for compte and date.
  // We'll create state for compteId and dateValue.
  const [compteId, setCompteId] = useState<number | undefined>(undefined);
  const [dateValue, setDateValue] = useState<string | undefined>(undefined);

  // Fetch solde theorique when compte and date change
  useEffect(() => {
    const fetchSoldeTheorique = async () => {
      if (compteId !== undefined && dateValue !== undefined) {
        try {
          const solde = await obtenirSoldeTheoriqueCaisse(compteId, dateValue);
          setCompteTheoriqueSolde(solde);
          // Calculate ecart if we have solde_physique from form
          // Note: We don't have direct access to form solde_physique value here
          // We'll rely on the onChange handler to update ecart when solde_physique changes
        } catch (error) {
          console.error("Error fetching solde theorique:", error);
          setCompteTheoriqueSolde(null);
          setEcart(null);
        }
      } else {
        // Reset solde theorique and ecart when compte or date is undefined
        setCompteTheoriqueSolde(null);
        setEcart(null);
      }
    };

    fetchSoldeTheorique();
  }, [compteId, dateValue]);

  // We'll update these states when the form changes via the register's onChange.
  // We'll create a function to handle compte change and date change.

  // We'll also need to fetch the comptes of type CAISSE and actif for the select.
  // We'll leave that as a TODO for now.

  // For now, we'll just show a placeholder.

  if (isLoading) {
    return (
      <div>
        Chargement...
      </div>
    );
  }

  if (isErrorDetail) {
    return (
      <div>
        Erreur de chargement
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Nouvel arrêté de caisse</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="compte">
            Compte
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="compte"
            {...register("compte", {
              valueAsNumber: true,
              required: "Obligatoire",
              onChange: (e) => {
                const value = Number(e.target.value);
                setCompteId(value);
                // Update the form value for compte
                setValue("compte", value);
                // Reset the solde théorique and écart when compte changes
                setCompteTheoriqueSolde(null);
                setEcart(null);
              }
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
              onChange: (e) => {
                const value = e.target.value;
                setDateValue(value);
                // Update the form value for date
                setValue("date", value);
                // Reset the solde théorique et écart lorsque la date change
                setCompteTheoriqueSolde(null);
                setEcart(null);
              },
            })}
            className="rounded border px-2 py-1"
            placeholder="AAAA-MM-JJ"
          />
          {errors.date && (
            <span className="text-xs text-red-600">{errors.date?.message}</span>
          )}
        </div>

        {/* Solde théorique (indicatif) */}
        {compteId !== undefined && dateValue !== undefined && compteTheoriqueSolde !== null && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Solde théorique (FCFA)</label>
            <span className="font-mono">{compteTheoriqueSolde.toLocaleString()}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="solde_physique">
            Solde physique/compté (FCFA)
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="solde_physique"
            type="number"
            {...register("solde_physique", {
              valueAsNumber: true,
              required: "Obligatoire",
              onChange: handleSoldePhysiqueChange,
            })}
            className="rounded border px-2 py-1"
          />
          {errors.solde_physique && (
            <span className="text-xs text-red-600">{errors.solde_physique?.message}</span>
          )}
        </div>

        {/* Écart indicatif */}
        {ecart !== null && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Écart (FCFA)</label>
            <span className={ecart === 0 ? "font-medium text-green-600" : ecart > 0 ? "font-medium text-red-600" : "font-medium text-blue-600"}>
              {ecart.toLocaleString()}
              {ecart > 0 ? " (manquant)" : ecart < 0 ? " (excédent)" : ""}
            </span>
          </div>
        )}

        {/* Warning if écart is significant */}
        {ecart !== null && Math.abs(ecart) > 0 && (
          <div className="bg-yellow-50 rounded p-4">
            <h2 className="mb-2 font-medium">Attention</h2>
            <p className="text-sm">
              Un écart de {Math.abs(ecart).toLocaleString()} FCFA a été détecté.
              Veuillez vérifier le comptage physique et les opérations enregistrées.
            </p>
          </div>
        )}

        {/* Link to billetage */}
        {/* We'll show this after the arrete caisse is created */}
      </form>

      {/* Display the created arrete caisse details */}
      {arretelId && arreteCaisseDetail && (
        <section className="border rounded p-6">
          <h2 className="mb-4 font-semibold">Arrêté de caisse créé</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <span className="font-semibold mr-2">Statut :</span>
              <Chip
                variante={arreteCaisseDetail?.statut === "VALIDE" ? "success" : arreteCaisseDetail?.statut === "OUVERT" ? "warning" : "error"}
                label={arreteCaisseDetail?.statut || "—"}
              />
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Date :</span>
              <span>{arreteCaisseDetail?.date || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Compte :</span>
              <span>{arreteCaisseDetail?.compte_code || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Solde théorique :</span>
              <span className="font-mono">{arreteCaisseDetail?.solde_theorique?.toLocaleString() || "—"} FCFA</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Solde physique :</span>
              <span className="font-mono">{arreteCaisseDetail?.solde_physique?.toLocaleString() || "—"} FCFA</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Écart :</span>
              <span className={arreteCaisseDetail?.ecart === 0 ? "font-medium text-green-600" : arreteCaisseDetail?.ecart > 0 ? "font-medium text-red-600" : "font-medium text-blue-600"}>
                {arreteCaisseDetail?.ecart?.toLocaleString()} FCFA
                {arreteCaisseDetail?.ecart > 0 ? " (manquant)" : arreteCaisseDetail?.ecart < 0 ? " (excédent)" : ""}
              </span>
            </div>
          </div>

          {/* Link to billetage */}
          <div className="mt-4">
            <a
              href={`/tresorerie/arretes-caisse/${arretelId}/billetage`}
              className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
            >
              Saisir le billetage
            </a>
          </div>

          {/* Action: Valider (if required) */}
          {/* We'll assume there is a validation action for the arrete caisse */}
          {/* We'll check the user's role and the statut */}
          {/* We'll leave it as a placeholder for now */}
        </section>
      )}
    </div>
  );
};

// Helper function to extract field errors from payload
function champErreurs(payload: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key in payload) {
    if (typeof payload[key] === "string") {
      errors[key] = payload[key];
    }
  }
  return errors;
}

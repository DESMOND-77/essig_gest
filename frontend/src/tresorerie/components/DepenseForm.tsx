import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { annulerDepense, validerDepense, payerDepense, engagerDepense } from "../../lib/tresorerie";
import { messageErreur, champErreurs } from "../../lib/errors";
import { z } from "zod";
import { depenseDescripteur } from "../config/depense";
import { Chip } from "../../components/Chip";
import { apiFetch } from "../../api/client";

interface Depense {
  id: number;
  date: Date | string;
  categorie_mouvement: number;
  beneficiaire: string;
  designation: string;
  montant: number;
  compte: number;
  ecole?: number;
  annee_scolaire: number;
  piece_justificative?: string;
  categorie_mouvement_libelle: string;
  compte_debit_code: string;
  compte_libelle: string;
  ecole_libelle: string;
  annee_scolaire_libelle: string;
  statut: string;
}

interface CategorieMouvement {
  id: number;
  code: string;
  libelle: string;
}

interface Compte {
  id: number;
  code: string;
  libelle: string;
}

interface Ecole {
  id: number;
  nom: string;
}

interface AnneeScolaire {
  id: number;
  libelle: string;
}
import { createResourceHooks } from "../../lib/resource";

// Form schema allows empty/default values for better UX
const DepenseFormSchema = z.object({
  date: z.union([z.date(), z.string()]), // Allow empty string for unfilled date
  categorie_mouvement: z.number(), // 0 is valid
  beneficiaire: z.string().max(150).optional(), // Allow empty string
  designation: z.string().max(150).optional(), // Allow empty string
  montant: z.number().int().nonnegative().optional(), // Allow 0 and empty
  compte: z.number().optional(), // Allow 0 and empty
  ecole: z.number().optional(), // Already optional
  annee_scolaire: z.number().optional(), // Allow 0 and empty
  piece_justificative: z.string().max(255).optional().or(z.literal("")), // Already handles empty
  justificatif: z.instanceof(FileList).optional(), // For file upload
});

type DepenseValues = z.infer<typeof DepenseFormSchema>;

// Create resource hooks outside the component to ensure they're stable
const categorieHooks = createResourceHooks<CategorieMouvement>("categories-mouvement");
const compteHooks = createResourceHooks<Compte>("comptes");
const ecoleHooks = createResourceHooks<Ecole>("referentiel/ecoles");
const anneeScolaireHooks = createResourceHooks<AnneeScolaire>("referentiel/annees-scolaires");
const depenseHooks = createResourceHooks<Depense>("depenses");

const defaultValues: DepenseValues = {
  date: "",
  categorie_mouvement: 0,
  beneficiaire: undefined,
  designation: undefined,
  montant: undefined,
  compte: undefined,
  ecole: undefined,
  annee_scolaire: undefined,
  piece_justificative: undefined,
  justificatif: undefined,
};

export const DepenseForm = () => {
  const { utilisateur } = useAuth();
  const { toast } = useToast();
  const [depenseId, setDepenseId] = useState<number | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Use resource hooks for standard actions
  const { mutateAsync: updateDepenseMutation } = depenseHooks.useModifier();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepenseValues>({
    resolver: zodResolver(
      DepenseFormSchema as Parameters<typeof zodResolver>[0],
    ) as any,
    defaultValues,
  });

  const onSubmit = async (data: DepenseValues) => {
    try {
      // We don't send the fields that are set by the server
      const {
        justificatif,
        ...depenseData
      } = data;

      // Prepare form data for file upload
      const formData = new FormData();
      Object.keys(depenseData).forEach((key) => {
        const value = depenseData[key as keyof typeof depenseData];
        if (value !== undefined && value !== null) {
          formData.append(key, value as string);
        }
      });

      // Add justificatif if present
      if (justificatif && justificatif[0]) {
        formData.append("piece_justificative", justificatif[0]);
      }

      if (isEditMode && depenseId) {
        // Update existing depense
        await updateDepenseMutation({
          id: depenseId,
          corps: data as Partial<DepenseValues>,
        });
        toast("Dépense mise à jour avec succès");
        // Refetch to get updated data
        await refetchDepense();
      } else {
        // Create new depense
        const response = await apiFetch(`/depenses/`, {
          method: "POST",
          body: formData,
        });
        const newDepenseJson = response.status === 204 ? null : await response.json().catch(() => null);
        if (!response.ok) {
          throw Object.assign(new Error(`HTTP ${response.status}`), {
            status: response.status,
            payload: newDepenseJson,
          });
        }
        const newDepense = newDepenseJson;
        setDepenseId(newDepense.id);
        toast("Dépense créée avec succès");
        reset();
        // Optionally navigate to detail page to avoid resubmission
        // navigate(`/tresorerie/depenses/${newDepense.id}`);
      }
    } catch (e) {
      const err = e as { status?: number; payload?: Record<string, unknown> };
      if (err.status === 400 && err.payload) {
        for (const [champ, msg] of Object.entries(champErreurs(err.payload))) {
          setError(champ as never, { message: msg as string });
        }
      } else {
        toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
      }
    }
  };

  // Fetch categories de mouvement avec sens=SORTIE
  const { data: categoriesData, isLoading: isLoadingCategories } = categorieHooks.useListe({ sens: "SORTIE" });

  // Fetch comptes
  const { data: comptesData, isLoading: isLoadingComptes } = compteHooks.useListe();

  // Fetch écoles
  const { data: ecolesData, isLoading: isLoadingEcoles } = ecoleHooks.useListe();

  // Fetch années scolaires
  const { data: anneesScolairesData, isLoading: isLoadingAnneesScolaires } = anneeScolaireHooks.useListe();

  // Fetch depense detail for display
  const { data: depenseDetail, isLoading: isLoadingDetail, isError: isErrorDetail, refetch: refetchDepense } =
    depenseHooks.useDetail(Number(depenseId));

  // Loading states
  const isLoading = isSubmitting || isLoadingCategories || isLoadingComptes || isLoadingEcoles || isLoadingAnneesScolaires || isLoadingDetail;

  // Determine if we are in edit mode based on routeId would be handled by parent component
  // For now, we'll just toggle based on whether we have an ID from creation

  const statut = depenseDetail?.statut;
  const peutEngagerOuPayer = useMemo(() => {
    if (!utilisateur?.roles) return false;
    const roles = utilisateur.roles;
    return roles.some(r => r.code === "COMPTABLE") || roles.some(r => r.code === "DAF");
  }, [utilisateur?.roles]);

  const peutValider = peutEngagerOuPayer && statut === "ENGAGEE";
  const peutPayer = peutEngagerOuPayer && statut === "VALIDEE";
  const peutAnnuler = peutEngagerOuPayer && (statut === "ENGAGEE" || statut === "VALIDEE"); // Adjust based on workflow

  const handleValider = async () => {
    try {
      if (!depenseId) return;
      await validerDepense(depenseId);
      await refetchDepense();
      toast("Dépense validé");
    } catch (error) {
      toast("Erreur lors de la validation", "erreur");
    }
  };

  const handlePayer = async () => {
    try {
      if (!depenseId) return;
      await payerDepense(depenseId);
      await refetchDepense();
      toast("Dépense payé");
    } catch (error) {
      toast("Erreur lors du paiement", "erreur");
    }
  };

  const handleAnnuler = async () => {
    try {
      if (!depenseId) return;
      await annulerDepense(depenseId);
      await refetchDepense();
      toast("Dépense annulé");
    } catch (error) {
      toast("Erreur lors de l'annulation", "erreur");
    }
  };

  const handleEngager = async () => {
    try {
      if (!depenseId) return;
      await engagerDepense({ ...depenseDetail, statut: 'ENGAGEE' });
      await refetchDepense();
      toast("Dépense engagé");
    } catch (error) {
      toast("Erreur lors de l'engagement", "erreur");
    }
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (isErrorDetail) {
    return <div>Erreur de chargement</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{isEditMode ? "Modifier la dépense" : "Nouvelle dépense"}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" encType="multipart/form-data">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="date">
            Date
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="date"
            type="date"
            {...register('date')}
            required
            className="rounded border px-2 py-1"
          />
          {errors.date && (
            <span className="text-xs text-red-600">{errors.date.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="categorie_mouvement">
            Catégorie de sortie
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="categorie_mouvement"
            {...register('categorie_mouvement')}
            required
            className="rounded border px-2 py-1"
          >
            <option value="">—</option>
            {categoriesData?.results?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.code} - {cat.libelle}
              </option>
            ))}
          </select>
          {errors.categorie_mouvement && (
            <span className="text-xs text-red-600">{errors.categorie_mouvement.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="beneficiaire">
            Bénéficiaire
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="beneficiaire"
            type="text"
            {...register('beneficiaire')}
            required
            maxLength={255}
            className="rounded border px-2 py-1"
          />
          {errors.beneficiaire && (
            <span className="text-xs text-red-600">{errors.beneficiaire.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="designation">
            Désignation
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="designation"
            type="text"
            {...register('designation')}
            required
            maxLength={255}
            className="rounded border px-2 py-1"
          />
          {errors.designation && (
            <span className="text-xs text-red-600">{errors.designation.message}</span>
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
            {...register('montant')}
            required
            min={1}
            className="rounded border px-2 py-1"
          />
          {errors.montant && (
            <span className="text-xs text-red-600">{errors.montant.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="compte">
            Compte de débit
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="compte"
            {...register('compte')}
            required
            className="rounded border px-2 py-1"
          >
            <option value="">—</option>
            {comptesData?.results?.map((compte) => (
              <option key={compte.id} value={compte.id}>
                {compte.code} - {compte.libelle}
              </option>
            ))}
          </select>
          {errors.compte ? <span className="text-xs text-red-600">{errors.compte.message}</span> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ecole">
            École
          </label>
          <select
            id="ecole"
            {...register('ecole')}
            className="rounded border px-2 py-1"
          >
            <option value="">—</option>
            {ecolesData?.results?.map((ecole) => (
              <option key={ecole.id} value={ecole.id}>
                {ecole.nom}
              </option>
            ))}
          </select>
          {errors.ecole && (
            <span className="text-xs text-red-600">{errors.ecole.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="annee_scolaire">
            Année scolaire
            <span className="text-red-600"> *</span>
          </label>
          <select
            id="annee_scolaire"
            {...register('annee_scolaire')}
            required
            className="rounded border px-2 py-1"
          >
            <option value="">—</option>
            {anneesScolairesData?.results?.map((annee) => (
              <option key={annee.id} value={annee.id}>
                {annee.libelle}
              </option>
            ))}
          </select>
          {errors.annee_scolaire && (
            <span className="text-xs text-red-600">{errors.annee_scolaire.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="piece_justificative">
            Pièce justificative
          </label>
          <input
            id="piece_justificative"
            type="file"
            {...register('piece_justificative')}
            className="rounded border px-2 py-1"
          />
          {errors.piece_justificative && (
            <span className="text-xs text-red-600">{errors.piece_justificative.message}</span>
          )}
        </div>
      </form>

      {/* Display the created depense details */}
      {depenseId && depenseDetail && (
        <section className="border rounded p-6">
          <h2 className="mb-4 font-semibold">{isEditMode ? "Dépense modifiée" : "Dépense créée"}</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <span className="font-semibold mr-2">Statut :</span>
              <Chip
                variante={statut === "PAYEE" ? "success" : statut === "VALIDEE" ? "warning" : statut === "ENGAGEE" ? "info" : "error"}
                label={statut || "—"}
              />
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Date :</span>
              <span>{depenseDetail.date ? (depenseDetail.date instanceof Date ? depenseDetail.date.toISOString().split('T')[0] : depenseDetail.date) : "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Bénéficiaire :</span>
              <span>{depenseDetail.beneficiaire || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Désignation :</span>
              <span>{depenseDetail.designation || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Montant :</span>
              <span className="font-medium">{depenseDetail.montant.toLocaleString()} FCFA</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Compte de débit :</span>
              <span>{depenseDetail.compte_debit_code || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">École :</span>
              <span>{depenseDetail.ecole_libelle || "—"}</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold mr-2">Année scolaire :</span>
              <span>{depenseDetail.annee_scolaire_libelle || "—"}</span>
            </div>
            {/* Justificatif */}
            {depenseDetail.piece_justificative && (
              <div className="space-y-2">
                <span className="font-semibold mr-2">Pièce justificative :</span>
                <a
                  href={`/api/v1/tresorerie/depenses/${depenseId}/piece_justificative`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Voir la pièce justificative
                </a>
              </div>
            )}
          </div>

          {/* Actions: Engager, Valider, Payer, Annuler */}
          {peutEngagerOuPayer && (
            <div className="flex justify-end gap-2 pt-4">
              {!isEditMode && statut === "CREEE" && (
                <button
                  type="button"
                  onClick={handleEngager}
                  disabled={isSubmitting}
                  className="rounded border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                >
                  Engager
                </button>
              )}
              {peutValider && (
                <button
                  type="button"
                  onClick={handleValider}
                  disabled={isSubmitting}
                  className="rounded border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                >
                  Valider
                </button>
              )}
              {peutPayer && (
                <button
                  type="button"
                  onClick={handlePayer}
                  disabled={isSubmitting}
                  className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
                >
                  Payer
                </button>
              )}
              {peutAnnuler && (
                <button
                  type="button"
                  onClick={handleAnnuler}
                  disabled={isSubmitting}
                  className="rounded border px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Annuler
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}


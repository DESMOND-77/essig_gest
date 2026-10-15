import { useState } from "react";
import { createResourceHooks } from "../../lib/resource";
import { useToast } from "../../components/ToastProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { messageErreur } from "../../lib/errors";

type Deliberation = {
  id: number;
  statut: string;
  classe: number;
  periode: number | null;
};

const hooks = createResourceHooks<Deliberation>("resultats/deliberations");
const inscriptionHooks = createResourceHooks<Record<string, unknown> & { id: number }>(
  "personnes/inscriptions",
);
const anneeHooks = createResourceHooks<Record<string, unknown> & { id: number }>(
  "referentiel/annees-scolaires",
);

export function DeliberationActions({ deliberation }: { deliberation: Deliberation }) {
  const { toast } = useToast();
  const valider = hooks.useAction("valider");
  const [confirmation, setConfirmation] = useState(false);
  const [calculDetail, setCalculDetail] = useState(false);
  const [inscriptionId, setInscriptionId] = useState<string>("");
  const [anneeScolaireId, setAnneeScolaireId] = useState<string>("");

  const inscriptions = inscriptionHooks.useListe({ classe: deliberation.classe, page: 1 });
  const annees = anneeHooks.useListe({ page: 1 });

  const lancerValidation = async () => {
    try {
      await valider.mutateAsync({ id: deliberation.id });
      toast("Résultats calculés pour la classe.");
    } catch (e) {
      const err = e as { status?: number; payload?: Record<string, unknown> };
      toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
    } finally {
      setConfirmation(false);
    }
  };

  const calculerPourInscription = async () => {
    if (!inscriptionId) return;
    try {
      await valider.mutateAsync({
        id: deliberation.id,
        corps: {
          inscription_id: Number(inscriptionId),
          ...(anneeScolaireId ? { annee_scolaire_id: Number(anneeScolaireId) } : {}),
        },
      });
      toast("Résultat de période/année calculé pour cette inscription.");
      setCalculDetail(false);
    } catch (e) {
      const err = e as { status?: number; payload?: Record<string, unknown> };
      toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
    }
  };

  return (
    <>
      {deliberation.statut === "BROUILLON" && (
        <button
          type="button"
          className="text-green-700 underline"
          onClick={() => setConfirmation(true)}
        >
          Valider
        </button>
      )}
      {deliberation.statut === "VALIDEE" && (
        <button
          type="button"
          className="text-gray-700 underline"
          onClick={() => setCalculDetail((v) => !v)}
        >
          Résultat période/année
        </button>
      )}

      {calculDetail && (
        <span className="ml-2 flex items-center gap-1 text-sm">
          <select
            value={inscriptionId}
            onChange={(e) => setInscriptionId(e.target.value)}
            className="rounded border px-1 py-0.5"
          >
            <option value="">Inscription…</option>
            {(inscriptions.data?.results ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                Inscription #{String(i.numero_ordre)} (étudiant #{String(i.etudiant)})
              </option>
            ))}
          </select>
          {deliberation.periode == null && (
            <select
              value={anneeScolaireId}
              onChange={(e) => setAnneeScolaireId(e.target.value)}
              className="rounded border px-1 py-0.5"
            >
              <option value="">Année (résultat annuel)…</option>
              {(annees.data?.results ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {String(a.libelle)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={calculerPourInscription}
            disabled={!inscriptionId}
            className="rounded bg-gray-800 px-2 py-0.5 text-white disabled:opacity-40"
          >
            Calculer
          </button>
        </span>
      )}

      <ConfirmDialog
        ouvert={confirmation}
        titre="Valider la délibération"
        description="Calcule et fige les résultats de matière pour toute la classe à partir des notes saisies. Action irréversible depuis cet écran."
        labelConfirmer="Valider"
        varianteConfirmer="neutre"
        onConfirmer={lancerValidation}
        onAnnuler={() => setConfirmation(false)}
      />
    </>
  );
}

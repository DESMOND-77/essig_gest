import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataState } from "./DataState";
import { ConfirmDialog } from "./ConfirmDialog";
import { Chip } from "./Chip";
import { ResourceForm } from "./ResourceForm";
import { useToast } from "./ToastProvider";
import { messageErreur } from "../lib/errors";
import { createResourceHooks } from "../lib/resource";
import { peutEcrire, type Descripteur } from "../referentiel/descripteur";

type Ligne = Record<string, unknown> & { id: number };

const VARIANTE_PAR_VALEUR: Record<string, "success" | "warning" | "error" | "info"> = {
  VALIDE: "success",
  VALIDÉE: "success",
  VALIDEE: "success",
  PAYÉ: "success",
  ADMIS: "success",
  SOLDE: "success",
  EN_ATTENTE_VALIDATION: "warning",
  BROUILLON: "warning",
  ENGAGEE: "warning",
  ADMIS_CONDITIONNEL: "warning",
  AJOURNE: "warning",
  PARTIEL: "warning",
  ANNULE: "error",
  ANNULEE: "error",
  REDOUBLE: "error",
  EXCLU: "error",
};

function variantePourValeur(valeur: string): "success" | "warning" | "error" | "info" {
  return VARIANTE_PAR_VALEUR[valeur] ?? "info";
}

export function ResourcePage({ descripteur }: { descripteur: Descripteur }) {
  const hooks = useMemo(
    () => createResourceHooks(descripteur.endpoint),
    [descripteur.endpoint],
  );
  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState("");
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [edition, setEdition] = useState<null | Ligne>(null);
  const [creation, setCreation] = useState(false);
  const [aSupprimer, setASupprimer] = useState<null | { id: number }>(null);

  const params = { page, search: recherche || undefined, ...filtres };
  const { data, isLoading, isError, refetch } = hooks.useListe(params);
  const supprimer = hooks.useSupprimer();
  const { toast } = useToast();
  const { utilisateur } = useAuth();
  const ecrivable = peutEcrire(utilisateur?.roles ?? [], descripteur.roleEcriture);

  const columns = useMemo<ColumnDef<Ligne>[]>(
    () => [
      ...descripteur.colonnes.map<ColumnDef<Ligne>>((c) => ({
        id: c.cle,
        header: c.entete,
        accessorFn: (l: Ligne) => (c.rendu ? c.rendu(l) : l[c.cle]),
        cell: (info) => {
          const v = info.getValue();
          if (c.cle === "logo") {
            return v ? (
              <img src={String(v)} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <span className="text-gray-400">—</span>
            );
          }
          if ((c.cle === "statut" || c.cle === "decision") && v != null && v !== "") {
            return <Chip variante={variantePourValeur(String(v))} label={String(v)} />;
          }
          return v == null ? "" : String(v);
        },
      })),
      ...(ecrivable
        ? [
            {
              id: "_actions",
              header: "",
              cell: ({ row }: { row: { original: Ligne } }) => (
                <span className="flex items-center gap-2">
                  <button
                    className="text-blue-600 underline"
                    onClick={() => setEdition(row.original)}
                  >
                    Éditer
                  </button>
                  <button
                    className="text-red-600 underline"
                    onClick={() => setASupprimer(row.original)}
                  >
                    Supprimer
                  </button>
                  {descripteur.actionsLigne?.(row.original)}
                </span>
              ),
            } as ColumnDef<Ligne>,
          ]
        : []),
    ],
    [descripteur.colonnes, descripteur.actionsLigne, ecrivable],
  );

  const table = useReactTable({
    data: (data?.results ?? []) as Ligne[],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{descripteur.titre}</h1>
        {ecrivable && (
          <button
            onClick={() => setCreation(true)}
            className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
          >
            Créer
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {descripteur.rechercheActive !== false && (
          <input
            placeholder="Rechercher…"
            value={recherche}
            onChange={(e) => {
              setPage(1);
              setRecherche(e.target.value);
            }}
            className="rounded border px-2 py-1 text-sm"
          />
        )}
        {descripteur.filtres?.map((fl) => (
          <FiltreSelect
            key={fl.nom}
            filtre={fl}
            valeur={filtres[fl.nom] ?? ""}
            onChange={(v) => {
              setPage(1);
              setFiltres((f) => ({ ...f, [fl.nom]: v }));
            }}
          />
        ))}
      </div>

      {isLoading ? (
        <DataState statut="chargement" />
      ) : isError ? (
        <DataState statut="erreur" onReessayer={refetch} />
      ) : (data?.results.length ?? 0) === 0 ? (
        <DataState statut="vide" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b text-left">
                {hg.headers.map((h) => (
                  <th key={h.id} className="py-2">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b">
                {r.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-2 text-sm">
        <button
          disabled={!data?.previous}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Précédent
        </button>
        <span>{data?.count ?? 0} élément(s)</span>
        <button
          disabled={!data?.next}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Suivant
        </button>
      </div>

      {(creation || edition) && (
        <div className="rounded border p-4">
          <h2 className="mb-3 font-medium">
            {edition ? "Modifier" : "Créer"} — {descripteur.titre}
          </h2>
          <ResourceForm
            descripteur={descripteur}
            valeurs={edition ?? undefined}
            onFerme={() => {
              setCreation(false);
              setEdition(null);
            }}
          />
        </div>
      )}

      <ConfirmDialog
        ouvert={!!aSupprimer}
        titre="Confirmer la suppression"
        description="Cette action est définitive."
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          try {
            await supprimer.mutateAsync(aSupprimer!.id);
            toast("Supprimé.");
          } catch (e) {
            const err = e as { status?: number; payload?: Record<string, unknown> };
            toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
          } finally {
            setASupprimer(null);
          }
        }}
      />
    </section>
  );
}

function FiltreSelect({
  filtre,
  valeur,
  onChange,
}: {
  filtre: NonNullable<Descripteur["filtres"]>[number];
  valeur: string;
  onChange: (v: string) => void;
}) {
  const hooks = filtre.fkEndpoint ? createResourceHooks(filtre.fkEndpoint) : null;
  const liste = hooks?.useListe({ page: 1 });
  const options =
    filtre.options ??
    (liste?.data?.results ?? []).map((o: Record<string, unknown>) => ({
      valeur: String(o.id),
      label: String(o.nom ?? o.libelle ?? o.id),
    }));
  return (
    <select
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border px-2 py-1 text-sm"
      aria-label={filtre.label}
    >
      <option value="">{filtre.label} : tous</option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

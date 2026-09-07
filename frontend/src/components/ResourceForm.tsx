import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { useToast } from "./ToastProvider";
import { champErreurs, messageErreur } from "../lib/errors";
import { createResourceHooks } from "../lib/resource";
import type { Champ, Descripteur } from "../referentiel/descripteur";

type Valeurs = Record<string, unknown>;

export function ResourceForm({
  descripteur,
  valeurs,
  onFerme,
}: {
  descripteur: Descripteur;
  valeurs?: Record<string, unknown> & { id: number };
  onFerme: () => void;
}) {
  const hooks = createResourceHooks(descripteur.endpoint);
  const creer = hooks.useCreer();
  const modifier = hooks.useModifier();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Valeurs>({
    // `descripteur.schema` est un `ZodTypeAny` non littéral : `zodResolver` n'en
    // infère pas le type d'entrée `FieldValues`. Le descripteur garantit un
    // schéma d'objet ; on force l'inférence et on retype le résolveur.
    resolver: zodResolver(
      descripteur.schema as Parameters<typeof zodResolver>[0],
    ) as Resolver<Valeurs>,
    defaultValues: (valeurs ?? {}) as Valeurs,
  });

  useEffect(() => reset((valeurs ?? {}) as Valeurs), [valeurs, reset]);

  const soumettre: SubmitHandler<Valeurs> = async (data) => {
    try {
      if (valeurs) await modifier.mutateAsync({ id: valeurs.id, corps: data });
      else await creer.mutateAsync(data);
      toast("Enregistré.");
      onFerme();
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

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-3">
      {descripteur.champs.map((c) => (
        <div key={c.nom} className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={c.nom}>
            {c.label}
            {c.requis && <span className="text-red-600"> *</span>}
          </label>
          {c.type === "checkbox" ? (
            <input id={c.nom} type="checkbox" {...register(c.nom)} />
          ) : c.type === "select" ? (
            <select id={c.nom} {...register(c.nom)} className="rounded border px-2 py-1">
              <option value="">—</option>
              {c.options?.map((o) => (
                <option key={o.valeur} value={o.valeur}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : c.type === "fk" ? (
            <FkSelect champ={c} register={register} />
          ) : (
            <input
              id={c.nom}
              type={c.type === "number" ? "number" : "text"}
              {...register(c.nom, c.type === "number" ? { valueAsNumber: true } : {})}
              className="rounded border px-2 py-1"
            />
          )}
          {errors[c.nom] && (
            <span className="text-xs text-red-600">
              {String(errors[c.nom]?.message)}
            </span>
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onFerme} className="rounded border px-3 py-1 text-sm">
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function FkSelect({
  champ,
  register,
}: {
  champ: Champ;
  register: ReturnType<typeof useForm>["register"];
}) {
  const hooks = createResourceHooks(champ.fkEndpoint!);
  const { data } = hooks.useListe({ page: 1 });
  return (
    <select {...register(champ.nom, { valueAsNumber: true })} className="rounded border px-2 py-1">
      <option value="">—</option>
      {(data?.results ?? []).map((o: Record<string, unknown>) => (
        <option key={String(o.id)} value={String(o.id)}>
          {champ.fkLabel ? champ.fkLabel(o) : String(o.id)}
        </option>
      ))}
    </select>
  );
}

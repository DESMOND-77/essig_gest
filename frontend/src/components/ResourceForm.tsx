import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ChangeEvent } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { useToast } from "./ToastProvider";
import { champErreurs, messageErreur } from "../lib/errors";
import { createResourceHooks } from "../lib/resource";
import type { Champ, Descripteur } from "../referentiel/descripteur";

type Valeurs = Record<string, unknown>;

const TAILLE_MAX_LOGO = 2 * 1024 * 1024;
const TYPES_LOGO_ACCEPTES = ["image/png", "image/jpeg", "image/webp"];

function construireFormData(data: Valeurs): FormData {
  const fd = new FormData();
  for (const [cle, valeur] of Object.entries(data)) {
    if (valeur instanceof FileList) {
      if (valeur.length > 0) fd.append(cle, valeur[0]);
    } else if (valeur !== undefined && valeur !== null) {
      fd.append(cle, String(valeur));
    }
  }
  return fd;
}

function contientFichier(data: Valeurs): boolean {
  return Object.values(data).some((v) => v instanceof FileList && v.length > 0);
}

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
    setValue,
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
      const corps = contientFichier(data) ? construireFormData(data) : data;
      if (valeurs) await modifier.mutateAsync({ id: valeurs.id, corps });
      else await creer.mutateAsync(corps);
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
      {descripteur.champs
        .filter((c) => !(c.creationSeule && valeurs))
        .map((c) => (
        <div key={c.nom} className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={c.nom}>
            {c.label}
            {c.requis && <span className="text-red-600"> *</span>}
          </label>
          {c.aide && <span className="text-xs text-gray-500">{c.aide}</span>}
          {c.type === "checkbox" ? (
            <input id={c.nom} type="checkbox" {...register(c.nom)} />
          ) : c.type === "file" ? (
            <FileField
              champ={c}
              register={register}
              setValue={setValue}
              setError={setError}
              valeurActuelle={valeurs?.[c.nom] as string | undefined}
              onSupprimerExistant={
                valeurs
                  ? () =>
                      modifier.mutateAsync({ id: valeurs.id, corps: { [c.nom]: null } })
                        .then(() => toast("Logo supprimé."))
                        .catch((e) => {
                          const err = e as { status?: number; payload?: Record<string, unknown> };
                          toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
                        })
                  : undefined
              }
            />
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

function FileField({
  champ,
  register,
  setValue,
  setError,
  valeurActuelle,
  onSupprimerExistant,
}: {
  champ: Champ;
  register: ReturnType<typeof useForm<Valeurs>>["register"];
  setValue: ReturnType<typeof useForm<Valeurs>>["setValue"];
  setError: ReturnType<typeof useForm<Valeurs>>["setError"];
  valeurActuelle?: string;
  onSupprimerExistant?: () => Promise<void>;
}) {
  const [apercu, setApercu] = useState<string | null>(null);
  const [supprime, setSupprime] = useState(false);

  const champRegistre = register(champ.nom);

  const surChangement = (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    champRegistre.onChange(e);
    if (!fichier) {
      setApercu(null);
      return;
    }
    if (!TYPES_LOGO_ACCEPTES.includes(fichier.type)) {
      setError(champ.nom as never, { message: "Format non accepté (PNG, JPG ou WEBP uniquement)." });
      setValue(champ.nom as never, undefined as never);
      setApercu(null);
      return;
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      setError(champ.nom as never, { message: "Fichier trop volumineux (2 Mo maximum)." });
      setValue(champ.nom as never, undefined as never);
      setApercu(null);
      return;
    }
    setApercu(URL.createObjectURL(fichier));
    setSupprime(false);
  };

  const image = apercu ?? (!supprime ? valeurActuelle : undefined);

  return (
    <div className="flex items-center gap-3">
      {image ? (
        <img src={image} alt="" className="h-12 w-12 rounded border object-cover" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded border text-gray-400">
          —
        </span>
      )}
      <input
        id={champ.nom}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        name={champRegistre.name}
        ref={champRegistre.ref}
        onBlur={champRegistre.onBlur}
        onChange={surChangement}
        className="text-sm"
      />
      {onSupprimerExistant && valeurActuelle && !supprime && !apercu && (
        <button
          type="button"
          onClick={() => {
            setSupprime(true);
            onSupprimerExistant();
          }}
          className="text-xs text-red-600 underline"
        >
          Supprimer
        </button>
      )}
    </div>
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

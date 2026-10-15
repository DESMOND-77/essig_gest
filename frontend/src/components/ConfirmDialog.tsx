import * as Dialog from "@radix-ui/react-dialog";

export function ConfirmDialog({
  ouvert,
  titre,
  description,
  onConfirmer,
  onAnnuler,
  labelConfirmer = "Supprimer",
  varianteConfirmer = "danger",
}: {
  ouvert: boolean;
  titre: string;
  description: string;
  onConfirmer: () => void;
  onAnnuler: () => void;
  labelConfirmer?: string;
  varianteConfirmer?: "danger" | "neutre";
}) {
  return (
    <Dialog.Root open={ouvert} onOpenChange={(o) => !o && onAnnuler()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-80 -translate-x-1/2 -translate-y-1/2 rounded bg-white p-5 shadow-lg">
          <Dialog.Title className="font-semibold">{titre}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-600">
            {description}
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onAnnuler} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              onClick={onConfirmer}
              className={`rounded px-3 py-1 text-sm text-white ${
                varianteConfirmer === "danger" ? "bg-red-600" : "bg-gray-800"
              }`}
            >
              {labelConfirmer}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

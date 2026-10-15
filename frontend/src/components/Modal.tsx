import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Modal({
  ouvert,
  titre,
  onFermer,
  children,
}: {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 max-h-[85vh] w-[32rem] -translate-x-1/2 -translate-y-1/2
            overflow-y-auto rounded bg-white p-5 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-medium">{titre}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

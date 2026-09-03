export function DataState({
  statut,
  onReessayer,
}: {
  statut: "chargement" | "vide" | "erreur";
  onReessayer?: () => void;
}) {
  if (statut === "chargement")
    return (
      <div className="animate-pulse space-y-2 p-4" aria-label="Chargement">
        <div className="h-6 rounded bg-gray-200" />
        <div className="h-6 rounded bg-gray-200" />
        <div className="h-6 rounded bg-gray-200" />
      </div>
    );
  if (statut === "vide")
    return <p className="p-8 text-center text-gray-500">Aucun élément.</p>;
  return (
    <div className="p-8 text-center">
      <p className="text-red-600">Impossible de charger les données.</p>
      {onReessayer && (
        <button onClick={onReessayer} className="mt-2 rounded border px-3 py-1 text-sm">
          Réessayer
        </button>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { jsonOuLeve } from "../lib/resource";
import { DataState } from "../components/DataState";
import { Chip } from "../components/Chip";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

type TableauDeBord = {
  annee_scolaire_id: number | null;
  annee_scolaire_libelle: string | null;
  etudiants_inscrits: number;
  encaissements: string;
  reste_a_recouvrer: string;
  depenses: string;
  solde_comptes: number | string;
  masse_salariale: string;
  resultats_par_decision: Record<string, number>;
  alertes: {
    echeances_en_retard: number;
    arretes_caisse_en_ecart: number;
  };
};

function formaterFCFA(valeur: string | number): string {
  const n = Number(valeur);
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function Carte({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{titre}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl font-semibold text-foreground">{valeur}</div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rapports", "tableau-de-bord"],
    queryFn: () =>
      apiFetch("/rapports/tableau-de-bord/").then(jsonOuLeve) as Promise<TableauDeBord>,
  });

  if (isLoading) return <DataState statut="chargement" />;
  if (isError || !data) return <DataState statut="erreur" onReessayer={refetch} />;

  const nbAlertes = data.alertes.echeances_en_retard + data.alertes.arretes_caisse_en_ecart;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          {data.annee_scolaire_libelle
            ? `Année scolaire courante : ${data.annee_scolaire_libelle}`
            : "Aucune année scolaire courante définie — indicateurs sur l'ensemble des données."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Carte titre="Étudiants inscrits" valeur={String(data.etudiants_inscrits)} />
        <Carte titre="Encaissements" valeur={formaterFCFA(data.encaissements)} />
        <Carte titre="Reste à recouvrer" valeur={formaterFCFA(data.reste_a_recouvrer)} />
        <Carte titre="Dépenses" valeur={formaterFCFA(data.depenses)} />
        <Carte titre="Solde des comptes" valeur={formaterFCFA(data.solde_comptes)} />
        <Carte titre="Masse salariale" valeur={formaterFCFA(data.masse_salariale)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Résultats (délibérés)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {Object.keys(data.resultats_par_decision).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun résultat annuel délibéré pour le moment.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.resultats_par_decision).map(([decision, nb]) => (
                <span key={decision} className="flex items-center gap-1 text-sm">
                  <Chip
                    variante={
                      decision === "ADMIS"
                        ? "success"
                        : decision === "REDOUBLE" || decision === "EXCLU"
                          ? "error"
                          : "warning"
                    }
                    label={decision}
                  />
                  <span className="text-muted-foreground">× {nb}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Alertes administratives</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {nbAlertes === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.alertes.echeances_en_retard > 0 && (
                <li>
                  <Chip variante="warning" label={String(data.alertes.echeances_en_retard)} />{" "}
                  échéance(s) en retard
                </li>
              )}
              {data.alertes.arretes_caisse_en_ecart > 0 && (
                <li>
                  <Chip variante="error" label={String(data.alertes.arretes_caisse_en_ecart)} />{" "}
                  arrêté(s) de caisse en écart
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

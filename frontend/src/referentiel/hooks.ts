import { REFERENTIEL as R } from '@/api/endpoints'
import { useAll } from '@/lib/hooks'
import type { SelectOption } from '@/components/ui/FormField'
import type {
  AnneeScolaire,
  Classe,
  Ecole,
  Filiere,
  Matiere,
  ModaliteFormation,
  Niveau,
  OptionFiliere,
  Periode,
  SessionExamen,
} from '@/lib/types'

export { REFERENTIEL as R } from '@/api/endpoints'

export function useEcoles() {
  return useAll<Ecole>(R.ecoles, { ordering: 'nom' })
}

export function useAnnees() {
  return useAll<AnneeScolaire>(R.annees, { ordering: '-libelle' })
}

export function useNiveaux(ecoleId?: number | string) {
  return useAll<Niveau>(R.niveaux, { ordering: 'ordre', ...(ecoleId ? { ecole: ecoleId } : {}) })
}

export function useFilieres(ecoleId?: number | string) {
  return useAll<Filiere>(R.filieres, { ordering: 'sigle', ...(ecoleId ? { ecole: ecoleId } : {}) })
}

export function useOptionsFiliere(filiereId?: number | string) {
  return useAll<OptionFiliere>(R.options, {
    ordering: 'sigle',
    ...(filiereId ? { filiere: filiereId } : {}),
  })
}

export function useClasses(anneeId?: number | string) {
  return useAll<Classe>(R.classes, {
    ordering: 'libelle_auto',
    ...(anneeId ? { annee_scolaire: anneeId } : {}),
  })
}

export function useMatieres() {
  return useAll<Matiere>(R.matieres, { ordering: 'nom' })
}

export function usePeriodes(anneeId?: number | string) {
  return useAll<Periode>(R.periodes, {
    ordering: 'numero',
    ...(anneeId ? { annee_scolaire: anneeId } : {}),
  })
}

export function useSessions() {
  return useAll<SessionExamen>(R.sessions, { ordering: 'id' })
}

export function useModalites() {
  return useAll<ModaliteFormation>(R.modalites, { ordering: 'code' })
}

export function versOptions<T>(
  liste: T[] | undefined,
  label: (item: T) => string,
): SelectOption[] {
  return (liste ?? []).map((item) => ({
    value: (item as { id: number }).id,
    label: label(item),
  }))
}

export const optionEcole = (e: Ecole) => e.sigle ?? e.nom
export const optionNiveau = (n: Niveau) => `${n.code} — ${n.libelle}`
export const optionFiliere = (f: Filiere) => `${f.sigle} — ${f.nom}`
export const optionOption = (o: OptionFiliere) => o.sigle || o.nom
export const optionAnnee = (a: AnneeScolaire) => a.libelle
export const optionClasse = (c: Classe) => c.libelle_auto
export const optionMatiere = (m: Matiere) => `${m.code} — ${m.nom}`
export const optionPeriode = (p: Periode) => `${p.libelle} (${p.annee_scolaire_libelle})`
export const optionSession = (s: SessionExamen) =>
  `${s.type === 'NORMALE' ? 'Normale' : 'Rattrapage'} — ${s.periode_libelle}`
export const optionModalite = (m: ModaliteFormation) => m.libelle

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { LoadingState } from '@/components/ui/States'
import { RequireAuth, RequireRole } from '@/routes/guards'
import { PageIntrouvable, PageNonAutorisee } from '@/app/pages'

const LoginPage = lazy(() =>
  import('@/comptes/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const MonComptePage = lazy(() =>
  import('@/comptes/MonComptePage').then((module) => ({ default: module.MonComptePage })),
)
const TableauDeBordPage = lazy(() =>
  import('@/tableau-de-bord/TableauDeBordPage').then((module) => ({
    default: module.TableauDeBordPage,
  })),
)

const EtudiantsPage = lazy(() =>
  import('@/personnes/EtudiantsPage').then((module) => ({ default: module.EtudiantsPage })),
)
const EtudiantDetailPage = lazy(() =>
  import('@/personnes/EtudiantDetailPage').then((module) => ({
    default: module.EtudiantDetailPage,
  })),
)
const InscriptionsPage = lazy(() =>
  import('@/personnes/InscriptionsPage').then((module) => ({
    default: module.InscriptionsPage,
  })),
)
const InscriptionDetailPage = lazy(() =>
  import('@/personnes/InscriptionDetailPage').then((module) => ({
    default: module.InscriptionDetailPage,
  })),
)

const ReferentielPage = lazy(() =>
  import('@/referentiel/ReferentielPage').then((module) => ({
    default: module.ReferentielPage,
  })),
)
const EcolesPage = lazy(() =>
  import('@/referentiel/EcolesPage').then((module) => ({ default: module.EcolesPage })),
)
const AnneesPage = lazy(() =>
  import('@/referentiel/AnneesPage').then((module) => ({ default: module.AnneesPage })),
)
const NiveauxPage = lazy(() =>
  import('@/referentiel/NiveauxPage').then((module) => ({ default: module.NiveauxPage })),
)
const FilieresPage = lazy(() =>
  import('@/referentiel/FilieresPage').then((module) => ({ default: module.FilieresPage })),
)
const OptionsPage = lazy(() =>
  import('@/referentiel/OptionsPage').then((module) => ({ default: module.OptionsPage })),
)
const ModalitesPage = lazy(() =>
  import('@/referentiel/ModalitesPage').then((module) => ({
    default: module.ModalitesPage,
  })),
)
const ClassesPage = lazy(() =>
  import('@/referentiel/ClassesPage').then((module) => ({ default: module.ClassesPage })),
)
const MatieresPage = lazy(() =>
  import('@/referentiel/MatieresPage').then((module) => ({ default: module.MatieresPage })),
)
const PeriodesPage = lazy(() =>
  import('@/referentiel/PeriodesPage').then((module) => ({
    default: module.PeriodesPage,
  })),
)

const EvaluationsPage = lazy(() =>
  import('@/evaluations/EvaluationsPage').then((module) => ({
    default: module.EvaluationsPage,
  })),
)
const NotesPage = lazy(() =>
  import('@/evaluations/NotesPage').then((module) => ({ default: module.NotesPage })),
)
const DeliberationsPage = lazy(() =>
  import('@/resultats/DeliberationsPage').then((module) => ({
    default: module.DeliberationsPage,
  })),
)
const ResultatsPage = lazy(() =>
  import('@/resultats/ResultatsPage').then((module) => ({
    default: module.ResultatsPage,
  })),
)

const TresorerieDashboardPage = lazy(() =>
  import('@/tresorerie/TresorerieDashboardPage').then((module) => ({
    default: module.TresorerieDashboardPage,
  })),
)
const EncaissementsPage = lazy(() =>
  import('@/tresorerie/EncaissementsPage').then((module) => ({
    default: module.EncaissementsPage,
  })),
)
const DepensesPage = lazy(() =>
  import('@/tresorerie/DepensesPage').then((module) => ({ default: module.DepensesPage })),
)
const VirementsPage = lazy(() =>
  import('@/tresorerie/VirementsPage').then((module) => ({ default: module.VirementsPage })),
)
const ComptesPage = lazy(() =>
  import('@/tresorerie/ComptesPage').then((module) => ({ default: module.ComptesPage })),
)
const CategoriesMouvementPage = lazy(() =>
  import('@/tresorerie/CategoriesMouvementPage').then((module) => ({
    default: module.CategoriesMouvementPage,
  })),
)
const MouvementsPage = lazy(() =>
  import('@/tresorerie/MouvementsPage').then((module) => ({
    default: module.MouvementsPage,
  })),
)
const ArretesCaissePage = lazy(() =>
  import('@/tresorerie/ArretesCaissePage').then((module) => ({
    default: module.ArretesCaissePage,
  })),
)

const GrilleTarifairePage = lazy(() =>
  import('@/scolarite/GrilleTarifairePage').then((module) => ({
    default: module.GrilleTarifairePage,
  })),
)
const BoursesPage = lazy(() =>
  import('@/scolarite/BoursesPage').then((module) => ({ default: module.BoursesPage })),
)
const EcheancesPage = lazy(() =>
  import('@/scolarite/EcheancesPage').then((module) => ({ default: module.EcheancesPage })),
)

const RapportsPage = lazy(() =>
  import('@/rapports/RapportsPage').then((module) => ({ default: module.RapportsPage })),
)

const EnseignantsPage = lazy(() =>
  import('@/paie/EnseignantsPage').then((module) => ({ default: module.EnseignantsPage })),
)
const PersonnelPage = lazy(() =>
  import('@/paie/PersonnelPage').then((module) => ({ default: module.PersonnelPage })),
)
const AffectationsPage = lazy(() =>
  import('@/paie/AffectationsPage').then((module) => ({ default: module.AffectationsPage })),
)
const SalairesEnseignantsPage = lazy(() =>
  import('@/paie/SalairesEnseignantsPage').then((module) => ({
    default: module.SalairesEnseignantsPage,
  })),
)
const SalairesAdministrationPage = lazy(() =>
  import('@/paie/SalairesAdministrationPage').then((module) => ({
    default: module.SalairesAdministrationPage,
  })),
)
const AvancesPage = lazy(() =>
  import('@/paie/AvancesPage').then((module) => ({ default: module.AvancesPage })),
)

function Enveloppe({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState label="Chargement…" />}>{children}</Suspense>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/connexion"
        element={
          <Enveloppe>
            <LoginPage />
          </Enveloppe>
        }
      />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route
            index
            element={
              <Enveloppe>
                <TableauDeBordPage />
              </Enveloppe>
            }
          />

          {/* Personnes & inscriptions */}
          <Route
            path="etudiants"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <EtudiantsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="etudiants/:id"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <EtudiantDetailPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="inscriptions"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <InscriptionsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="inscriptions/:id"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'DAF', 'COMPTABLE', 'LECTURE']}>
                <Enveloppe>
                  <InscriptionDetailPage />
                </Enveloppe>
              </RequireRole>
            }
          />

          {/* Référentiel */}
          <Route
            path="referentiel"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <ReferentielPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="referentiel/ecoles"
            element={
              <RequireRole roles={['DIRECTION']}>
                <Enveloppe>
                  <EcolesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="referentiel/annees"
            element={
              <RequireRole roles={['DIRECTION']}>
                <Enveloppe>
                  <AnneesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="referentiel/niveaux"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <NiveauxPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="referentiel/filieres"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <FilieresPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="referentiel/options"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <OptionsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="referentiel/modalites"
            element={
              <RequireRole roles={['DIRECTION']}>
                <Enveloppe>
                  <ModalitesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="classes"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <ClassesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="matieres"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <MatieresPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="periodes"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <PeriodesPage />
                </Enveloppe>
              </RequireRole>
            }
          />

          {/* Pédagogie & résultats */}
          <Route
            path="evaluations"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <EvaluationsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="notes"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE']}>
                <Enveloppe>
                  <NotesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="deliberations"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <DeliberationsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="resultats"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <ResultatsPage />
                </Enveloppe>
              </RequireRole>
            }
          />

          {/* Finances */}
          <Route
            path="tresorerie"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'SCOLARITE', 'LECTURE']}>
                <Enveloppe>
                  <TresorerieDashboardPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="encaissements"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <EncaissementsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="depenses"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <DepensesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="virements"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <VirementsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="comptes"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <ComptesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="comptes/categories"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <CategoriesMouvementPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="mouvements"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <MouvementsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="arretes-caisse"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <ArretesCaissePage />
                </Enveloppe>
              </RequireRole>
            }
          />

          {/* Scolarité financière */}
          <Route
            path="scolarite/grille-tarifaire"
            element={
              <RequireRole roles={['DIRECTION', 'DAF', 'COMPTABLE', 'LECTURE']}>
                <Enveloppe>
                  <GrilleTarifairePage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="scolarite/bourses"
            element={
              <RequireRole roles={['DIRECTION', 'DAF', 'COMPTABLE', 'LECTURE']}>
                <Enveloppe>
                  <BoursesPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="echeances"
            element={
              <RequireRole roles={['DIRECTION', 'SCOLARITE', 'DAF', 'COMPTABLE', 'LECTURE']}>
                <Enveloppe>
                  <EcheancesPage />
                </Enveloppe>
              </RequireRole>
            }
          />

          {/* Rapports */}
          <Route
            path="rapports"
            element={
              <RequireRole roles={['DIRECTION', 'DAF', 'COMPTABLE', 'SCOLARITE']}>
                <Enveloppe>
                  <RapportsPage />
                </Enveloppe>
              </RequireRole>
            }
          />

          {/* RH & paie */}
          <Route
            path="enseignants"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <EnseignantsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="personnel"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <PersonnelPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="affectations"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <AffectationsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="salaires-enseignants"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <SalairesEnseignantsPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="salaires-administration"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <SalairesAdministrationPage />
                </Enveloppe>
              </RequireRole>
            }
          />
          <Route
            path="avances"
            element={
              <RequireRole roles={['COMPTABLE', 'DAF', 'DIRECTION', 'LECTURE']}>
                <Enveloppe>
                  <AvancesPage />
                </Enveloppe>
              </RequireRole>
            }
          />

          <Route
            path="compte"
            element={
              <Enveloppe>
                <MonComptePage />
              </Enveloppe>
            }
          />
          <Route path="non-autorise" element={<PageNonAutorisee />} />
          <Route path="*" element={<PageIntrouvable />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

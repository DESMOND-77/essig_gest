import { ArrowLeft, FileText, Plus, Printer, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { DataTable, type Column } from '@/components/data/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, StatCard, Tabs } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField } from '@/components/ui/FormField'
import { ErrorState, InfoBanner, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, fcfa } from '@/lib/format'
import { useCreate, useDetail, useList } from '@/lib/hooks'
import { api, openDocument } from '@/lib/http'
import type {
  Echeance,
  Encaissement,
  FraisInscription,
  Inscription,
  PieceDossier,
  TypeFrais,
  TypePiece,
} from '@/lib/types'

type Onglet = 'echeancier' | 'frais' | 'pieces' | 'paiements'

const LIBELLES_ETAT: Record<string, string> = {
  ACTIVE: 'Active',
  ABANDON: 'Abandon',
  EXCLU: 'Exclu',
  DIPLOME: 'Diplômé',
}

export function InscriptionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const ecriture = peutEcrire(user, 'inscriptions')

  const [onglet, setOnglet] = useState<Onglet>('echeancier')
  const [pieceOuverte, setPieceOuverte] = useState(false)
  const [nouvellePiece, setNouvellePiece] = useState({ type_piece: '', fournie: 'true', date_reception: '' })

  const inscriptionQuery = useDetail<Inscription>('personnes/inscriptions', id)
  const typesPiece = useList<TypePiece>('personnes/types-piece')
  const typesFrais = useList<TypeFrais>('scolarite/types-frais')
  const paiements = useList<Encaissement>('tresorerie/encaissements', { inscription: id })
  const creationPiece = useCreate<PieceDossier>('personnes/pieces-dossier')

  if (inscriptionQuery.isLoading) return <LoadingState label="Chargement de l'inscription…" />
  if (inscriptionQuery.error || !inscriptionQuery.data) {
    return (
      <ErrorState
        title="Inscription introuvable"
        message={inscriptionQuery.error?.message}
        onRetry={() => void inscriptionQuery.refetch()}
      />
    )
  }

  const inscription = inscriptionQuery.data
  const echeances = inscription.echeances ?? []
  const frais = inscription.frais_inscription ?? []
  const pieces = inscription.pieces_dossier ?? []

  const totalDu = echeances.reduce((sum, e) => sum + Number(e.montant), 0)
  const totalPaye = echeances.reduce((sum, e) => sum + Number(e.montant_paye), 0)
  const reste = Math.max(0, totalDu - totalPaye)
  const fraisDu = frais.reduce((sum, f) => sum + (f.exonere ? 0 : Number(f.montant_du)), 0)

  const colonnesEcheances: Column<Echeance>[] = [
    {
      key: 'numero',
      header: 'Échéance',
      primary: true,
      render: (echeance) => (
        <span className="font-semibold">
          {echeance.numero === 0 ? 'Inscription' : `Mensualité ${echeance.numero}`}
        </span>
      ),
    },
    {
      key: 'date_echeance',
      header: 'Échéance',
      render: (echeance) => dateCourte(echeance.date_echeance),
    },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right',
      render: (echeance) => <span className="numeric">{fcfa(echeance.montant)}</span>,
    },
    {
      key: 'montant_paye',
      header: 'Payé',
      align: 'right',
      hideBelow: 'sm',
      render: (echeance) => (
        <span className="numeric">{fcfa(echeance.montant_paye)}</span>
      ),
    },
    {
      key: 'reste',
      header: 'Reste',
      align: 'right',
      render: (echeance) => {
        const resteLigne = Math.max(0, Number(echeance.montant) - Number(echeance.montant_paye))
        return (
          <span
            className={
              resteLigne > 0 ? 'numeric font-semibold text-[var(--warning)]' : 'numeric text-[var(--success)]'
            }
          >
            {fcfa(resteLigne)}
          </span>
        )
      },
    },
    {
      key: 'statut',
      header: 'Statut',
      hideBelow: 'md',
      render: (echeance) => (
        <Badge tone={tonStatut(echeance.statut)}>{echeance.statut}</Badge>
      ),
    },
  ]

  const colonnesFrais: Column<FraisInscription>[] = [
    {
      key: 'type',
      header: 'Frais',
      primary: true,
      render: (fraisLigne) => (
        <span className="font-medium">
          {typesFrais.data?.find((type) => type.id === fraisLigne.type_frais)?.libelle ??
            `Frais #${fraisLigne.type_frais}`}
        </span>
      ),
    },
    {
      key: 'montant',
      header: 'Montant dû',
      align: 'right',
      render: (fraisLigne) => (
        <span className="numeric">{fraisLigne.exonere ? 'Exonéré' : fcfa(fraisLigne.montant_du)}</span>
      ),
    },
    {
      key: 'commentaire',
      header: 'Commentaire',
      hideBelow: 'md',
      render: (fraisLigne) => fraisLigne.commentaire ?? '—',
    },
  ]

  const colonnesPieces: Column<PieceDossier>[] = [
    {
      key: 'type_piece',
      header: 'Pièce',
      primary: true,
      render: (piece) => {
        const type = typesPiece.data?.find((t) => t.id === piece.type_piece)
        return <span className="font-medium">{type?.libelle ?? `Pièce #${piece.type_piece}`}</span>
      },
    },
    {
      key: 'fournie',
      header: 'Fournie',
      render: (piece) => (
        <Badge tone={piece.fournie ? 'success' : 'warning'}>
          {piece.fournie ? 'Fournie' : 'Manquante'}
        </Badge>
      ),
    },
    {
      key: 'date_reception',
      header: 'Réception',
      hideBelow: 'md',
      render: (piece) => dateCourte(piece.date_reception),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (piece) =>
        ecriture ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await api.patch(`/api/v1/personnes/pieces-dossier/${piece.id}/`, {
                  fournie: !piece.fournie,
                })
                await inscriptionQuery.refetch()
              } catch (error) {
                toast.erreur('Mise à jour impossible', (error as Error).message)
              }
            }}
            className="min-h-9 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:underline"
          >
            Marquer {piece.fournie ? 'manquante' : 'fournie'}
          </button>
        ) : null,
    },
  ]

  const colonnesPaiements: Column<Encaissement>[] = [
    {
      key: 'recu',
      header: 'Reçu',
      primary: true,
      render: (encaissement) => (
        <span className="font-semibold">{encaissement.recu_numero}</span>
      ),
    },
    { key: 'date', header: 'Date', render: (encaissement) => dateCourte(encaissement.date) },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right',
      render: (encaissement) => (
        <span className="numeric">{fcfa(encaissement.montant_total)}</span>
      ),
    },
    {
      key: 'mode',
      header: 'Mode',
      hideBelow: 'md',
      render: (encaissement) =>
        encaissement.mode === 'ESPECES'
          ? 'Espèces'
          : encaissement.mode === 'MOBILE_MONEY'
            ? 'Mobile Money'
            : encaissement.mode === 'CHEQUE'
              ? 'Chèque'
              : 'Virement',
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (encaissement) => (
        <Badge tone={tonStatut(encaissement.statut)}>
          {encaissement.statut === 'EN_COURS'
            ? 'En cours'
            : encaissement.statut === 'VALIDE'
              ? 'Validé'
              : 'Annulé'}
        </Badge>
      ),
    },
    {
      key: 'recu_pdf',
      header: '',
      align: 'right',
      render: (encaissement) => (
        <button
          type="button"
          onClick={() =>
            void openDocument(`/api/v1/tresorerie/encaissements/${encaissement.id}/recu/`)
          }
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:underline"
        >
          <Receipt className="size-4" aria-hidden />
          Reçu
        </button>
      ),
    },
  ]

  const ajouterPiece = async () => {
    try {
      await creationPiece.mutateAsync({
        inscription: inscription.id,
        type_piece: Number(nouvellePiece.type_piece),
        fournie: nouvellePiece.fournie === 'true',
        date_reception: nouvellePiece.date_reception || null,
      })
      toast.succes('Pièce ajoutée')
      setPieceOuverte(false)
      await inscriptionQuery.refetch()
    } catch (error) {
      toast.erreur('Ajout impossible', (error as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title={`Inscription n° ${inscription.numero_ordre}`}
        description={`${inscription.etudiant_libelle} · ${inscription.classe_libelle} · ${inscription.ecole_libelle}`}
        breadcrumbs={[
          { label: 'Scolarité' },
          { label: 'Inscriptions', to: '/inscriptions' },
          { label: `N° ${inscription.numero_ordre}` },
        ]}
        badge={<Badge tone={tonStatut(inscription.etat)}>{LIBELLES_ETAT[inscription.etat]}</Badge>}
        actions={
          <>
            <Link
              to="/inscriptions"
              className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)]"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Retour
            </Link>
            <Button
              variant="outline"
              icon={<Printer className="size-4" aria-hidden />}
              onClick={() =>
                void openDocument('/api/v1/rapports/situation-scolarite/pdf/', {
                  inscription_id: inscription.id,
                })
              }
            >
              Fiche de scolarité
            </Button>
            <Link
              to={`/encaissements?inscription=${inscription.id}`}
              className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Wallet className="size-4" aria-hidden />
              Encaisser
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Coût scolarité" value={fcfa(totalDu)} icon={<FileText className="size-5" aria-hidden />} />
        <StatCard
          label="Encaissé"
          value={fcfa(totalPaye)}
          tone="success"
          icon={<Wallet className="size-5" aria-hidden />}
        />
        <StatCard
          label="Reste à payer"
          value={fcfa(reste)}
          tone={reste > 0 ? 'warning' : 'success'}
        />
        <StatCard label="Frais annexes" value={fcfa(fraisDu)} tone="accent" />
      </div>

      <div className="mb-3">
        <Tabs<Onglet>
          label="Détail de l’inscription"
          value={onglet}
          onChange={setOnglet}
          tabs={[
            { value: 'echeancier', label: 'Échéancier', count: echeances.length },
            { value: 'frais', label: 'Frais', count: frais.length },
            { value: 'pieces', label: 'Pièces', count: pieces.length },
            { value: 'paiements', label: 'Paiements', count: paiements.data?.length },
          ]}
        />
      </div>

      {onglet === 'echeancier' ? (
        <DataTable
          columns={colonnesEcheances}
          rows={echeances}
          rowKey={(echeance) => echeance.id}
          caption="Échéancier de l’inscription"
          mobileCards={false}
          emptyTitle="Aucune échéance"
          emptyDescription="L’échéancier est généré à la création de l’inscription selon la grille tarifaire."
        />
      ) : null}

      {onglet === 'frais' ? (
        <DataTable
          columns={colonnesFrais}
          rows={frais}
          rowKey={(fraisLigne) => fraisLigne.id}
          caption="Frais annexes de l’inscription"
          mobileCards={false}
          emptyTitle="Aucun frais annexe"
          emptyDescription="Les frais obligatoires sont matérialisés à la création de l’inscription."
        />
      ) : null}

      {onglet === 'pieces' ? (
        <Card>
          <CardHeader
            title="Pièces du dossier"
            description="Suivi des pièces fournies par l’étudiant."
            actions={
              ecriture ? (
                <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setPieceOuverte(true)}>
                  Ajouter une pièce
                </Button>
              ) : undefined
            }
          />
          <DataTable
            columns={colonnesPieces}
            rows={pieces}
            rowKey={(piece) => piece.id}
            caption="Pièces du dossier"
            mobileCards={false}
            emptyTitle="Aucune pièce"
            emptyDescription="Ajoutez les pièces exigées (acte de naissance, relevé BAC, photos…)."
          />
        </Card>
      ) : null}

      {onglet === 'paiements' ? (
        <DataTable
          columns={colonnesPaiements}
          rows={paiements.data ?? []}
          rowKey={(encaissement) => encaissement.id}
          caption="Paiements de l’inscription"
          loading={paiements.isLoading}
          error={paiements.error}
          onRetry={() => void paiements.refetch()}
          emptyTitle="Aucun paiement"
          emptyDescription="Les encaissements saisis pour cette inscription apparaîtront ici."
        />
      ) : null}

      <div className="mt-4">
        <InfoBanner tone="info" title="Cohérence financière">
          Le reste à payer affiché ici est informatif. Le contrôle définitif est réalisé par le
          serveur au moment de l’imputation d’un encaissement.
        </InfoBanner>
      </div>

      <Dialog
        open={pieceOuverte}
        onClose={() => setPieceOuverte(false)}
        title="Ajouter une pièce"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPieceOuverte(false)}>
              Annuler
            </Button>
            <Button onClick={() => void ajouterPiece()} loading={creationPiece.isPending}>
              Ajouter
            </Button>
          </>
        }
      >
        <FormGrid>
          <SelectField
            label="Type de pièce"
            required
            value={nouvellePiece.type_piece}
            placeholder="— Sélectionner —"
            options={(typesPiece.data ?? []).map((type) => ({ value: type.id, label: type.libelle }))}
            onChange={(event) =>
              setNouvellePiece((current) => ({ ...current, type_piece: event.target.value }))
            }
            containerClassName="md:col-span-2"
          />
          <SelectField
            label="Statut"
            value={nouvellePiece.fournie}
            onChange={(event) =>
              setNouvellePiece((current) => ({ ...current, fournie: event.target.value }))
            }
            options={[
              { value: 'true', label: 'Fournie' },
              { value: 'false', label: 'Manquante' },
            ]}
          />
          <InputField
            label="Date de réception"
            type="date"
            value={nouvellePiece.date_reception}
            onChange={(event) =>
              setNouvellePiece((current) => ({ ...current, date_reception: event.target.value }))
            }
          />
        </FormGrid>
      </Dialog>
    </>
  )
}

import { ArrowLeft, GraduationCap, Mail, MapPin, Phone, Plus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { DataTable, type Column } from '@/components/data/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField } from '@/components/ui/FormField'
import { ErrorState, InfoBanner, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, nomComplet } from '@/lib/format'
import { useCreate, useDetail, usePagedList } from '@/lib/hooks'
import { ApiError } from '@/lib/http'
import type { Affiliation, Etudiant, Inscription, SituationBac } from '@/lib/types'
import { LienFiche } from '@/components/data/ResourcePage'

export function EtudiantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'personnes')
  const toast = useToast()

  const etudiantQuery = useDetail<Etudiant>('personnes/etudiants', id)
  const inscriptionsQuery = usePagedList<Inscription>('personnes/inscriptions', {
    etudiant: id,
    ordering: '-date_inscription',
  })

  const [affiliationOuverte, setAffiliationOuverte] = useState(false)
  const [bacOuvert, setBacOuvert] = useState(false)
  const [affiliation, setAffiliation] = useState({
    type: 'PERE',
    nom: '',
    prenom: '',
    contact: '',
    profession: '',
  })
  const [bac, setBac] = useState({
    a_le_bac: 'true',
    annee_obtention: '',
    serie: '',
    mention: '',
    etablissement: '',
    ville: '',
  })

  const creationAffiliation = useCreate<Affiliation>('personnes/affiliations')
  const creationBac = useCreate<SituationBac>('personnes/situation-bac')

  if (etudiantQuery.isLoading) return <LoadingState label="Chargement de la fiche…" />
  if (etudiantQuery.error || !etudiantQuery.data) {
    return (
      <ErrorState
        title="Étudiant introuvable"
        message={etudiantQuery.error?.message}
        onRetry={() => void etudiantQuery.refetch()}
      />
    )
  }

  const etudiant = etudiantQuery.data
  const inscriptions = inscriptionsQuery.data?.results ?? []

  const colonnesInscriptions: Column<Inscription>[] = [
    {
      key: 'annee',
      header: 'Année',
      primary: true,
      render: (inscription) => (
        <LienFiche to={`/inscriptions/${inscription.id}`}>#{inscription.numero_ordre}</LienFiche>
      ),
    },
    { key: 'classe', header: 'Classe', render: (inscription) => inscription.classe_libelle },
    {
      key: 'etat',
      header: 'État',
      render: (inscription) => (
        <Badge tone={inscription.etat === 'ACTIVE' ? 'success' : 'neutral'}>
          {inscription.etat === 'ACTIVE'
            ? 'Active'
            : inscription.etat === 'DIPLOME'
              ? 'Diplômé'
              : inscription.etat === 'ABANDON'
                ? 'Abandon'
                : 'Exclu'}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Inscrit le',
      hideBelow: 'md',
      render: (inscription) => dateCourte(inscription.date_inscription),
    },
  ]

  const ajouterAffiliation = async () => {
    try {
      await creationAffiliation.mutateAsync({
        ...affiliation,
        etudiant: etudiant.id,
        profession: affiliation.profession || null,
      })
      toast.succes('Affiliation enregistrée')
      setAffiliationOuverte(false)
      setAffiliation({ type: 'PERE', nom: '', prenom: '', contact: '', profession: '' })
      await etudiantQuery.refetch()
    } catch (error) {
      toast.erreur('Enregistrement impossible', (error as Error).message)
    }
  }

  const enregistrerBac = async () => {
    try {
      await creationBac.mutateAsync({
        etudiant: etudiant.id,
        a_le_bac: bac.a_le_bac === 'true',
        annee_obtention: bac.annee_obtention ? Number(bac.annee_obtention) : null,
        serie: bac.serie || null,
        mention: bac.mention || null,
        etablissement: bac.etablissement || null,
        ville: bac.ville || null,
      })
      toast.succes('Situation BAC enregistrée')
      setBacOuvert(false)
      await etudiantQuery.refetch()
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 400
          ? 'Une situation BAC existe déjà pour cet étudiant.'
          : (error as Error).message
      toast.erreur('Enregistrement impossible', message)
    }
  }

  const affiliations = etudiant.affiliations ?? []
  const situationBac = etudiant.situation_bac ?? null

  return (
    <>
      <PageHeader
        title={nomComplet({ nom: etudiant.nom, prenoms: etudiant.prenoms })}
        description={`Matricule ${etudiant.matricule}`}
        breadcrumbs={[
          { label: 'Scolarité' },
          { label: 'Étudiants', to: '/etudiants' },
          { label: etudiant.matricule },
        ]}
        actions={
          <Link
            to="/etudiants"
            className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Retour
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Inscriptions"
              description="Parcours de l’étudiant, une inscription par année scolaire."
              actions={
                ecriture ? (
                  <Link
                    to={`/inscriptions?etudiant=${etudiant.id}`}
                    className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <Plus className="size-4" aria-hidden />
                    Inscrire
                  </Link>
                ) : undefined
              }
            />
            <DataTable
              columns={colonnesInscriptions}
              rows={inscriptions}
              rowKey={(inscription) => inscription.id}
              caption="Inscriptions de l’étudiant"
              loading={inscriptionsQuery.isLoading}
              error={inscriptionsQuery.error}
              onRetry={() => void inscriptionsQuery.refetch()}
              emptyTitle="Aucune inscription"
              emptyDescription="Cet étudiant n’a pas encore été inscrit dans une classe."
              mobileCards={false}
            />
          </Card>

          <Card>
            <CardHeader
              title="Affiliations"
              description="Père, mère ou tuteur — un contact par type."
              actions={
                ecriture ? (
                  <Button size="sm" variant="secondary" onClick={() => setAffiliationOuverte(true)}>
                    Ajouter
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {affiliations.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Aucune affiliation renseignée.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {affiliations.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="brand">
                          {item.type === 'PERE' ? 'Père' : item.type === 'MERE' ? 'Mère' : 'Tuteur'}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium">
                        {item.nom} {item.prenom}
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">{item.contact}</p>
                      {item.profession ? (
                        <p className="text-xs text-[var(--muted-foreground)]">{item.profession}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Identité" />
            <CardBody className="space-y-3 text-sm">
              <Ligne icone={<UserRound className="size-4" aria-hidden />} label="Sexe">
                {etudiant.sexe === 'F' ? 'Féminin' : 'Masculin'}
              </Ligne>
              <Ligne icone={<GraduationCap className="size-4" aria-hidden />} label="Naissance">
                {dateCourte(etudiant.date_naissance)}
                {etudiant.lieu_naissance ? ` à ${etudiant.lieu_naissance}` : ''}
              </Ligne>
              <Ligne icone={<Phone className="size-4" aria-hidden />} label="Téléphone">
                {etudiant.telephone ?? '—'}
              </Ligne>
              <Ligne icone={<Mail className="size-4" aria-hidden />} label="E-mail">
                {etudiant.email ?? '—'}
              </Ligne>
              <Ligne icone={<MapPin className="size-4" aria-hidden />} label="Adresse">
                {etudiant.adresse ?? '—'}
              </Ligne>
              <Ligne label="Nationalité">{etudiant.nationalite ?? '—'}</Ligne>
              <Ligne label="Situation">
                {etudiant.situation_matrimoniale === 'MARIE'
                  ? 'Marié(e)'
                  : etudiant.situation_matrimoniale === 'CELIBATAIRE'
                    ? 'Célibataire'
                    : '—'}
              </Ligne>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Situation BAC"
              actions={
                ecriture && !situationBac ? (
                  <Button size="sm" variant="secondary" onClick={() => setBacOuvert(true)}>
                    Renseigner
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {situationBac ? (
                <div className="space-y-2 text-sm">
                  <Badge tone={situationBac.a_le_bac ? 'success' : 'neutral'}>
                    {situationBac.a_le_bac ? 'Bachelier' : 'Non bachelier'}
                  </Badge>
                  <p>Série : {situationBac.serie ?? '—'}</p>
                  <p>Mention : {situationBac.mention ?? '—'}</p>
                  <p>Année : {situationBac.annee_obtention ?? '—'}</p>
                  <p className="text-[var(--muted-foreground)]">
                    {situationBac.etablissement ?? '—'}
                    {situationBac.ville ? ` · ${situationBac.ville}` : ''}
                  </p>
                </div>
              ) : (
                <InfoBanner tone="info" title="Non renseignée">
                  La situation BAC n’est pas obligatoire, mais elle est utile pour les statistiques
                  d’admission.
                </InfoBanner>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={affiliationOuverte}
        onClose={() => setAffiliationOuverte(false)}
        title="Ajouter une affiliation"
        footer={
          <>
            <Button variant="outline" onClick={() => setAffiliationOuverte(false)}>
              Annuler
            </Button>
            <Button onClick={() => void ajouterAffiliation()} loading={creationAffiliation.isPending}>
              Enregistrer
            </Button>
          </>
        }
      >
        <FormGrid>
          <SelectField
            label="Lien"
            required
            value={affiliation.type}
            onChange={(event) => setAffiliation((current) => ({ ...current, type: event.target.value }))}
            options={[
              { value: 'PERE', label: 'Père' },
              { value: 'MERE', label: 'Mère' },
              { value: 'TUTEUR', label: 'Tuteur' },
            ]}
          />
          <InputField
            label="Profession"
            value={affiliation.profession}
            onChange={(event) => setAffiliation((current) => ({ ...current, profession: event.target.value }))}
          />
          <InputField
            label="Nom"
            required
            value={affiliation.nom}
            onChange={(event) => setAffiliation((current) => ({ ...current, nom: event.target.value }))}
          />
          <InputField
            label="Prénom"
            required
            value={affiliation.prenom}
            onChange={(event) => setAffiliation((current) => ({ ...current, prenom: event.target.value }))}
          />
          <InputField
            label="Contact"
            required
            type="tel"
            value={affiliation.contact}
            onChange={(event) => setAffiliation((current) => ({ ...current, contact: event.target.value }))}
            containerClassName="md:col-span-2"
          />
        </FormGrid>
      </Dialog>

      <Dialog
        open={bacOuvert}
        onClose={() => setBacOuvert(false)}
        title="Situation BAC"
        footer={
          <>
            <Button variant="outline" onClick={() => setBacOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={() => void enregistrerBac()} loading={creationBac.isPending}>
              Enregistrer
            </Button>
          </>
        }
      >
        <FormGrid>
          <SelectField
            label="Bachelier"
            value={bac.a_le_bac}
            onChange={(event) => setBac((current) => ({ ...current, a_le_bac: event.target.value }))}
            options={[
              { value: 'true', label: 'Oui' },
              { value: 'false', label: 'Non' },
            ]}
          />
          <InputField
            label="Année d’obtention"
            type="number"
            min={1950}
            max={2100}
            value={bac.annee_obtention}
            onChange={(event) => setBac((current) => ({ ...current, annee_obtention: event.target.value }))}
          />
          <InputField
            label="Série"
            value={bac.serie}
            onChange={(event) => setBac((current) => ({ ...current, serie: event.target.value }))}
          />
          <SelectField
            label="Mention"
            value={bac.mention}
            placeholder="Non renseignée"
            onChange={(event) => setBac((current) => ({ ...current, mention: event.target.value }))}
            options={[
              { value: 'TB', label: 'Très bien' },
              { value: 'B', label: 'Bien' },
              { value: 'AB', label: 'Assez bien' },
              { value: 'P', label: 'Passable' },
            ]}
          />
          <InputField
            label="Établissement"
            value={bac.etablissement}
            onChange={(event) => setBac((current) => ({ ...current, etablissement: event.target.value }))}
          />
          <InputField
            label="Ville"
            value={bac.ville}
            onChange={(event) => setBac((current) => ({ ...current, ville: event.target.value }))}
          />
        </FormGrid>
      </Dialog>
    </>
  )
}

function Ligne({
  icone,
  label,
  children,
}: {
  icone?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icone ? <span className="mt-0.5 text-[var(--muted-foreground)]">{icone}</span> : null}
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </p>
        <p className="text-[var(--foreground)]">{children}</p>
      </div>
    </div>
  )
}

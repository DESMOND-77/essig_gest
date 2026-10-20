import { useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/ui/Card'
import { BoursesPage } from './BoursesPage'
import { ModalitesPaiementPage } from './ModalitesPaiementPage'
import { TypesFraisPage } from './TypesFraisPage'

type Onglet = 'modalites' | 'frais' | 'bourses'

export function GrilleTarifairePage() {
  const [onglet, setOnglet] = useState<Onglet>('modalites')

  return (
    <>
      <PageHeader
        title="Grille tarifaire"
        description="Barème de scolarité par niveau, frais annexes et bourses. Ces montants alimentent les inscriptions et l’échéancier."
      />
      <div className="mb-4">
        <Tabs<Onglet>
          label="Sections de la grille tarifaire"
          value={onglet}
          onChange={setOnglet}
          tabs={[
            { value: 'modalites', label: 'Modalités de paiement' },
            { value: 'frais', label: 'Types de frais' },
            { value: 'bourses', label: 'Bourses' },
          ]}
        />
      </div>

      {onglet === 'modalites' ? (
        <ModalitesPaiementPage />
      ) : onglet === 'frais' ? (
        <TypesFraisPage />
      ) : (
        <BoursesPage />
      )}
    </>
  )
}

import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Coins,
  CreditCard,
  FileBarChart,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  ListOrdered,
  ScrollText,
  ShieldCheck,
  Users,
  UserSquare2,
  Wallet,
  WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { peutLireFinances, possedeRole } from '@/auth/permissions'
import type { Utilisateur } from '@/lib/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Fin d'URL exacte (sinon préfixe). */
  end?: boolean
  visible?: (user: Utilisateur | null) => boolean
}

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
  visible?: (user: Utilisateur | null) => boolean
}

const finances = (user: Utilisateur | null) => peutLireFinances(user)

export const NAVIGATION: NavSection[] = [
  {
    id: 'pilotage',
    label: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      {
        to: '/rapports',
        label: 'Rapports & états',
        icon: FileBarChart,
        visible: (user) => possedeRole(user, 'DIRECTION', 'DAF', 'COMPTABLE', 'SCOLARITE'),
      },
    ],
  },
  {
    id: 'scolarite',
    label: 'Scolarité',
    items: [
      { to: '/etudiants', label: 'Étudiants', icon: GraduationCap },
      { to: '/inscriptions', label: 'Inscriptions', icon: ClipboardList },
      { to: '/classes', label: 'Classes', icon: Users },
      { to: '/matieres', label: 'Matières', icon: BookOpen },
      { to: '/periodes', label: 'Périodes & sessions', icon: CalendarDays },
      { to: '/echeances', label: 'Échéancier', icon: CalendarClock },
      { to: '/referentiel', label: 'Référentiel', icon: LibraryBig },
    ],
  },
  {
    id: 'pedagogie',
    label: 'Pédagogie & résultats',
    items: [
      { to: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
      { to: '/notes', label: 'Saisie des notes', icon: ListChecks },
      { to: '/deliberations', label: 'Délibérations', icon: ShieldCheck },
      { to: '/resultats', label: 'Résultats', icon: FileSpreadsheet },
    ],
  },
  {
    id: 'finances',
    label: 'Finances',
    visible: finances,
    items: [
      { to: '/tresorerie', label: 'Trésorerie', icon: Wallet, end: true },
      { to: '/encaissements', label: 'Encaissements', icon: Banknote },
      { to: '/depenses', label: 'Dépenses', icon: CreditCard },
      { to: '/virements', label: 'Virements', icon: ArrowLeftRight },
      { to: '/comptes', label: 'Comptes & catégories', icon: Landmark },
      { to: '/arretes-caisse', label: 'Arrêtés de caisse', icon: Coins },
      { to: '/mouvements', label: 'Journal de caisse', icon: ListOrdered },
      { to: '/scolarite/grille-tarifaire', label: 'Grille tarifaire', icon: WalletCards },
      { to: '/scolarite/bourses', label: 'Bourses', icon: ScrollText },
    ],
  },
  {
    id: 'rh',
    label: 'RH & paie',
    visible: finances,
    items: [
      { to: '/enseignants', label: 'Enseignants', icon: UserSquare2 },
      { to: '/personnel', label: 'Personnel administratif', icon: Users },
      { to: '/affectations', label: 'Affectations', icon: BookOpen },
      { to: '/salaires-enseignants', label: 'Salaires enseignants', icon: Wallet },
      { to: '/salaires-administration', label: 'Salaires administration', icon: Wallet },
      { to: '/avances', label: 'Avances personnel', icon: Coins },
    ],
  },
]

export function sectionsVisibles(user: Utilisateur | null): NavSection[] {
  return NAVIGATION.filter((section) => !section.visible || section.visible(user)).map(
    (section) => ({
      ...section,
      items: section.items.filter((item) => !item.visible || item.visible(user)),
    }),
  )
}

export function titreDeRoute(pathname: string): string {
  // On parcourt toute la navigation, y compris les sections masquées à
  // l'utilisateur : le fil d'Ariane doit rester correct sur une route profonde.
  const flat = NAVIGATION.flatMap((section) => section.items)
  const match = flat
    .filter((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'ESSIG Gest'
}

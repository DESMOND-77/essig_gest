import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import logoMark from '@/assets/logos/essig-mark.png'
import { libelleRole } from '@/auth/permissions'
import { initiales } from '@/lib/format'
import { cn } from '@/lib/utils'
import { sectionsVisibles, type NavItem } from '@/routes/navigation'

const STORAGE_SIDEBAR = 'essig.sidebar.reduite'

export function AppShell() {
  const { user, deconnexion } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reduite, setReduite] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_SIDEBAR) === '1'
    } catch {
      return false
    }
  })
  const contenuRef = useRef<HTMLElement>(null)

  const sections = useMemo(() => sectionsVisibles(user), [user])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // À chaque changement de route : retour en haut et focus sur le titre.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const titre = contenuRef.current?.querySelector<HTMLElement>('h1')
    titre?.setAttribute('tabindex', '-1')
    titre?.focus({ preventScroll: true })
  }, [location.pathname])

  const basculerReduction = () => {
    setReduite((current) => {
      const next = !current
      try {
        window.localStorage.setItem(STORAGE_SIDEBAR, next ? '1' : '0')
      } catch {
        /* préférence non persistée */
      }
      return next
    })
  }

  const deconnecter = async () => {
    await deconnexion()
    navigate('/connexion', { replace: true })
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#contenu-principal"
        className="sr-only rounded-md bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[70]"
      >
        Aller au contenu principal
      </a>

      <SidebarReduite
        sections={sections}
        reduite={reduite}
        onToggleReduction={basculerReduction}
      />

      {drawerOpen ? (
        <TiroirMobile
          sections={sections}
          onClose={() => setDrawerOpen(false)}
          onLogout={deconnecter}
        />
      ) : null}

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-200',
          reduite ? 'lg:pl-[72px]' : 'lg:pl-[256px]',
        )}
      >
        <Topbar
          onOpenDrawer={() => setDrawerOpen(true)}
          onLogout={deconnecter}
          reduite={reduite}
          onToggleReduction={basculerReduction}
        />
        <main
          id="contenu-principal"
          ref={contenuRef}
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
        >
          <Outlet />
        </main>
        <footer className="no-print mx-auto w-full max-w-[1440px] px-4 pt-2 pb-5 text-xs text-[var(--muted-foreground)] sm:px-6 lg:px-8">
          Groupe ESSIG, {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  )
}

function SidebarReduite({
  sections,
  reduite,
  onToggleReduction,
}: {
  sections: ReturnType<typeof sectionsVisibles>
  reduite: boolean
  onToggleReduction: () => void
}) {
  return (
    <aside
      className={cn(
        'no-print fixed inset-y-0 left-0 z-40 hidden flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200 lg:flex',
        reduite ? 'w-[72px]' : 'w-[256px]',
      )}
      aria-label="Navigation principale"
    >
      <div className={cn('flex h-16 items-center gap-3 px-4', reduite && 'justify-center px-2')}>
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="ESSIG Gest — accueil">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-white">
            <img src={logoMark} alt="" width={40} height={40} className="size-10 object-contain" />
          </span>
          {!reduite ? (
            <span className="min-w-0 leading-tight">
              <span className="font-display block truncate text-xl font-bold text-white">
                ESSIG Gest
              </span>
              <span className="block truncate text-xs text-[var(--sidebar-muted)]">
                Gestion scolaire
              </span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav className={cn('scroll-slim flex-1 overflow-y-auto pt-2 pb-4', reduite ? 'pl-2' : 'pl-3')}>
        {sections.map((section) => (
          <div key={section.id} className="mt-4 first:mt-1">
            {!reduite ? (
              <p className="nav-section">{section.label}</p>
            ) : (
              <div className="mr-2 mb-2 border-t border-[var(--sidebar-rule)]" aria-hidden />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={reduite ? item.label : undefined}
                    aria-label={reduite ? item.label : undefined}
                    className={cn('nav-tab nav-tab--joint', reduite && 'justify-center px-0')}
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    {!reduite ? <span className="truncate">{item.label}</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--sidebar-rule)] p-2">
        <button
          type="button"
          onClick={onToggleReduction}
          className={cn(
            'flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-[var(--sidebar-muted)] transition hover:bg-[var(--sidebar-hover)] hover:text-white',
            reduite && 'justify-center px-0',
          )}
          aria-label={reduite ? 'Déplier la navigation' : 'Réduire la navigation'}
        >
          {reduite ? (
            <PanelLeftOpen className="size-[18px]" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-[18px]" aria-hidden />
              <span>Réduire</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function TiroirMobile({
  sections,
  onClose,
  onLogout,
}: {
  sections: ReturnType<typeof sectionsVisibles>
  onClose: () => void
  onLogout: () => void
}) {
  const { user } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="animate-fade-in absolute inset-0 bg-ink-900/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="animate-sheet-in absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-white">
              <img src={logoMark} alt="" width={40} height={40} className="size-10 object-contain" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-xl font-bold text-white">ESSIG Gest</p>
              <p className="text-xs text-[var(--sidebar-muted)]">Gestion scolaire</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la navigation"
            className="grid size-10 place-items-center rounded-full text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="scroll-slim flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.id} className="mt-4 first:mt-1">
              <p className="nav-section">{section.label}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className="nav-tab min-h-11"
                    >
                      <item.icon className="size-[18px] shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--sidebar-rule)] p-3 pb-[calc(0.75rem+var(--safe-bottom))]">
          <div className="flex items-center gap-3 px-1">
            <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-bold text-[var(--sidebar)]">
              {initiales(user?.login, user?.login?.slice(1))}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.login}</p>
              <p className="truncate text-[11px] text-[var(--sidebar-muted)]">
                {user?.roles.map((role) => libelleRole(role.code)).join(' · ') || 'Aucun rôle'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-white"
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}

function Topbar({
  onOpenDrawer,
  onLogout,
  reduite,
  onToggleReduction,
}: {
  onOpenDrawer: () => void
  onLogout: () => void
  reduite: boolean
  onToggleReduction: () => void
}) {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)

  // Où suis-je : section du classeur + entrée active (la plus spécifique).
  const { section, titre } = useMemo(() => {
    const candidats: { section: string; item: NavItem }[] = sectionsVisibles(user).flatMap(
      (s) => s.items.map((item) => ({ section: s.label, item })),
    )
    const actif = candidats
      .filter(({ item }) =>
        item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
      )
      .sort((a, b) => b.item.to.length - a.item.to.length)[0]
    return { section: actif?.section, titre: actif?.item.label ?? 'ESSIG Gest' }
  }, [location.pathname, user])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="no-print glass sticky top-0 z-30 flex h-14 items-center gap-2 border-x-0 border-t-0 px-3 shadow-none sm:h-16 sm:gap-3 sm:px-5 lg:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Ouvrir la navigation"
        className="grid size-10 place-items-center rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-muted)] lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={onToggleReduction}
        aria-label={reduite ? 'Déplier la navigation' : 'Réduire la navigation'}
        className="hidden size-10 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] lg:grid"
      >
        {reduite ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <img
          src={logoMark}
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-md object-contain lg:hidden"
        />
        <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
          {section ? (
            <>
              <span className="hidden shrink-0 text-[var(--muted-foreground)] sm:inline">
                {section}
              </span>
              <span className="hidden text-[var(--border-strong)] sm:inline" aria-hidden>
                /
              </span>
            </>
          ) : null}
          <span className="truncate font-semibold text-[var(--foreground)]">{titre}</span>
        </p>
      </div>

      <div className="flex-1" />

      <Link
        to="/rapports"
        className="hidden h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--muted-foreground)] transition hover:border-brand-300 hover:text-brand-700 sm:flex"
        aria-label="Rechercher dans les rapports"
      >
        <Search className="size-4" aria-hidden />
        <span>Rapports</span>
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] pr-2 pl-1 transition hover:border-brand-300"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[var(--sidebar)] text-xs font-bold text-white">
            {initiales(user?.login, user?.login?.slice(1))}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium text-[var(--foreground)] sm:block">
            {user?.login}
          </span>
          <ChevronDown className="size-4 text-[var(--muted-foreground)]" aria-hidden />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="animate-fade-in absolute right-0 mt-2 w-64 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-pop)]"
          >
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{user?.login}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">{user?.email}</p>
              <p className="mt-1 text-xs text-[var(--sidebar)]">
                {user?.roles.map((role) => libelleRole(role.code)).join(' · ') || 'Aucun rôle'}
              </p>
            </div>
            <Link
              to="/compte"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center gap-2 px-4 text-sm hover:bg-[var(--surface-muted)]"
            >
              <UserRound className="size-4" aria-hidden />
              Mon compte
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="flex min-h-11 w-full items-center gap-2 border-t border-[var(--border)] px-4 text-sm text-[var(--destructive)] hover:bg-[var(--destructive-subtle)]"
            >
              <LogOut className="size-4" aria-hidden />
              Se déconnecter
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

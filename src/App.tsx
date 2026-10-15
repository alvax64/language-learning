import { LogOutIcon, SettingsIcon } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Assistant } from '@/components/assistant'
import { DeckView } from '@/components/deck-view'
import { SettingsDialog } from '@/components/dialogs'
import { HomeView } from '@/components/home-view'
import { LoginView } from '@/components/login-view'
import { ModeToggle } from '@/components/mode-toggle'
import { StudyView } from '@/components/study-view'
import { Button } from '@/components/ui/button'
import * as AUTH from '@/lib/auth'
import { navigate } from '@/lib/format'
import { stopSpeaking } from '@/lib/speech'
import { getDeck, useStore } from '@/lib/store'

function useHash() {
  return useSyncExternalStore(
    l => {
      window.addEventListener('hashchange', l)
      return () => window.removeEventListener('hashchange', l)
    },
    () => location.hash,
  )
}

export default function App() {
  useStore()
  const hash = useHash()
  const [user, setUser] = useState(AUTH.currentUser)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [view, id, sub] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const deck = view === 'deck' ? getDeck(id) : undefined
  const unknownRoute = !!user && !!view && !deck

  useEffect(() => {
    stopSpeaking()
    window.scrollTo(0, 0)
  }, [hash])

  useEffect(() => {
    if (unknownRoute) navigate('#/')
  }, [unknownRoute])

  const logout = () => {
    AUTH.logout()
    setUser(null)
    navigate('#/')
  }

  let content
  if (!user) content = <LoginView signup={!AUTH.hasUsers() || hash === '#/signup'} onLogin={setUser} />
  else if (deck && (sub === 'study' || sub === 'cram')) content = <StudyView key={hash} deck={deck} cram={sub === 'cram'} />
  else if (deck) content = <DeckView key={deck.id} deck={deck} />
  else content = <HomeView />

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <a href="#/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span aria-hidden="true">🗂️</span> LingoCards
          </a>
          <div className="flex items-center gap-1">
            {user && (
              <>
                <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon data-icon="inline-start" /> <span className="max-sm:sr-only">Settings</span>
                </Button>
                <Button variant="ghost" onClick={logout}>
                  <LogOutIcon data-icon="inline-start" /> <span className="max-sm:sr-only">Log out</span>
                </Button>
              </>
            )}
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{content}</main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {user && <Assistant />}
    </div>
  )
}

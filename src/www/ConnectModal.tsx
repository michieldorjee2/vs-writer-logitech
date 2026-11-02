/**
 * The Limitless one-click ask, in the www design. No form: the click itself tells the account
 * team (the same `demo_button_clicked` ping the legacy page's sticky and closing buttons send,
 * src/lib/abm-demo-webhook.ts), and a confirmation panel opens with the fast track (schedule a
 * call) and the team's contacts.
 *
 * The ping goes once per page view: a second click reopens the panel without pinging the team
 * again. The `source` of the first click is what the team sees (which button the visitor used).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { CompetitorComparisonPage } from '../lib/graph-types'
import { fireDemoWebhook } from '../lib/abm-demo-webhook'
import GravatarAvatar from '../components/GravatarAvatar'
import { MaterialIcon } from '../vendor/www/components/element/icon-element'

export interface ConnectPerson {
  name: string
  role: string
  email: string | null
  initials: string
}

interface ConnectApi {
  /** Pings the team (first time only) and opens the panel. */
  connect: (source: string) => void
  sent: boolean
}

const Ctx = createContext<ConnectApi>({ connect: () => {}, sent: false })
export const useConnect = () => useContext(Ctx)

export function ConnectProvider({
  page,
  people,
  scheduleUrl,
  teamLabel,
  children,
}: {
  page: CompetitorComparisonPage
  /** Named only when the page may name them; otherwise the panel says "your account team". */
  people: ConnectPerson[]
  scheduleUrl: string | null
  teamLabel?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const pinged = useRef(false)
  const connect = useCallback(
    (source: string) => {
      if (!pinged.current) {
        pinged.current = true
        fireDemoWebhook(page, source)
        setSent(true)
      }
      setOpen(true)
    },
    [page],
  )
  const first = people[0]?.name.split(/\s+/)[0]
  return (
    <Ctx.Provider value={{ connect, sent }}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="www-modal__overlay" />
          <Dialog.Content className="www-modal" aria-describedby="www-modal-desc">
            <Dialog.Close className="www-modal__close" aria-label="Close">
              <MaterialIcon name="close" size="24" />
            </Dialog.Close>
            <div className="www-modal__grid">
              <div className="www-modal__tile www-modal__tile--done" role="status">
                <span className="www-modal__check" aria-hidden="true">
                  <MaterialIcon name="check" size="40" />
                </span>
                <Dialog.Title className="www-modal__title">You&apos;re all set</Dialog.Title>
                <Dialog.Description id="www-modal-desc" className="www-modal__body">
                  We&apos;ve let {first ?? teamLabel ?? 'your Optimizely team'} know you&apos;re interested. No form, nothing else to fill in.
                </Dialog.Description>
              </div>
              {scheduleUrl && (
                <a className="www-modal__tile www-modal__tile--fast www-btn" href={scheduleUrl} target="_blank" rel="noopener noreferrer">
                  <MaterialIcon name="calendar_month" size="28" />
                  <span className="www-modal__label">Fast track</span>
                  <strong className="www-modal__cta">Schedule a call</strong>
                  <span className="www-modal__hint">Pick a 30-minute slot</span>
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              )}
              {people.map((p) => (
                <a key={p.name} className="www-modal__tile www-modal__tile--person" href={p.email ? `mailto:${p.email}` : undefined}>
                  <GravatarAvatar email={p.email} initials={p.initials} className="www-avatar" />
                  <strong>{p.name}</strong>
                  <span className="www-modal__hint">{p.role}</span>
                  {p.email && (
                    <span className="www-modal__mail">
                      <MaterialIcon name="mail" size="18" /> {p.email}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  )
}

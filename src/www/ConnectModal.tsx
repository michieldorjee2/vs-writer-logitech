/**
 * The Limitless one-click ask, in the www design. No form: the click itself tells the account
 * team (src/lib/cta-ping.ts: the page's account executive gets a Teams message, or the click goes
 * on the follow-up sheet when the page names none), and a confirmation panel opens with the fast
 * track (schedule a call) and the team's contacts.
 *
 * The ping goes once per page view: a second click reopens the panel without pinging the team
 * again. The `source` of the first click is what the team sees (which button the visitor used).
 * The panel names only the person the ping messages, the account executive; with none on the
 * page it says "your Optimizely team", which is who follows up from the sheet.
 *
 * Someone from Optimizely, signed in (the staff mark, src/lib/staff-marker.ts), is asked first:
 * their click would message the account executive like a visitor's. Sent anyway, it is the ping
 * and the panel as for anyone; it is never a conversion (the staff mark keeps the browser out of
 * ODP, src/hooks/useOdpTracking.ts, and api/cta-ping.ts counts no personal link for them).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { connectStep, sendCtaPing, type CtaSource } from '../lib/cta-ping'
import { isStaffBrowser } from '../lib/staff-marker'
import { toldFirstName } from '../lib/account-rep'
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
  connect: (source: CtaSource) => void
  sent: boolean
}

const Ctx = createContext<ConnectApi>({ connect: () => {}, sent: false })
export const useConnect = () => useContext(Ctx)

export function ConnectProvider({
  people,
  scheduleUrl,
  teamLabel,
  children,
}: {
  /** Named only when the page may name them; otherwise the panel says "your account team". */
  people: ConnectPerson[]
  scheduleUrl: string | null
  teamLabel?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  /** The button someone from Optimizely clicked, while they are asked whether to send. */
  const [asking, setAsking] = useState<CtaSource | null>(null)
  const pinged = useRef(false)
  const ping = useCallback((source: CtaSource) => {
    pinged.current = true
    sendCtaPing(source)
    setSent(true)
    setOpen(true)
  }, [])
  const connect = useCallback(
    (source: CtaSource) => {
      const step = connectStep(pinged.current, isStaffBrowser())
      if (step === 'open') setOpen(true)
      else if (step === 'ask') setAsking(source)
      else ping(source)
    },
    [ping],
  )
  const sendAnyway = useCallback(() => {
    if (asking) ping(asking)
    setAsking(null)
  }, [asking, ping])
  const first = toldFirstName(people)
  return (
    <Ctx.Provider value={{ connect, sent }}>
      {children}
      <AlertDialog.Root open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="www-modal__overlay" />
          <AlertDialog.Content className="www-modal www-modal--confirm">
            <AlertDialog.Title className="www-modal__title">Seems like you&apos;re an Optimizely employee</AlertDialog.Title>
            <AlertDialog.Description className="www-modal__body">Send anyway? This won&apos;t be tracked as a conversion.</AlertDialog.Description>
            <div className="www-modal__actions">
              <AlertDialog.Cancel className="www-modal__btn">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action className="www-modal__btn www-modal__btn--primary" onClick={sendAnyway}>
                Send anyway
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
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
                <a className="www-modal__tile www-modal__tile--fast www-btn" href={scheduleUrl} target="_blank" rel="noopener noreferrer" data-cta="schedule" data-cta-position="panel" aria-label="Schedule a call (opens in new tab)">
                  <MaterialIcon name="calendar_month" size="28" />
                  <span className="www-modal__label">Fast track</span>
                  <strong className="www-modal__cta">Schedule a call</strong>
                  <span className="www-modal__hint">Pick a 30-minute slot</span>
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              )}
              {people.map((p) => (
                <a key={p.name} className="www-modal__tile www-modal__tile--person" href={p.email ? `mailto:${p.email}` : undefined} data-cta="contact" data-cta-position="panel">
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

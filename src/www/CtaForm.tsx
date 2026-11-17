/**
 * The form on an offer page's CTA, in the www design (src/lib/cta-form.ts says what it does and
 * why). `CtaFormProvider` wraps the offer page when its offer chose the form in Limitless (the
 * data layer marks the page, `CtaForm`); `useCtaGate()` gives each CTA link its click handler.
 *
 * On load it waits for the ODP tag's visitor id (as the activity index does, up to ten seconds)
 * and asks the page's endpoint whether that visitor is known. A click then:
 *   - goes straight through for a known visitor with everything the form needs, the form
 *     submitted in the background (keepalive, so it survives the navigation): today's experience;
 *   - otherwise opens the panel: the work email first, then only what ODP lacks; or, with "Always
 *     show form", the whole form filled in from the visitor's own profile;
 *   - once submitted (this page, this tab session), goes straight through.
 * After a submit the panel thanks them and offers the button's own destination, as a real link
 * (a link opened after a network wait would be blocked as a pop-up).
 *
 * The CMS preview never submits: an editor previewing a draft is not a visitor.
 */
import { createContext, Fragment, useCallback, useContext, useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { MaterialIcon } from '../vendor/www/components/element/icon-element'
import { inCmsPreview } from '../lib/cms-preview'
import { normalizeVuid } from '../lib/page-activity'
import { COUNTRIES, CONSENT_LABEL, optionLabel } from '../lib/contact-form-options'
import {
  ALL_FIELDS,
  AUTOCOMPLETE,
  CTA_FORM_WORDS as W,
  type Contact,
  type CtaFormMarker,
  type CtaStatus,
  ctaStep,
  emailProblem,
  FIELD_LABELS,
  type FieldKey,
  type FieldProblem,
  postCtaLookup,
  postCtaStatus,
  postCtaSubmit,
  PRIVACY_URL,
  REQUIRED,
  STATE_LABELS,
  statesFor,
  submittedKey,
  trackingOf,
} from '../lib/cta-form'

type Target = { href: string; target: string | null; label: string }
type Gate = (label: string) => (event: MouseEvent<HTMLAnchorElement>) => void

const Ctx = createContext<Gate | null>(null)
/** The click handler for a CTA link, or null on a page without the form. */
export const useCtaGate = () => useContext(Ctx)

const VUID_TRIES = 20
const VUID_EVERY_MS = 500
/** After a click, how long the panel waits for the visitor's status before asking for the email. */
const CHECK_CAP_MS = 2500

function readVuid(): string | null {
  return normalizeVuid((window as unknown as { zaius?: { VUID?: string } }).zaius?.VUID)
}

function wasSubmitted(pathname: string): boolean {
  try {
    return sessionStorage.getItem(submittedKey(pathname)) === '1'
  } catch {
    return false
  }
}
function rememberSubmitted(pathname: string): void {
  try {
    sessionStorage.setItem(submittedKey(pathname), '1')
  } catch {
    /* private mode: this page view still remembers */
  }
}

const isAnchor = (href: string) => !href || href.startsWith('#')

export function CtaFormProvider({ marker, children }: { marker: CtaFormMarker | null; children: ReactNode }) {
  const [status, setStatus] = useState<CtaStatus | null>(null)
  const [vuid, setVuid] = useState<string | null>(null)
  // Remembered for this page in this tab: nothing on screen depends on it, so the server's false is safe to hydrate over.
  const [submitted, setSubmitted] = useState(() => typeof window !== 'undefined' && wasSubmitted(window.location.pathname))
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)

  useEffect(() => {
    if (!marker) return
    if (inCmsPreview(window.location)) return
    let cancelled = false
    let tries = 0
    let timer = 0
    // No ODP tag on the page (a signed-in Optimizely person: index.html skips it), no id will come: unknown at once.
    const noTag = !document.querySelector('script[src*="zaius-min.js"]')
    const attempt = () => {
      if (cancelled) return
      const id = readVuid()
      if (!id && !noTag && ++tries < VUID_TRIES) {
        timer = window.setTimeout(attempt, VUID_EVERY_MS)
        return
      }
      setVuid(id)
      void postCtaStatus(window.location, id).then((answer) => {
        if (!cancelled) setStatus(answer)
      })
    }
    attempt()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [marker])

  const submitInBackground = useCallback(() => {
    const where = window.location
    rememberSubmitted(where.pathname)
    setSubmitted(true)
    void postCtaSubmit(where, { vuid: readVuid(), fields: {}, tracking: trackingOf(where.search, document.cookie), website: '' }, { keepalive: true })
  }, [])

  const gate = useCallback<Gate>(
    (label) => (event) => {
      if (!marker) return
      const step = ctaStep({ submitted, status, alwaysShow: marker.alwaysShow, preview: inCmsPreview(window.location) })
      if (step === 'through') return
      if (step === 'submit-through') {
        submitInBackground()
        return
      }
      event.preventDefault()
      const a = event.currentTarget
      setTarget({ href: a.getAttribute('href') ?? '', target: a.getAttribute('target'), label })
      setOpen(true)
    },
    [marker, submitted, status, submitInBackground],
  )

  const done = useCallback(() => {
    rememberSubmitted(window.location.pathname)
    setSubmitted(true)
  }, [])

  return (
    <Ctx.Provider value={marker ? gate : null}>
      {children}
      {marker && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="www-modal__overlay" />
            <Dialog.Content className="www-modal www-modal--form" aria-describedby={undefined} data-cta-form="">
              <Dialog.Close className="www-modal__close www-modal__close--light" aria-label={W.close}>
                <MaterialIcon name="close" size="24" />
              </Dialog.Close>
              {open && <CtaPanel alwaysShow={marker.alwaysShow} status={status} vuid={vuid} target={target} onDone={done} onClose={() => setOpen(false)} />}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </Ctx.Provider>
  )
}

type Mode = { kind: 'checking' } | { kind: 'email' } | { kind: 'details'; fields: FieldKey[]; full: boolean } | { kind: 'sending' } | { kind: 'done' }

/** The panel's first screen for a status: what to ask, if anything. */
function firstMode(status: CtaStatus, alwaysShow: boolean): Mode | 'submit' {
  if (status.known && alwaysShow) return { kind: 'details', fields: [...ALL_FIELDS], full: true }
  if (status.known && status.missing.length === 0) return 'submit'
  if (status.known) return { kind: 'details', fields: [...status.missing, 'Marketing_Consent__c'], full: false }
  return { kind: 'email' }
}

function CtaPanel({
  alwaysShow,
  status,
  vuid,
  target,
  onDone,
  onClose,
}: {
  alwaysShow: boolean
  status: CtaStatus | null
  vuid: string | null
  target: Target | null
  onDone: () => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'checking' })
  const [values, setValues] = useState<Contact>({})
  /** The email typed on the email screen: the server fills the rest from its profile. */
  const [email, setEmail] = useState<string | null>(null)
  /** "Use a different email": the visitor's own browser id no longer stands for them. */
  const [ownId, setOwnId] = useState(true)
  const [problems, setProblems] = useState<Partial<Record<FieldKey, FieldProblem>>>({})
  const [error, setError] = useState(false)
  const honeypot = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  const submit = useCallback(
    async (fields: Contact, typedEmail: string | null, back: Mode) => {
      setMode({ kind: 'sending' })
      setError(false)
      const where = window.location
      const answer = await postCtaSubmit(where, {
        ...(typedEmail ? { email: typedEmail } : {}),
        vuid: ownId ? vuid : null,
        fields,
        tracking: trackingOf(where.search, document.cookie),
        website: honeypot.current?.value ?? '',
      })
      if (answer.outcome === 'done') {
        onDone()
        setMode({ kind: 'done' })
        return
      }
      if (answer.outcome === 'missing') {
        setProblems(answer.problems)
        const asked = back.kind === 'details' ? back.fields : []
        const more = [...answer.missing, ...(Object.keys(answer.problems) as FieldKey[])].filter((k) => !asked.includes(k))
        setMode({ kind: 'details', fields: [...asked, ...more], full: back.kind === 'details' && back.full })
        return
      }
      setError(true)
      setMode(back)
    },
    [ownId, vuid, onDone],
  )

  // The first screen, once the visitor's status is in (or after CHECK_CAP_MS without it: asked for the email).
  useEffect(() => {
    if (started.current) return
    const begin = (s: CtaStatus) => {
      if (started.current) return
      started.current = true
      const first = firstMode(s, alwaysShow)
      if (first === 'submit') void submit({}, null, { kind: 'email' })
      else {
        if (first.kind === 'details' && first.full && s.prefill) setValues(s.prefill)
        setMode(first)
      }
    }
    if (status) {
      begin(status)
      return
    }
    const timer = window.setTimeout(() => begin({ known: false, missing: [...REQUIRED] }), CHECK_CAP_MS)
    return () => window.clearTimeout(timer)
  }, [status, alwaysShow, submit])

  const setValue = (key: FieldKey, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (problems[key]) setProblems((p) => ({ ...p, [key]: undefined }))
  }

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const typed = (values.email ?? '').trim()
    const problem = emailProblem(typed)
    if (problem) {
      setProblems({ email: problem })
      return
    }
    // Looking the email up sends nothing yet: "One moment…", not "Sending…".
    setMode({ kind: 'checking' })
    setError(false)
    const missing = await postCtaLookup(window.location, typed, ownId ? vuid : null, honeypot.current?.value ?? '')
    if (!missing) {
      setError(true)
      setMode({ kind: 'email' })
      return
    }
    setEmail(typed.toLowerCase())
    const ask = missing.filter((k) => k !== 'email')
    const consent: Contact = values.Marketing_Consent__c === 'yes' ? { Marketing_Consent__c: 'yes' } : {}
    // Nothing more to ask: the email (and the consent box on its screen) is the whole form.
    if (ask.length === 0) void submit(consent, typed.toLowerCase(), { kind: 'email' })
    else setMode({ kind: 'details', fields: ask, full: false })
  }

  function onDetails(event: FormEvent<HTMLFormElement>, mode: Extract<Mode, { kind: 'details' }>) {
    event.preventDefault()
    const found: Partial<Record<FieldKey, FieldProblem>> = {}
    for (const key of mode.fields) {
      if (!REQUIRED.includes(key)) continue
      if (key === 'email') {
        const p = emailProblem(values.email)
        if (p) found.email = p
      } else if (!(values[key] ?? '').trim()) found[key] = 'required'
    }
    if (Object.keys(found).length > 0) {
      setProblems(found)
      return
    }
    const fields: Contact = {}
    for (const key of [...mode.fields, 'state' as const]) {
      const value = values[key]
      if (value) fields[key] = value
    }
    if (values.Marketing_Consent__c === 'yes') fields.Marketing_Consent__c = 'yes'
    void submit(fields, mode.full ? null : email, mode)
  }

  const differentEmail = () => {
    setOwnId(false)
    setEmail(null)
    setValues({})
    setProblems({})
    setMode({ kind: 'email' })
  }

  const trap = (
    // Off-screen and out of the tab order: a person never fills it, a bot does.
    <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="www-form__trap" />
  )

  if (mode.kind === 'checking' || mode.kind === 'sending') {
    return (
      <div className="www-form" role="status" aria-live="polite">
        <Dialog.Title className="www-form__title">{mode.kind === 'sending' ? W.sending : W.checking}</Dialog.Title>
      </div>
    )
  }

  if (mode.kind === 'done') {
    const go = target && !isAnchor(target.href)
    return (
      <div className="www-form" role="status" aria-live="polite">
        <span className="www-modal__check" aria-hidden="true">
          <MaterialIcon name="check" size="40" />
        </span>
        <Dialog.Title className="www-form__title">{W.done}</Dialog.Title>
        <div className="www-modal__actions">
          {go ? (
            <a
              className="www-modal__btn www-modal__btn--primary"
              href={target.href}
              {...(target.target ? { target: target.target, rel: 'noopener noreferrer' } : {})}
              onClick={() => onClose()}
            >
              {target.label || W.continue}
            </a>
          ) : (
            <button type="button" className="www-modal__btn www-modal__btn--primary" onClick={onClose}>
              {W.close}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (mode.kind === 'email') {
    return (
      <form className="www-form" method="post" noValidate onSubmit={(e) => void onEmail(e)}>
        <Dialog.Title className="www-form__title">{W.emailTitle}</Dialog.Title>
        <p className="www-form__body">{W.emailBody}</p>
        <Field name="email" value={values.email ?? ''} problem={problems.email} onChange={setValue} autoFocus />
        <Consent checked={values.Marketing_Consent__c === 'yes'} onChange={(on) => setValue('Marketing_Consent__c', on ? 'yes' : '')} />
        {trap}
        <Privacy />
        {error && <p className="www-form__error" role="alert">{W.error}</p>}
        <div className="www-modal__actions">
          <button type="submit" className="www-modal__btn www-modal__btn--primary">
            {W.next}
          </button>
        </div>
      </form>
    )
  }

  const shown = mode.fields.filter((k) => k !== 'state' && k !== 'Marketing_Consent__c')
  const states = statesFor(values.country)
  return (
    <form className="www-form" method="post" noValidate onSubmit={(e) => onDetails(e, mode)}>
      <Dialog.Title className="www-form__title">{mode.full ? W.fullTitle : W.detailsTitle}</Dialog.Title>
      <p className="www-form__body">{mode.full ? W.fullBody : W.detailsBody}</p>
      <div className="www-form__grid">
        {shown.map((key) => (
          <Fragment key={key}>
            <Field name={key} value={values[key] ?? ''} problem={problems[key]} onChange={setValue} />
            {/* The state or province right after the country, as on the website, and only for the two countries that have a list. */}
            {key === 'country' && states.length > 0 && (
              <Select name="state" label={STATE_LABELS[values.country as keyof typeof STATE_LABELS]} options={states} value={values.state ?? ''} onChange={setValue} />
            )}
          </Fragment>
        ))}
      </div>
      <Consent checked={values.Marketing_Consent__c === 'yes'} onChange={(on) => setValue('Marketing_Consent__c', on ? 'yes' : '')} />
      {trap}
      <Privacy />
      {error && <p className="www-form__error" role="alert">{W.error}</p>}
      <div className="www-modal__actions">
        {!mode.full && ownId && !email && (
          <button type="button" className="www-modal__btn" onClick={differentEmail}>
            {W.otherEmail}
          </button>
        )}
        <button type="submit" className="www-modal__btn www-modal__btn--primary">
          {W.submit}
        </button>
      </div>
    </form>
  )
}

function Field({
  name,
  value,
  problem,
  onChange,
  autoFocus,
}: {
  name: FieldKey
  value: string
  problem?: FieldProblem
  onChange: (key: FieldKey, value: string) => void
  autoFocus?: boolean
}) {
  const id = useId()
  if (name === 'country') return <Select name="country" label={FIELD_LABELS.country} options={COUNTRIES} value={value} problem={problem} onChange={onChange} required />
  if (name === 'state' || name === 'Marketing_Consent__c') return null
  const label = FIELD_LABELS[name]
  const required = REQUIRED.includes(name)
  const common = {
    id,
    name,
    value,
    required,
    autoComplete: AUTOCOMPLETE[name] ?? 'off',
    'aria-invalid': problem ? true : undefined,
    'aria-describedby': problem ? `${id}-problem` : undefined,
    onChange: (e: { target: { value: string } }) => onChange(name, e.target.value),
    className: 'www-form__input',
    autoFocus,
  }
  return (
    <div className="www-form__field">
      <label htmlFor={id} className="www-form__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        {...common}
        type={name === 'email' ? 'email' : 'text'}
        inputMode={name === 'email' ? 'email' : undefined}
        maxLength={name === 'email' ? 254 : 255}
      />
      {problem && (
        <span id={`${id}-problem`} className="www-form__problem">
          {W[problem]}
        </span>
      )}
    </div>
  )
}

function Select({
  name,
  label,
  options,
  value,
  problem,
  onChange,
  required,
}: {
  name: FieldKey
  label: string
  options: readonly string[]
  value: string
  problem?: FieldProblem
  onChange: (key: FieldKey, value: string) => void
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="www-form__field">
      <label htmlFor={id} className="www-form__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        required={required}
        autoComplete={AUTOCOMPLETE[name] ?? 'off'}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        onChange={(e) => onChange(name, e.target.value)}
        className="www-form__input"
      >
        <option value="">{required ? '' : '—'}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
      {problem && (
        <span id={`${id}-problem`} className="www-form__problem">
          {W[problem]}
        </span>
      )}
    </div>
  )
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="www-form__consent">
      <input type="checkbox" name="Marketing_Consent__c" value="yes" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{CONSENT_LABEL}</span>
    </label>
  )
}

function Privacy() {
  return (
    <p className="www-form__privacy">
      {W.privacy}{' '}
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
        {W.privacyLink}
      </a>
      {W.privacyTail}
    </p>
  )
}

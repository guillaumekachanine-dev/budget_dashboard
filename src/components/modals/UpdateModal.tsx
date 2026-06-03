import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Plus, Upload, X } from 'lucide-react'
import { StableDateField } from '@/components/ui/StableDateField'
import transactionsUpdateIcon from '@/assets/icons/app/transactions_update.png'
import soldeUpdateIcon from '@/assets/icons/app/solde_update.png'
import comptePrincipalIcon from '@/assets/icons/accounts/compte_principal_banque_populaire.webp'
import compteJointIcon from '@/assets/icons/accounts/banque_postale_compte_joint.webp'
import amundiIcon from '@/assets/icons/accounts/amundi_epargne.webp'
import bitcoinIcon from '@/assets/icons/accounts/bitcoin.webp'
import peaIcon from '@/assets/icons/accounts/boursorama_pea.webp'
import pegIcon from '@/assets/icons/accounts/peg_capgemini.webp'

// ─── Static account data (mechanism plugged in later) ─────────────────────────

type CheckingAccountId = 'principal' | 'joint'

const CHECKING_ACCOUNTS = [
  { id: 'principal' as CheckingAccountId, label: 'Compte principal', shortLabel: 'Principal', icon: comptePrincipalIcon },
  { id: 'joint'     as CheckingAccountId, label: 'Compte joint',     shortLabel: 'Joint',     icon: compteJointIcon    },
]

type SavingsAccountId = 'livret_a' | 'ldds' | 'pea' | 'per' | 'peg' | 'bitcoin'

const SAVINGS_ACCOUNTS = [
  { id: 'livret_a' as SavingsAccountId, label: 'Livret A', icon: comptePrincipalIcon },
  { id: 'ldds'     as SavingsAccountId, label: 'LDDS',     icon: amundiIcon           },
  { id: 'pea'      as SavingsAccountId, label: 'PEA',      icon: peaIcon              },
  { id: 'per'      as SavingsAccountId, label: 'PER',      icon: comptePrincipalIcon  },
  { id: 'peg'      as SavingsAccountId, label: 'PEG',      icon: pegIcon              },
  { id: 'bitcoin'  as SavingsAccountId, label: 'Bitcoin',  icon: bitcoinIcon          },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdateMode = 'picker' | 'transactions' | 'balances'

type BalanceEntry = {
  accountId: SavingsAccountId
  value: string
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fermer"
      style={{
        width: 34, height: 34,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        background: 'var(--neutral-100)',
        color: 'var(--neutral-600)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <X size={17} />
    </button>
  )
}

function ModalHeader({ title, right, centered }: { title: string; right?: React.ReactNode; centered?: boolean }) {
  if (centered) {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-5)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
          {title}
        </h2>
        {right && <div style={{ position: 'absolute', right: 0 }}>{right}</div>}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
        {title}
      </h2>
      {right}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'block',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 700,
      color: 'var(--neutral-500)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6,
    }}>
      {children}
    </span>
  )
}

function ModalFooter({ onCancel, onSubmit, submitLabel = 'Valider', compactThirds = false }: {
  onCancel: () => void
  onSubmit: () => void
  submitLabel?: string
  compactThirds?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      gap: compactThirds ? 'var(--space-2)' : 'var(--space-3)',
      justifyContent: compactThirds ? 'space-between' : 'flex-start',
      marginTop: 'var(--space-5)',
      paddingTop: 'var(--space-4)',
      borderTop: '1px solid var(--neutral-150)',
    }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          flex: compactThirds ? '0 0 33.333%' : 1,
          padding: '10px 16px',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--neutral-200)',
          background: 'var(--neutral-0)',
          color: 'var(--neutral-700)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onSubmit}
        style={{
          flex: compactThirds ? '0 0 33.333%' : 2,
          padding: '10px 16px',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          background: 'var(--primary-500)',
          color: 'var(--neutral-0)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {submitLabel}
      </button>
    </div>
  )
}

// ─── Mode picker ──────────────────────────────────────────────────────────────

function ModeCard({
  imageSrc, label, onClick,
}: {
  imageSrc: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--neutral-50)',
        border: '1.5px solid var(--neutral-150)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-4)',
        cursor: 'pointer',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
        transition: 'border-color 130ms ease, background 130ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary-400)'
        e.currentTarget.style.background = 'color-mix(in oklab, var(--primary-500) 5%, var(--neutral-0))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--neutral-150)'
        e.currentTarget.style.background = 'var(--neutral-50)'
      }}
    >
      <img src={imageSrc} alt="" aria-hidden style={{ width: 64, height: 64, objectFit: 'contain' }} />
      <span style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)' }}>
        {label}
      </span>
    </button>
  )
}

function ModePicker({ onSelect, onClose }: {
  onSelect: (mode: 'transactions' | 'balances') => void
  onClose: () => void
}) {
  return (
    <div>
      <ModalHeader title="Mettre à jour" right={<CloseButton onClick={onClose} />} centered />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <ModeCard
          imageSrc={transactionsUpdateIcon}
          label="Transactions"
          onClick={() => onSelect('transactions')}
        />
        <ModeCard
          imageSrc={soldeUpdateIcon}
          label="Soldes"
          onClick={() => onSelect('balances')}
        />
      </div>
    </div>
  )
}

// ─── Transactions sub-modal ───────────────────────────────────────────────────

function AccountSelectorButton({ selectedId, onSelect }: {
  selectedId: CheckingAccountId
  onSelect: (id: CheckingAccountId) => void
}) {
  const [open, setOpen] = useState(false)
  const account = CHECKING_ACCOUNTS.find((a) => a.id === selectedId)!

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choisir le compte"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 9px 5px 5px',
          borderRadius: 'var(--radius-full)',
          border: '1.5px solid var(--neutral-200)',
          background: 'var(--neutral-50)',
          cursor: 'pointer',
          transition: 'border-color 130ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-300)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--neutral-200)' }}
      >
        <img src={account.icon} alt={account.shortLabel} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
          {account.label}
        </span>
        <ChevronDown size={14} color="var(--neutral-500)" style={{ transition: 'transform 160ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 20,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
              minWidth: 190,
            }}
          >
            {CHECKING_ACCOUNTS.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => { onSelect(acc.id); setOpen(false) }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: selectedId === acc.id
                    ? 'color-mix(in oklab, var(--primary-500) 8%, var(--neutral-0))'
                    : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => { if (selectedId !== acc.id) e.currentTarget.style.background = 'var(--neutral-50)' }}
                onMouseLeave={(e) => { if (selectedId !== acc.id) e.currentTarget.style.background = 'transparent' }}
              >
                <img src={acc.icon} alt="" aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--neutral-800)' }}>
                  {acc.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TransactionsContent({ onBack }: { onClose: () => void; onBack: () => void }) {
  const [selectedAccount, setSelectedAccount] = useState<CheckingAccountId>('principal')
  const [files, setFiles] = useState<File[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [singleDay, setSingleDay] = useState(false)
  const [directives, setDirectives] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <ModalHeader
        title="Mettre à jour les transactions"
        right={<CloseButton onClick={onBack} />}
      />

      {/* Upload zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const next = Array.from(e.target.files ?? [])
          setFiles((prev) => [...prev, ...next])
          // reset so same file can be re-picked
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: '100%',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-xl)',
          border: `2px dashed ${files.length > 0 ? 'var(--primary-400)' : 'var(--neutral-200)'}`,
          background: files.length > 0
            ? 'color-mix(in oklab, var(--primary-500) 5%, var(--neutral-0))'
            : 'var(--neutral-50)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          transition: 'border-color 140ms, background 140ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-400)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = files.length > 0 ? 'var(--primary-400)' : 'var(--neutral-200)' }}
      >
        <Upload size={24} color={files.length > 0 ? 'var(--primary-500)' : 'var(--neutral-400)'} strokeWidth={1.8} />
        {files.length === 0 ? (
          <>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)' }}>
              Ajouter des captures d'écran
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-400)' }}>
              Photos ou fichiers
            </span>
          </>
        ) : (
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--primary-600)' }}>
            {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Account */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <FieldLabel>Compte</FieldLabel>
        <AccountSelectorButton
          selectedId={selectedAccount}
          onSelect={setSelectedAccount}
        />
      </div>

      {/* Period */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <FieldLabel>Période</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            <label style={{ display: 'block', minWidth: 0 }}>
              <StableDateField
                value={dateFrom}
                onChange={(next) => {
                  setDateFrom(next)
                  if (singleDay) setDateTo(next)
                }}
                ariaLabel="Date de début de période"
                width={118}
                textStyle={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                buttonStyle={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--neutral-200)',
                  background: 'var(--neutral-0)',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)', fontWeight: 600, lineHeight: 1 }}>
              au
            </span>
            <label style={{ display: 'block', minWidth: 0 }}>
              <StableDateField
                value={singleDay ? dateFrom : dateTo}
                onChange={setDateTo}
                disabled={singleDay}
                ariaLabel="Date de fin de période"
                width={118}
                textStyle={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                buttonStyle={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--neutral-200)',
                  background: 'var(--neutral-0)',
                  boxSizing: 'border-box',
                }}
              />
            </label>
          </div>

          <label style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2, minWidth: 34, paddingBottom: 2, marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={singleDay}
              onChange={(e) => {
                const checked = e.target.checked
                setSingleDay(checked)
                if (checked) setDateTo(dateFrom)
              }}
              style={{ accentColor: 'var(--primary-500)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 600, lineHeight: 1 }}>
              jour
            </span>
          </label>
        </div>
      </div>

      {/* Directives */}
      <div>
        <FieldLabel>Directives</FieldLabel>
        <textarea
          value={directives}
          onChange={(e) => setDirectives(e.target.value)}
          placeholder="Consignes pour l'analyse et la classification des transactions…"
          rows={2}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--neutral-200)',
            background: 'var(--neutral-0)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--neutral-800)',
            resize: 'vertical',
            lineHeight: 1.5,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <ModalFooter
        onCancel={onBack}
        onSubmit={() => {
          // TODO: trigger upload + LLM analysis workflow
        }}
        submitLabel="Envoyer"
        compactThirds
      />
    </div>
  )
}

// ─── Account picker sheet (savings) ──────────────────────────────────────────

type SavingsAccountDef = typeof SAVINGS_ACCOUNTS[number]

function AccountPickerSheet({ available, onSelect, onClose }: {
  available: SavingsAccountDef[]
  onSelect: (id: SavingsAccountId) => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        borderRadius: 'var(--radius-xl)',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)' }}>
          Choisir un compte
        </span>
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
        {available.map((acc) => (
          <button
            key={acc.id}
            type="button"
            onClick={() => onSelect(acc.id)}
            style={{
              background: 'var(--neutral-0)',
              border: '1.5px solid var(--neutral-150)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-3) var(--space-2)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transition: 'border-color 120ms, background 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-400)'
              e.currentTarget.style.background = 'color-mix(in oklab, var(--primary-500) 6%, var(--neutral-0))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--neutral-150)'
              e.currentTarget.style.background = 'var(--neutral-0)'
            }}
          >
            <img src={acc.icon} alt="" aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)', textAlign: 'center', lineHeight: 1.3 }}>
              {acc.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Balances sub-modal ───────────────────────────────────────────────────────

function BalancesContent({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const [principalBalance, setPrincipalBalance] = useState('')
  const [jointBalance, setJointBalance]         = useState('')
  const [showPrincipal, setShowPrincipal]       = useState(true)
  const [showJoint, setShowJoint]               = useState(true)
  const [savingsEntries, setSavingsEntries]      = useState<BalanceEntry[]>([])
  const [pickerOpen, setPickerOpen]             = useState(false)

  const addedIds       = new Set(savingsEntries.map((e) => e.accountId))
  const availableAccounts = SAVINGS_ACCOUNTS.filter((a) => !addedIds.has(a.id))

  const handleAdd = (id: SavingsAccountId) => {
    setSavingsEntries((prev) => [...prev, { accountId: id, value: '' }])
    setPickerOpen(false)
  }

  const handleRemove = (id: SavingsAccountId) => {
    setSavingsEntries((prev) => prev.filter((e) => e.accountId !== id))
  }

  const handleValueChange = (id: SavingsAccountId, value: string) => {
    setSavingsEntries((prev) => prev.map((e) => (e.accountId === id ? { ...e, value } : e)))
  }

  const amountInputStyle: React.CSSProperties = {
    width: 108,
    minWidth: 0,
    border: 'none',
    borderBottom: '1.5px solid var(--neutral-200)',
    background: 'transparent',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: 'var(--neutral-900)',
    outline: 'none',
    textAlign: 'right',
    padding: '2px 0',
  }

  const accountRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 'var(--radius-lg)',
    border: '1.5px solid var(--neutral-150)',
    background: 'var(--neutral-0)',
    minWidth: 0,
  }

  return (
    <div style={{ position: 'relative' }}>
      <ModalHeader title="Mettre à jour les soldes" right={<CloseButton onClick={onClose} />} />

      {/* Accounts — one row per account to avoid overflow */}
      <div style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {showPrincipal ? (
          <div style={accountRowStyle}>
            <img src={CHECKING_ACCOUNTS[0].icon} alt="" aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-800)', minWidth: 0 }}>
              {CHECKING_ACCOUNTS[0].label}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={principalBalance}
                onChange={(e) => setPrincipalBalance(e.target.value)}
                aria-label="Solde compte principal"
                style={amountInputStyle}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 600, flexShrink: 0 }}>€</span>
              <button
                type="button"
                onClick={() => setShowPrincipal(false)}
                aria-label="Retirer compte principal"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {showJoint ? (
          <div style={accountRowStyle}>
            <img src={CHECKING_ACCOUNTS[1].icon} alt="" aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-800)', minWidth: 0 }}>
              {CHECKING_ACCOUNTS[1].label}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={jointBalance}
                onChange={(e) => setJointBalance(e.target.value)}
                aria-label="Solde compte joint"
                style={amountInputStyle}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 600, flexShrink: 0 }}>€</span>
              <button
                type="button"
                onClick={() => setShowJoint(false)}
                aria-label="Retirer compte joint"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {!showPrincipal || !showJoint ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {!showPrincipal ? (
              <button
                type="button"
                onClick={() => setShowPrincipal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px dashed var(--neutral-200)',
                  background: 'transparent',
                  color: 'var(--neutral-500)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                Compte principal
              </button>
            ) : null}
            {!showJoint ? (
              <button
                type="button"
                onClick={() => setShowJoint(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px dashed var(--neutral-200)',
                  background: 'transparent',
                  color: 'var(--neutral-500)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                Compte joint
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Added savings account rows */}
      {savingsEntries.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {savingsEntries.map((entry) => {
            const acc = SAVINGS_ACCOUNTS.find((a) => a.id === entry.accountId)!
            return (
              <div
                key={entry.accountId}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--neutral-150)', background: 'var(--neutral-0)' }}
              >
                <img src={acc.icon} alt="" aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)', flex: '0 0 auto' }}>
                  {acc.label}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={entry.value}
                    onChange={(e) => handleValueChange(entry.accountId, e.target.value)}
                    aria-label={`Solde ${acc.label}`}
                    style={amountInputStyle}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 600, flexShrink: 0 }}>€</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(entry.accountId)}
                    aria-label={`Retirer ${acc.label}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add account button */}
      {availableAccounts.length > 0 && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1.5px dashed var(--neutral-200)',
            background: 'transparent',
            color: 'var(--neutral-500)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'border-color 130ms, color 130ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-400)'; e.currentTarget.style.color = 'var(--primary-500)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--neutral-200)'; e.currentTarget.style.color = 'var(--neutral-500)' }}
        >
          <Plus size={14} strokeWidth={2.5} />
          Ajouter un compte
        </button>
      )}

      <ModalFooter
        onCancel={onBack}
        onSubmit={() => {
          // TODO: validate + trigger n8n balance-update workflow
        }}
        submitLabel="Envoyer"
        compactThirds
      />

      {/* Savings account picker — overlays the modal content */}
      <AnimatePresence>
        {pickerOpen && (
          <AccountPickerSheet
            available={availableAccounts}
            onSelect={handleAdd}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Root modal ───────────────────────────────────────────────────────────────

export interface UpdateModalProps {
  open: boolean
  onClose: () => void
  pickerPlacement?: 'bottom' | 'center'
}

export function UpdateModal({ open, onClose, pickerPlacement = 'bottom' }: UpdateModalProps) {
  const [mode, setMode] = useState<UpdateMode>('picker')
  const isPickerMode = mode === 'picker'
  const centerPanel = !isPickerMode || pickerPlacement === 'center'

  // Reset to picker each time modal opens
  useEffect(() => {
    if (open) setMode('picker')
  }, [open])

  // Escape: go back one level
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (mode !== 'picker') setMode('picker')
      else onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, mode, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              border: 'none',
              zIndex: 104,
              background: 'rgba(13,13,31,0.45)',
              padding: 0,
              cursor: 'pointer',
            }}
            aria-label="Fermer"
            onClick={onClose}
          />

          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              zIndex: 105,
              pointerEvents: 'none',
              ...(centerPanel
                ? {
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--space-4)',
                  }
                : {
                    left: 0,
                    right: 0,
                    bottom: 'calc(var(--nav-height) + var(--space-2))',
                    display: 'flex',
                    justifyContent: 'center',
                    paddingLeft: 'var(--space-3)',
                    paddingRight: 'var(--space-3)',
                  }),
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Mettre à jour"
              initial={centerPanel ? { opacity: 0, scale: 0.97, y: 12 } : { opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={centerPanel ? { opacity: 0, scale: 0.97, y: 12 } : { opacity: 0, y: 40, scale: 0.97 }}
              transition={centerPanel ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : { duration: 0.17, ease: [0.4, 0, 1, 1] }}
              style={{
                width: centerPanel ? 'min(480px, 100%)' : 'min(480px, calc(100vw - 22px))',
                maxHeight: centerPanel ? 'calc(100dvh - 2 * var(--space-4))' : 'min(74dvh, calc(100dvh - var(--nav-height) - var(--space-4)))',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--neutral-0)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--neutral-200)',
                position: 'relative',
                pointerEvents: 'auto',
                willChange: 'transform, opacity',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ overflowY: 'auto', padding: mode === 'transactions' ? 'var(--space-4)' : 'var(--space-5)', flex: 1 }}>
                {mode === 'picker'       && <ModePicker onSelect={setMode} onClose={onClose} />}
                {mode === 'transactions' && <TransactionsContent onClose={onClose} onBack={() => setMode('picker')} />}
                {mode === 'balances'     && <BalancesContent onClose={onClose} onBack={() => setMode('picker')} />}
              </div>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

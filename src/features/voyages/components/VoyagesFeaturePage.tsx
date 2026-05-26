import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, ChevronDown, ChevronUp, X, Pencil } from 'lucide-react'
import { useVoyagesData } from '../hooks/useVoyagesData'
import type { TripTransaction, TripWithStats } from '../types'
import { PlanVoyageModal } from './PlanVoyageModal'

const TRIP_COLORS = [
  '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6',
  '#F97316', '#8B5CF6', '#06B6D4', '#84CC16', '#EF4444',
]

const MONTH_NAMES_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const VOYAGES_ACCENT = '#F59E0B'
const AVAILABLE_YEARS = [2025, 2026] as const
const UNKNOWN_CATEGORY_KEY = '__unknown__'

// Ambiance backgrounds — mirrors PlanVoyageModal AMBIANCE_CONFIG
const AMBIANCE_BACKGROUND: Record<string, string> = {
  '🌃': 'linear-gradient(180deg, #010C1F 0%, #061B3A 28%, #0C1F54 58%, #11153F 82%, #0D0B2E 100%)',
  '🌅': 'linear-gradient(175deg, #1C0733 0%, #6B21A8 14%, #BE4E11 32%, #EA7316 46%, #F5A623 60%, #FADA6A 74%, #FEF3C7 100%)',
  '🌿': 'linear-gradient(180deg, #071A03 0%, #0F3308 18%, #1A5210 38%, #226B14 56%, #2F8A1C 72%, #64C832 87%, #A3E635 100%)',
  '🏙️': 'linear-gradient(185deg, #0A0118 0%, #160834 18%, #2B1060 36%, #6A1F8A 52%, #C0185A 68%, #E64A19 84%, #FF6E00 100%)',
}
const AMBIANCE_DEFAULT = 'linear-gradient(180deg, #010C1F 0%, #061B3A 28%, #0C1F54 58%, #11153F 82%, #0D0B2E 100%)'

function tripAmbianceBackground(emoji: string | null | undefined): string {
  return AMBIANCE_BACKGROUND[(emoji ?? '').trim()] ?? AMBIANCE_DEFAULT
}

function tripColor(index: number): string {
  return TRIP_COLORS[index % TRIP_COLORS.length]
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n)) + ' €'
}

function formatTxDateDayMonthYear(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '--/--/----'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getTxLabel(tx: TripTransaction): string {
  const normalized = (tx.normalized_label ?? '').trim()
  if (normalized.length > 0) return normalized
  const merchant = (tx.merchant_name ?? '').trim()
  if (merchant.length > 0) return merchant
  const raw = (tx.raw_label ?? '').trim()
  if (raw.length > 0) return raw
  return 'Opération'
}

function isTripPast(tripEndDateIso: string, todayKey: string): boolean {
  return tripEndDateIso < todayKey
}

function KpiChip({
  label,
  value,
  mono = false,
  onClick,
}: {
  label: string
  value: string
  mono?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: mono ? 'var(--font-mono)' : undefined, color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </>
  )

  if (!onClick) {
    return (
      <div style={{
        border: '1px solid var(--neutral-200)',
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-md)',
        padding: '6px var(--space-3)',
        display: 'grid',
        justifyItems: 'center',
        gap: 2,
      }}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid var(--neutral-200)',
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-md)',
        padding: '6px var(--space-3)',
        display: 'grid',
        justifyItems: 'center',
        gap: 2,
        cursor: 'pointer',
      }}
    >
      {content}
    </button>
  )
}

function CategoryBar({
  name,
  amount,
  pct,
  color,
  onClick,
}: {
  name: string
  amount: number
  pct: number
  color: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span style={{ fontSize: 11, color: 'var(--neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
        {name}
      </span>
      <div style={{ height: 7, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(4, Math.min(pct, 100))}%`,
          height: '100%',
          borderRadius: 'var(--radius-full)',
          background: color,
        }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {formatAmount(amount)}
      </span>
    </>
  )

  if (!onClick) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 'var(--space-2)' }}>
        {inner}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        display: 'grid',
        gridTemplateColumns: '80px 1fr auto',
        alignItems: 'center',
        gap: 'var(--space-2)',
        cursor: 'pointer',
        padding: '2px 0',
      }}
    >
      {inner}
    </button>
  )
}

function TripTransactionsModal({
  open,
  title,
  transactions,
  onClose,
}: {
  open: boolean
  title: string
  transactions: TripTransaction[]
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.42)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '82vh',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--neutral-150)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
            }}
          >
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--neutral-150)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-500)' }}>
                  {transactions.length} opération{transactions.length > 1 ? 's' : ''} · ordre chronologique
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la liste des opérations"
                style={{
                  width: 28,
                  height: 28,
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--neutral-100)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--neutral-700)',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ overflow: 'auto', padding: 'var(--space-2) var(--space-4) var(--space-4)' }}>
              {transactions.length === 0 ? (
                <p style={{ margin: 'var(--space-4) 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
                  Aucune opération sur ce périmètre.
                </p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '74px minmax(0,1fr) auto',
                      gap: 'var(--space-2)',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--neutral-100)',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                      {formatTxDateDayMonthYear(tx.transaction_date)}
                    </span>
                    <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getTxLabel(tx)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tx.merchant_name ?? tx.raw_label ?? '—'}
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
                      {formatAmount(Number(tx.amount)).replace(/\s+€/, '€')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function AmbianceBgScene({ emoji }: { emoji: string }) {
  const e = emoji.trim()
  const ambiance = e === '🌅' ? 'sunset' : e === '🌿' ? 'natural' : e === '🏙️' ? 'city_trip' : 'city_lights'

  if (ambiance === 'city_lights') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Stars */}
        {([
          [6,18,1.3],[12,6,1.0],[20,22,1.6],[27,9,0.8],[35,18,1.4],[43,5,1.1],
          [50,20,0.9],[58,10,1.5],[65,4,1.2],[72,22,0.8],[79,12,1.6],[86,7,1.0],
          [91,19,1.3],[95,11,0.9],[97,4,1.1],
        ] as [number,number,number][]).map(([l,t,r],i) => (
          <div key={i} style={{
            position: 'absolute', left: `${l}%`, top: `${t}%`,
            width: r, height: r, borderRadius: '50%',
            background: 'rgba(255,255,255,0.88)',
            boxShadow: `0 0 ${r * 3}px rgba(180,210,255,0.8)`,
          }} />
        ))}
        {/* Neon cyan glow top-right */}
        <div style={{ position:'absolute', top:-16, right:30, width:80, height:80, borderRadius:'50%', background:'rgba(6,182,212,0.18)', filter:'blur(22px)' }} />
        {/* Neon magenta glow bottom-right */}
        <div style={{ position:'absolute', bottom:-10, right:8, width:60, height:60, borderRadius:'50%', background:'rgba(217,70,239,0.14)', filter:'blur(18px)' }} />
        {/* City skyline right half */}
        <svg viewBox="0 0 240 56" preserveAspectRatio="xMaxYMax meet"
          style={{ position:'absolute', bottom:0, right:0, width:'62%', height:'100%' }}>
          <rect x="0"   y="22" width="16" height="34" fill="#04091E"/>
          <rect x="2"   y="12" width="5"  height="10" fill="#04091E"/>
          <rect x="20"  y="32" width="13" height="24" fill="#050C26"/>
          <rect x="37"  y="14" width="11" height="42" fill="#030820"/>
          <rect x="38"  y="8"  width="3"  height="6"  fill="#030820"/>
          <rect x="52"  y="26" width="15" height="30" fill="#060E28"/>
          <rect x="71"  y="10" width="10" height="46" fill="#040A22"/>
          <rect x="72"  y="4"  width="3"  height="6"  fill="#040A22"/>
          <rect x="85"  y="30" width="13" height="26" fill="#050D26"/>
          <rect x="102" y="18" width="11" height="38" fill="#040C24"/>
          <rect x="117" y="8"  width="16" height="48" fill="#030920"/>
          <rect x="118" y="2"  width="4"  height="6"  fill="#030920"/>
          <rect x="137" y="24" width="12" height="32" fill="#060F28"/>
          <rect x="153" y="12" width="18" height="44" fill="#040A22"/>
          <rect x="175" y="28" width="16" height="28" fill="#050C24"/>
          <rect x="195" y="16" width="14" height="40" fill="#040B22"/>
          <rect x="213" y="6"  width="28" height="50" fill="#030820"/>
          {/* Neon windows */}
          <rect x="4"   y="26" width="2" height="1.5" fill="#22D3EE" opacity="0.9"/>
          <rect x="39"  y="18" width="2" height="1.5" fill="#22D3EE" opacity="0.85"/>
          <rect x="73"  y="14" width="2" height="1.5" fill="#F0ABFC" opacity="0.9"/>
          <rect x="103" y="22" width="2" height="1.5" fill="#67E8F9" opacity="0.85"/>
          <rect x="119" y="12" width="2" height="1.5" fill="#22D3EE" opacity="0.9"/>
          <rect x="154" y="18" width="2" height="1.5" fill="#E879F9" opacity="0.85"/>
          <rect x="215" y="12" width="2" height="1.5" fill="#22D3EE" opacity="0.9"/>
          <rect x="221" y="20" width="2" height="1.5" fill="#F0ABFC" opacity="0.8"/>
        </svg>
      </div>
    )
  }

  if (ambiance === 'sunset') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Sun orb */}
        <div style={{
          position: 'absolute', top: '8%', right: '16%',
          width: 44, height: 44, borderRadius: '50%',
          background: 'radial-gradient(circle, #FFFDE7 0%, #FFD54F 32%, #FF8F00 62%, transparent 100%)',
          boxShadow: '0 0 36px 14px rgba(255,175,0,0.32)',
        }} />
        {/* Light rays radial */}
        <div style={{ position:'absolute', top:0, right:0, width:'65%', height:'100%', background:'radial-gradient(ellipse at 75% 28%, rgba(255,214,0,0.22) 0%, transparent 68%)' }} />
        {/* Warm purple shadow left */}
        <div style={{ position:'absolute', top:-10, left:-10, width:70, height:70, borderRadius:'50%', background:'rgba(120,30,90,0.28)', filter:'blur(22px)' }} />
        {/* Ocean waves bottom */}
        <svg viewBox="0 0 400 56" preserveAspectRatio="none"
          style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'52%' }}>
          <path d="M0 26 Q60 16 120 24 Q180 32 240 18 Q300 6 360 20 Q390 26 400 18 L400 56 L0 56 Z" fill="rgba(251,191,36,0.48)"/>
          <path d="M0 36 Q80 24 160 34 Q240 42 320 28 Q380 16 400 32 L400 56 L0 56 Z" fill="rgba(234,115,22,0.38)"/>
          {/* Sun reflection */}
          <ellipse cx="290" cy="46" rx="16" ry="3.5" fill="rgba(255,245,130,0.55)"/>
        </svg>
        {/* Sand strip at very bottom */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:7, background:'rgba(253,224,138,0.55)' }} />
      </div>
    )
  }

  if (ambiance === 'city_trip') {
    return (
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <style>{`
          @keyframes ct-row-sa { 0%,100%{opacity:.85} 43%,53%{opacity:.2} }
          @keyframes ct-row-sb { 0%,100%{opacity:.78} 21%,31%{opacity:.16} 69%,76%{opacity:.44} }
          @keyframes ct-row-sc { 0%,100%{opacity:.72} 55%,65%{opacity:.14} }
          @keyframes ct-row-car { from{transform:translateX(-80px)} to{transform:translateX(500px)} }
          @keyframes ct-row-ped { from{transform:translateX(100px)} to{transform:translateX(-60px)} }
        `}</style>

        {/* Atmosphere blobs */}
        <div style={{ position:'absolute', top:-22, left:-12, width:95, height:95, borderRadius:'50%', background:'rgba(107,31,138,0.38)', filter:'blur(26px)' }} />
        <div style={{ position:'absolute', top:-16, right:12, width:82, height:82, borderRadius:'50%', background:'rgba(194,24,91,0.3)', filter:'blur(22px)' }} />
        <div style={{ position:'absolute', bottom:-18, right:-10, width:88, height:88, borderRadius:'50%', background:'rgba(230,74,25,0.22)', filter:'blur(24px)' }} />

        <svg viewBox="0 0 400 56" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
          <defs>
            <radialGradient id="ct-row-vp" cx="50%" cy="0%" r="35%">
              <stop offset="0%" stopColor="#C2185B" stopOpacity="0.42"/>
              <stop offset="100%" stopColor="#C2185B" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* Building facades */}
          <rect x="0"   y="0" width="148" height="56" fill="#130828"/>
          <rect x="0"   y="0" width="8"   height="56" fill="#0D0420"/>
          <rect x="128" y="0" width="20"  height="44" fill="#180A35"/>
          <rect x="252" y="0" width="148" height="56" fill="#130828"/>
          <rect x="392" y="0" width="8"   height="56" fill="#0D0420"/>
          <rect x="252" y="0" width="20"  height="44" fill="#180A35"/>

          {/* Street */}
          <polygon points="148,56 252,56 224,0 176,0" fill="#0A0320"/>
          <polygon points="148,56 252,56 224,0 176,0" fill="rgba(194,24,91,0.1)"/>
          <rect x="0" y="0" width="400" height="56" fill="url(#ct-row-vp)"/>

          {/* Road center dashes */}
          <rect x="199.5" y="42" width="2"   height="7"   fill="rgba(255,140,180,0.32)"/>
          <rect x="200"   y="30" width="1.6" height="5.5" fill="rgba(255,140,180,0.22)"/>
          <rect x="200"   y="20" width="1.3" height="4"   fill="rgba(255,140,180,0.14)"/>
          <rect x="200"   y="12" width="1"   height="3"   fill="rgba(255,140,180,0.08)"/>

          {/* Sidewalks */}
          <polygon points="0,42 148,56 0,56"   fill="#160434" opacity="0.82"/>
          <polygon points="400,42 252,56 400,56" fill="#160434" opacity="0.82"/>

          {/* Left windows */}
          {([
            [9,3],[21,3],[33,3],[45,3],[57,3],[69,3],[81,3],[93,3],[105,3],[117,3],[129,3],[141,3],
            [9,13],[33,13],[57,13],[81,13],[105,13],[129,13],
            [9,23],[45,23],[69,23],[93,23],[129,23],
            [21,33],[57,33],[93,33],[117,33],
            [9,43],[45,43],[81,43],[117,43],
          ] as [number,number][]).map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="8" height="5"
              fill={['#E91E63','#7C3AED','#22D3EE','#F59E0B','#C2185B'][i%5]}
              opacity={0.18+((i*17)%10)*0.038}/>
          ))}

          {/* Right windows */}
          {([
            [258,3],[270,3],[282,3],[294,3],[306,3],[318,3],[330,3],[342,3],[354,3],[366,3],[378,3],[390,3],
            [258,13],[282,13],[306,13],[330,13],[354,13],[378,13],
            [270,23],[306,23],[342,23],[378,23],
            [258,33],[294,33],[342,33],[378,33],
            [270,43],[318,43],[366,43],[390,43],
          ] as [number,number][]).map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="8" height="5"
              fill={['#C2185B','#6D28D9','#06B6D4','#EA580C','#E91E63'][i%5]}
              opacity={0.18+((i*19)%10)*0.038}/>
          ))}

          {/* Neon signs — left */}
          <rect x="5"   y="43" width="46" height="9"  rx="2.5" fill="#E91E63" opacity="0.85" style={{animation:'ct-row-sa 3.2s ease-in-out infinite'}}/>
          <rect x="6"   y="44" width="44" height="7"  rx="1.5" fill="none" stroke="rgba(255,192,210,0.5)" strokeWidth="0.7"/>
          <rect x="60"  y="39" width="36" height="8"  rx="2"   fill="#7C3AED" opacity="0.78" style={{animation:'ct-row-sb 4.5s ease-in-out infinite 1s'}}/>
          <rect x="106" y="42" width="26" height="8"  rx="2"   fill="#FF6F00" opacity="0.70" style={{animation:'ct-row-sc 5.2s ease-in-out infinite 0.5s'}}/>

          {/* Neon signs — right */}
          <rect x="349" y="43" width="46" height="9"  rx="2.5" fill="#C2185B" opacity="0.85" style={{animation:'ct-row-sb 3.8s ease-in-out infinite 0.7s'}}/>
          <rect x="350" y="44" width="44" height="7"  rx="1.5" fill="none" stroke="rgba(255,160,200,0.5)" strokeWidth="0.7"/>
          <rect x="304" y="39" width="36" height="8"  rx="2"   fill="#6D28D9" opacity="0.78" style={{animation:'ct-row-sa 4.3s ease-in-out infinite 1.8s'}}/>
          <rect x="268" y="42" width="26" height="8"  rx="2"   fill="#EA580C" opacity="0.70" style={{animation:'ct-row-sc 5.6s ease-in-out infinite 0.3s'}}/>

          {/* Street lamps */}
          <rect x="139"   y="20" width="2.5" height="36" fill="#251060" opacity="0.9"/>
          <rect x="132"   y="20" width="9"   height="2.5" fill="#251060" opacity="0.85"/>
          <circle cx="132" cy="21" r="6"   fill="rgba(253,224,71,0.14)"/>
          <circle cx="132" cy="21" r="2.5" fill="rgba(253,224,71,0.88)"/>

          <rect x="258.5" y="20" width="2.5" height="36" fill="#251060" opacity="0.9"/>
          <rect x="259"   y="20" width="9"   height="2.5" fill="#251060" opacity="0.85"/>
          <circle cx="268" cy="21" r="6"   fill="rgba(253,224,71,0.14)"/>
          <circle cx="268" cy="21" r="2.5" fill="rgba(253,224,71,0.88)"/>
        </svg>

        {/* Animated car headlights */}
        <div style={{ position:'absolute', bottom:16, left:0, pointerEvents:'none', animation:'ct-row-car 5s linear infinite', width:55, height:2, borderRadius:4, background:'linear-gradient(90deg,transparent,rgba(255,220,80,0.85),rgba(255,255,180,0.6),transparent)' }} />
        {/* Pedestrian */}
        <div style={{ position:'absolute', bottom:4, left:80, pointerEvents:'none', animation:'ct-row-ped 8s linear infinite 1s', width:4, height:14, borderRadius:'2px 2px 0 0', background:'rgba(0,0,0,0.68)' }} />
      </div>
    )
  }

  // natural
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Sun top-right */}
      <div style={{
        position: 'absolute', top: -12, right: -6,
        width: 58, height: 58, borderRadius: '50%',
        background: 'radial-gradient(circle, #FEF08A 0%, #FDE047 38%, #FACC15 62%, transparent 100%)',
        boxShadow: '0 0 32px 12px rgba(253,224,71,0.28)',
      }} />
      <div style={{ position:'absolute', top:0, right:0, width:'45%', height:'100%', background:'radial-gradient(ellipse at 90% 12%, rgba(253,224,71,0.2) 0%, transparent 62%)' }} />
      {/* Hills + flora */}
      <svg viewBox="0 0 400 56" preserveAspectRatio="none"
        style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'72%' }}>
        {/* Back hills */}
        <path d="M-10 36 Q55 8 130 28 Q205 48 275 14 Q340 -4 410 22 L410 56 L-10 56 Z" fill="rgba(22,101,52,0.62)"/>
        {/* Front hills */}
        <path d="M-10 44 Q70 20 155 38 Q240 54 318 26 Q378 10 410 34 L410 56 L-10 56 Z" fill="rgba(20,83,45,0.78)"/>
        {/* Ground */}
        <rect x="-10" y="50" width="420" height="8" fill="rgba(15,68,36,0.88)"/>
        {/* Yellow flowers */}
        {([32,72,114,158,200,244,290,336,374] as number[]).map((x,i) => (
          <circle key={i} cx={x} cy={50+(i%3)} r="2" fill="#FDE047" opacity="0.92"/>
        ))}
        {/* Green accent dots */}
        {([52,96,140,184,226,270,314,358] as number[]).map((x,i) => (
          <circle key={i} cx={x} cy={49+(i%2)*2} r="1.4" fill="#A3E635" opacity="0.78"/>
        ))}
        {/* Tree trunks + canopy */}
        <rect x="62"  y="32" width="3" height="14" fill="rgba(10,40,20,0.82)"/>
        <ellipse cx="63.5" cy="28" rx="8" ry="9"  fill="rgba(22,163,74,0.72)"/>
        <rect x="192" y="30" width="3" height="16" fill="rgba(10,40,20,0.82)"/>
        <ellipse cx="193.5" cy="26" rx="9" ry="10" fill="rgba(21,128,61,0.68)"/>
        <rect x="332" y="28" width="3" height="18" fill="rgba(10,40,20,0.82)"/>
        <ellipse cx="333.5" cy="24" rx="9" ry="10" fill="rgba(22,163,74,0.68)"/>
      </svg>
    </div>
  )
}

function TripAccordionItem({
  item,
  index,
  isLast,
  expanded,
  onToggle,
  onEditTrip,
  onOpenCategoryTransactions,
  onOpenAllTransactions,
}: {
  item: TripWithStats
  index: number
  isLast: boolean
  expanded: boolean
  onToggle: () => void
  onEditTrip: (trip: TripWithStats) => void
  onOpenCategoryTransactions: (payload: { tripName: string; categoryId: string; categoryName: string; transactions: TripTransaction[] }) => void
  onOpenAllTransactions: (payload: { tripName: string; transactions: TripTransaction[] }) => void
}) {
  const color = tripColor(index)
  const ambianceBg = tripAmbianceBackground(item.trip.emoji)
  const dateRange = `${formatDateShort(item.trip.start_date)} -> ${formatDate(item.trip.end_date)}`
  const maxCatAmount = item.byCategory[0]?.amount ?? 1
  const tripEmoji = item.trip.emoji?.trim() || '✈️'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--neutral-0)',
        overflow: 'hidden',
        marginBottom: isLast ? 0 : 'var(--space-3)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          background: ambianceBg,
          padding: '10px var(--space-4)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          alignItems: 'center',
          gap: 'var(--space-3)',
          overflow: 'hidden',
        }}
      >
        <AmbianceBgScene emoji={tripEmoji} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0,1fr)',
            alignItems: 'center',
            gap: 'var(--space-3)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 28, lineHeight: 1, width: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {tripEmoji}
          </span>

          <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
              <p style={{ margin: 0, minWidth: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'rgba(255,255,255,0.97)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.trip.name}
              </p>
              {expanded ? (
                <span style={{ width: 20, height: 20, flexShrink: 0 }} />
              ) : null}
            </span>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
              {dateRange} · {item.duration} jour{item.duration > 1 ? 's' : ''}
            </p>
          </div>
        </button>

        <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {expanded ? (
            <button
              type="button"
              onClick={() => onEditTrip(item)}
              aria-label={`Modifier ${item.trip.name}`}
              style={{
                width: 20,
                height: 20,
                border: '1px solid rgba(28, 18, 58, 0.58)',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255,255,255,0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.96)',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              <Pencil size={11} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--neutral-0)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {formatAmount(item.total).replace(/\s+€/, '€')}
            </span>
            {expanded ? (
              <ChevronUp size={14} color="rgba(255,255,255,0.92)" />
            ) : (
              <ChevronDown size={14} color="rgba(255,255,255,0.92)" />
            )}
          </button>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              {!item.hasData ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-3) 0', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  <MapPin size={16} style={{ marginBottom: 4, display: 'block', margin: '0 auto 6px' }} />
                  Aucune dépense catégorisée « Voyages » sur cette période.<br />
                  <span style={{ fontSize: 11 }}>Assigne des dépenses manuellement via le détail de transaction.</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <KpiChip label="Total" value={formatAmount(item.total)} mono />
                    <KpiChip label="Moy./jour" value={formatAmount(item.avgPerDay)} mono />
                    <KpiChip
                      label="Dépenses"
                      value={String(item.txCount)}
                      onClick={() => onOpenAllTransactions({ tripName: item.trip.name, transactions: item.transactions })}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {item.byCategory.map((cat) => (
                      <CategoryBar
                        key={cat.categoryId}
                        name={cat.categoryName}
                        amount={cat.amount}
                        pct={maxCatAmount > 0 ? (cat.amount / maxCatAmount) * 100 : 0}
                        color={color}
                        onClick={() => onOpenCategoryTransactions({
                          tripName: item.trip.name,
                          categoryId: cat.categoryId,
                          categoryName: cat.categoryName,
                          transactions: item.transactions,
                        })}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

function VoyagesKpiCards({
  tripCount,
  annualBudget,
  monthlyBudget,
}: {
  tripCount: number
  annualBudget: number
  monthlyBudget: number
}) {
  return (
    <div style={{ marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Voyages</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
          {tripCount}
        </span>
      </div>
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget annuel</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>{formatAmount(annualBudget).replace(/\s+€/, '€')}</span>
      </div>
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget mensuel</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>{formatAmount(monthlyBudget).replace(/\s+€/, '€')}</span>
      </div>
    </div>
  )
}

function YearPicker({
  year,
  onChange,
}: {
  year: number
  onChange: (nextYear: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Choisir l'année"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--neutral-700)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          padding: '2px var(--space-1)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span>{year}</span>
        <ChevronDown size={12} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            aria-label="Années disponibles"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 82,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
              padding: 4,
              zIndex: 20,
            }}
          >
            {AVAILABLE_YEARS.map((y) => {
              const active = y === year
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    onChange(y)
                    setIsOpen(false)
                  }}
                  role="option"
                  aria-selected={active}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: active ? 'color-mix(in oklab, var(--primary-500) 12%, var(--neutral-0) 88%)' : 'transparent',
                    color: active ? 'var(--primary-700)' : 'var(--neutral-700)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px var(--space-2)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'left',
                  }}
                >
                  {y}
                </button>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

interface Props {
  onBack: () => void
}

interface TransactionsModalState {
  open: boolean
  title: string
  transactions: TripTransaction[]
}

export function VoyagesFeaturePage({ onBack }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear >= 2026 ? 2026 : 2025)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [tripToEdit, setTripToEdit] = useState<TripWithStats | null>(null)
  const [expandedTripIds, setExpandedTripIds] = useState<Record<string, boolean>>({})
  const [transactionsModalState, setTransactionsModalState] = useState<TransactionsModalState>({
    open: false,
    title: '',
    transactions: [],
  })

  const { tripsWithStats, isLoading } = useVoyagesData(year)

  const annualTripCount = tripsWithStats.length
  const annualBudget = useMemo(() => {
    const now = new Date()
    const todayKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    return tripsWithStats.reduce((sum, item) => {
      const planned = Number(item.trip.planned_budget ?? 0)
      if (isTripPast(item.trip.end_date, todayKey)) {
        return sum + item.total
      }
      return sum + planned
    }, 0)
  }, [tripsWithStats])
  const monthlyBudget = annualBudget / 12

  useEffect(() => {
    setExpandedTripIds({})
    setTripToEdit(null)
  }, [year])

  const toggleTripExpanded = (tripId: string) => {
    setExpandedTripIds((prev) => ({
      ...prev,
      [tripId]: !prev[tripId],
    }))
  }

  const handleOpenAllTransactions = ({
    tripName,
    transactions,
  }: {
    tripName: string
    transactions: TripTransaction[]
  }) => {
    setTransactionsModalState({
      open: true,
      title: `${tripName} · Toutes les opérations`,
      transactions,
    })
  }

  const handleOpenCategoryTransactions = ({
    tripName,
    categoryId,
    categoryName,
    transactions,
  }: {
    tripName: string
    categoryId: string
    categoryName: string
    transactions: TripTransaction[]
  }) => {
    const filtered = transactions.filter((tx) => {
      if (categoryId === UNKNOWN_CATEGORY_KEY) return tx.category_id == null
      return tx.category_id === categoryId
    })

    setTransactionsModalState({
      open: true,
      title: `${tripName} · ${categoryName}`,
      transactions: filtered,
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ padding: '0 var(--space-6)', maxWidth: 600, margin: '0 auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', gap: 'var(--space-2)' }}>
          <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              style={{
                border: 'none',
                background: VOYAGES_ACCENT,
                color: 'var(--neutral-0)',
                width: 24,
                height: 24,
                minWidth: 24,
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={14} />
            </button>

            <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              Voyages
            </p>

            <YearPicker year={year} onChange={setYear} />
          </div>

          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            aria-label="Nouveau voyage"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: 'none',
              background: '#0097A7',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--neutral-0)',
              boxShadow: '0 2px 8px rgba(0,151,167,0.38)',
              flexShrink: 0,
            }}
          >
            Nouveau
          </button>
        </div>

        <VoyagesKpiCards
          tripCount={annualTripCount}
          annualBudget={annualBudget}
          monthlyBudget={monthlyBudget}
        />

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
            Chargement...
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {!isLoading ? (
            <motion.div key={`voyages-${year}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {tripsWithStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  Aucun voyage enregistré pour {year}.
                </div>
              ) : (
                tripsWithStats.map((item, i) => (
                  <TripAccordionItem
                    key={item.trip.id}
                    item={item}
                    index={i}
                    isLast={i === tripsWithStats.length - 1}
                    expanded={Boolean(expandedTripIds[item.trip.id])}
                    onToggle={() => toggleTripExpanded(item.trip.id)}
                    onEditTrip={(trip) => setTripToEdit(trip)}
                    onOpenCategoryTransactions={handleOpenCategoryTransactions}
                    onOpenAllTransactions={handleOpenAllTransactions}
                  />
                ))
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div style={{ height: 'var(--space-6)' }} />

        <PlanVoyageModal
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          mode="create"
          tripToEdit={null}
        />
        <PlanVoyageModal
          open={tripToEdit != null}
          onClose={() => setTripToEdit(null)}
          mode="edit"
          tripToEdit={tripToEdit}
        />
      </motion.div>

      <TripTransactionsModal
        open={transactionsModalState.open}
        title={transactionsModalState.title}
        transactions={transactionsModalState.transactions}
        onClose={() => setTransactionsModalState((prev) => ({ ...prev, open: false }))}
      />
    </>
  )
}

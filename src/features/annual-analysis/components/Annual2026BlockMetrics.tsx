import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { BUCKET_LABELS, BUCKET_ORDER, MONTH_LABELS_SHORT } from './_constants'

interface Annual2026BlockMetricsProps {
  summary: any
  buckets: any[]
}

export function Annual2026BlockMetrics({ summary, buckets }: Annual2026BlockMetricsProps) {
  const [analysisType, setAnalysisType] = useState<'bloc' | 'catégorie'>('bloc')
  const [selectedBlock, setSelectedBlock] = useState(BUCKET_ORDER[0])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('YTD 2026')

  const periods = [
    'YTD 2026',
    ...MONTH_LABELS_SHORT.slice(0, 5)
  ]

  // Initialisation de la catégorie par défaut si besoin
  React.useEffect(() => {
    if (analysisType === 'catégorie' && !selectedCategory && summary?.categories?.length > 0) {
      setSelectedCategory(summary.categories[0].name)
    }
  }, [analysisType, summary, selectedCategory])

  const bucket = buckets.find(b => b.key === selectedBlock)
  const category = summary?.categories?.find((c: any) => c.name === selectedCategory)
  
  const currentItemLabel = analysisType === 'bloc' 
    ? (BUCKET_LABELS[selectedBlock] ?? selectedBlock)
    : (selectedCategory || 'Sélect...')

  // Mock metrics based on selected type
  // On multiplie par 5 pour simuler le YTD (Jan-Mai)
  const activeAmount = analysisType === 'bloc' ? (bucket?.ytdBudget ?? 0) : (category?.monthlyBudget ?? 0) * 5
  const activeBudget = analysisType === 'bloc' ? (bucket?.monthlyBudget ?? 0) * 5 : (category?.monthlyBudget ?? 0) * 5

  const metrics = [
    { label: 'Montant', value: fmt(activeAmount), sub: 'Réel constaté' },
    { label: 'Budget', value: fmt(activeBudget), sub: 'Cible planifiée' },
    { label: 'Delta réel/budget', value: '+2,4 %', sub: 'Écart YTD', color: 'var(--color-error)' },
    { label: 'Montant moyen YTD', value: fmt(activeAmount / 5), sub: 'Par mois' },
    { label: 'Médiane YTD', value: fmt((activeAmount / 5) * 0.98), sub: 'Valeur centrale' },
    { label: 'Nombre d\'opérations', value: '124', sub: 'Transactions' },
    { label: 'Rang + %', value: '#2 (18%)', sub: 'Position vs autres' },
  ]

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)', padding: '0 var(--space-6)', marginTop: 'var(--space-4)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        
        {/* Paramètres éditables */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--space-6)', padding: 'var(--space-3) var(--space-4)',
          background: 'var(--neutral-50)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--neutral-150)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <Selector 
            label="Type" 
            value={analysisType === 'bloc' ? 'Bloc' : 'Catégorie'} 
            options={[
              { id: 'bloc', label: 'Bloc' },
              { id: 'catégorie', label: 'Catégorie' }
            ]}
            onSelect={(id) => setAnalysisType(id as any)}
          />
          <Selector 
            label={analysisType === 'bloc' ? 'Bloc' : 'Cat.'} 
            value={currentItemLabel} 
            options={analysisType === 'bloc' 
              ? BUCKET_ORDER.map(k => ({ id: k, label: BUCKET_LABELS[k] }))
              : (summary?.categories ?? []).map((c: any) => ({ id: c.name, label: c.name }))
            }
            onSelect={analysisType === 'bloc' ? setSelectedBlock : setSelectedCategory}
          />
          <Selector 
            label="Période" 
            value={selectedPeriod} 
            options={periods.map(p => ({ id: p, label: p }))}
            onSelect={setSelectedPeriod}
          />
        </div>

        {/* Affichage des métriques */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 'var(--space-2) var(--space-6)',
          }}
        >
          {metrics.map((m, i) => (
            <div key={i} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: 'var(--space-1) 0', borderBottom: '1px solid var(--neutral-50)'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{m.label}</p>
              </div>
              <p style={{ 
                margin: 0, fontSize: 13, fontWeight: 800, 
                color: m.color ?? 'var(--neutral-900)', fontFamily: 'var(--font-mono)' 
              }}>
                {m.value}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function Selector({ label, value, options, onSelect }: { label: string; value: string; options: {id: string, label: string}[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  
  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none',
          padding: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          cursor: 'pointer', outline: 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
          <ChevronDown size={10} color="var(--neutral-400)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-600)', lineHeight: 1.2 }}>{value}</span>
      </button>

      {open && (
        <>
          <div 
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }} 
          />
          <div style={{
            position: 'absolute', top: '115%', left: 0, zIndex: 100,
            background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)',
            minWidth: 180, padding: 'var(--space-2)', display: 'grid', gap: 2,
            maxHeight: 300, overflowY: 'auto'
          }}>
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onSelect(opt.id); setOpen(false) }}
                style={{
                  background: value === opt.label ? 'var(--primary-50)' : 'none',
                  border: 'none', textAlign: 'left', padding: '8px 12px',
                  borderRadius: 'var(--radius-md)', fontSize: 13, 
                  fontWeight: value === opt.label ? 700 : 500,
                  color: value === opt.label ? 'var(--primary-700)' : 'var(--neutral-600)',
                  cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

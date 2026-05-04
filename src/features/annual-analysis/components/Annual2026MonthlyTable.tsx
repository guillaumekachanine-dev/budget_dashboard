import { useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wallet, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  PiggyBank, 
  Zap,
  LayoutList,
  LineChart as LineChartIcon
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyBudget2026Point } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'

type Props = {
  monthlyProfile: MonthlyBudget2026Point[]
}

const fmt = (n: number) => {
  const val = Math.round(n).toLocaleString('fr-FR')
  return `${val}€`
}

const fmtPct = (r: number) => {
  const val = (r * 100).toFixed(1)
  return `${val}%`
}

const CHART_SERIES = [
  { key: 'expense',  name: 'Dépenses',     color: '#FC5A5A', gradId: 'gExp',  dashed: false },
  { key: 'income',   name: 'Revenus',      color: '#2ED47A', gradId: 'gInc',  dashed: false },
  { key: 'savings',  name: 'Épargne',      color: '#FFAB2E', gradId: 'gSav',  dashed: false },
  { key: 'net',      name: 'Net cashflow', color: '#5B57F5', gradId: 'gNet',  dashed: true  },
]

export function Annual2026MonthlyTable({ monthlyProfile }: Props) {
  const [activeSlide, setActiveSlide] = useState<'table' | 'chart'>('table')

  if (monthlyProfile.length === 0) return null

  // Dummy chart data for UI implementation
  const chartData = monthlyProfile.map((p) => ({
    label: p.month,
    expense: p.totalExpenseBudget,
    income: 3200,
    savings: 500,
    net: 3200 - (p.totalExpenseBudget + 500)
  }))

  return (
    <div style={{ padding: '0 var(--space-4)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h3 style={cardTitleStyle}>Vue mensuelle synthétique</h3>
              <p style={cardSubStyle}>Analyse des flux mensuels · 2026</p>
            </div>
            
            {/* Carousel Toggle */}
            <div style={{ 
              display: 'flex', 
              background: 'var(--neutral-100)', 
              borderRadius: 'var(--radius-lg)', 
              padding: 2,
              gap: 2
            }}>
              <button 
                onClick={() => setActiveSlide('table')}
                style={{
                  border: 'none',
                  background: activeSlide === 'table' ? 'var(--neutral-0)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 'calc(var(--radius-lg) - 2px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: activeSlide === 'table' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <LayoutList size={14} color={activeSlide === 'table' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
              </button>
              <button 
                onClick={() => setActiveSlide('chart')}
                style={{
                  border: 'none',
                  background: activeSlide === 'chart' ? 'var(--neutral-0)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 'calc(var(--radius-lg) - 2px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: activeSlide === 'chart' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <LineChartIcon size={14} color={activeSlide === 'chart' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', overflow: 'hidden', minHeight: 300 }}>
            <AnimatePresence mode="wait">
              {activeSlide === 'table' ? (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflowX: 'auto', margin: '0 -4px' }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, ...cardSubStyle, margin: 0 }}>Mois</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={Wallet} color="var(--neutral-400)" label="Solde" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={ArrowUpCircle} color="#E57373" label="Dépenses" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={ArrowDownCircle} color="#81C784" label="Revenus" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={PiggyBank} color="#00E5FF" label="Épargne" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={Zap} color="var(--neutral-400)" label="Delta" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyProfile.map((p, idx) => {
                        const mockSolde = 12500 + (idx * 150)
                        const mockRevenus = 3200
                        const mockEpargne = 500
                        const mockEquilibre = p.totalExpenseBudget + mockEpargne
                        const mockDeltaPct = (mockRevenus - mockEquilibre) / mockEquilibre
                        
                        return (
                          <tr key={p.month} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                            <td style={{ ...tdStyle, paddingLeft: 0 }}>
                              <span style={{ fontWeight: 600, color: 'var(--neutral-700)', fontSize: 11 }}>{p.monthLabel}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-400)' }}>
                              {fmt(mockSolde)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#E57373' }}>
                              {fmt(p.totalExpenseBudget)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#81C784', fontWeight: 600 }}>
                              {fmt(mockRevenus)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-400)' }}>
                              {fmt(mockEpargne)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--neutral-400)', paddingRight: 'var(--space-4)' }}>
                              {mockDeltaPct >= 0 ? '+' : ''}{fmtPct(mockDeltaPct)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </motion.div>
              ) : (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                        <defs>
                          {CHART_SERIES.map((s) => (
                            <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor={s.color} stopOpacity={s.dashed ? 0.06 : 0.18} />
                              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--neutral-100)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--neutral-0)',
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            fontSize: 12,
                            padding: '8px 12px',
                          }}
                          cursor={{ stroke: 'var(--neutral-200)', strokeWidth: 1 }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: 10,
                            paddingTop: 14,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--neutral-500)',
                          }}
                          iconType="circle"
                          iconSize={7}
                        />
                        {CHART_SERIES.map((s) => (
                          <Area
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.name}
                            stroke={s.color}
                            strokeWidth={s.dashed ? 1.5 : 2}
                            strokeDasharray={s.dashed ? '5 3' : undefined}
                            fill={`url(#${s.gradId})`}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconHeader({ icon: Icon, color, label }: { icon: any, color: string, label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} title={label}>
      <Icon size={14} color={color} strokeWidth={2.5} />
    </div>
  )
}

const cardStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-4) var(--space-3)',
}

const cardTitleStyle: CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
}

const cardSubStyle: CSSProperties = {
  margin: '2px 0 0', fontSize: 10,
  color: 'var(--neutral-400)', textTransform: 'uppercase',
  letterSpacing: '0.05em', fontWeight: 600,
}

const thStyle: CSSProperties = {
  padding: '12px 2px', textAlign: 'left',
  borderBottom: '2px solid var(--neutral-50)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '10px 2px', fontSize: 11, color: 'var(--neutral-700)',
  verticalAlign: 'middle',
}

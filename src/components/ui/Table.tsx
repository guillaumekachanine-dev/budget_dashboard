import { memo, useMemo, type CSSProperties, type ReactNode } from 'react'

type ColumnAlign = 'left' | 'center' | 'right'
type RowData = Record<string, unknown>

function toCellNode(value: unknown): ReactNode {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toLocaleDateString('fr-FR')
  return String(value)
}

export interface TableColumn {
  key: string
  label: string
  align?: ColumnAlign
  width?: string
}

export interface TableProps {
  columns: TableColumn[]
  data: RowData[]
  onRowClick?: (row: RowData) => void
  density?: 'compact' | 'normal' | 'spacious'
  striped?: boolean
  hoverable?: boolean
  className?: string
  emptyMessage?: string
  renderCell?: (value: unknown, key: string, row: RowData) => ReactNode
}

const densityStyles: Record<TableProps['density'] extends infer D ? Exclude<D, undefined> : never, { padding: string }> = {
  compact: { padding: '8px 12px' },
  normal: { padding: '12px 16px' },
  spacious: { padding: '16px 20px' },
}

function TableBase({
  columns,
  data,
  onRowClick,
  density = 'normal',
  striped = true,
  hoverable = true,
  className,
  emptyMessage = 'Aucune donnée',
  renderCell,
}: TableProps) {
  const processedColumns = useMemo(
    () => columns.map((column) => ({ ...column, align: column.align ?? 'left' as ColumnAlign })),
    [columns],
  )

  const processedData = useMemo(() => data, [data])
  const padding = densityStyles[density].padding

  const wrapperClassName = [
    'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--neutral-200)] bg-[var(--neutral-0)] shadow-[var(--shadow-sm)]',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const getTextAlign = (align: ColumnAlign): CSSProperties['textAlign'] => {
    if (align === 'center') return 'center'
    if (align === 'right') return 'right'
    return 'left'
  }

  return (
    <div className={wrapperClassName}>
      <table className="w-full border-collapse" style={{ fontSize: 'var(--font-size-base)', color: 'var(--neutral-900)' }}>
        <thead
          className="border-b border-[var(--neutral-200)] bg-[var(--neutral-50)]"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--neutral-600)',
          }}
        >
          <tr>
            {processedColumns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{
                  padding,
                  textAlign: getTextAlign(column.align),
                  width: column.width,
                  fontWeight: 700,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {processedData.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(processedColumns.length, 1)}
                style={{
                  padding,
                  textAlign: 'center',
                  color: 'var(--neutral-600)',
                  fontSize: 'var(--font-size-base)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            processedData.map((row, rowIndex) => {
              const rawRowKey = row.id ?? row.key
              const rowKey =
                typeof rawRowKey === 'string' || typeof rawRowKey === 'number'
                  ? rawRowKey
                  : `row-${rowIndex}`
              const stripedBackground = striped
                ? rowIndex % 2 === 0
                  ? 'var(--neutral-0)'
                  : 'var(--neutral-50)'
                : 'var(--neutral-0)'

              return (
                <tr
                  key={rowKey}
                  className={hoverable ? 'group' : undefined}
                  style={{
                    borderBottom: '1px solid var(--neutral-100)',
                    backgroundColor: stripedBackground,
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onMouseEnter={(event) => {
                    if (hoverable) {
                      event.currentTarget.style.backgroundColor = 'var(--neutral-100)'
                    }
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = stripedBackground
                  }}
                >
                  {processedColumns.map((column) => {
                    const value = row[column.key]
                    return (
                      <td
                        key={column.key}
                        style={{
                          padding,
                          textAlign: getTextAlign(column.align),
                          width: column.width,
                        }}
                      >
                        {renderCell ? renderCell(value, column.key, row) : toCellNode(value)}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

const MemoizedTable = memo(TableBase)
MemoizedTable.displayName = 'MemoizedTable'

export function Table(props: TableProps) {
  return <MemoizedTable {...props} />
}

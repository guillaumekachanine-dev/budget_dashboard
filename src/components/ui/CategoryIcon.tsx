import type { CSSProperties, ReactNode } from 'react'
import { getCategoryIconSrc } from '@/lib/categoryIcons'

interface CategoryIconProps {
  categoryName?: string | null
  size?: number
  className?: string
  style?: CSSProperties
  fallback?: ReactNode
}

export function CategoryIcon({
  categoryName,
  size = 20,
  className,
  style,
  fallback = '💰',
}: CategoryIconProps) {
  const src = getCategoryIconSrc(categoryName)

  if (!src) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          ...style,
        }}
        aria-hidden="true"
      >
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={categoryName ? `Icône ${categoryName}` : 'Icône catégorie'}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
      loading="lazy"
      decoding="async"
    />
  )
}

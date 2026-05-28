interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton rounded-xl ${className}`} />
  )
}

export function CardSkeleton() {
  return <Skeleton className="h-24 w-full" />
}

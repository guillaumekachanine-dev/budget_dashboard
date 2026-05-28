import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

/**
 * Animates a numeric value from its previous value to `target` using a spring-like
 * easeOut tween. Returns the current interpolated value for display.
 */
export function useCountUp(target: number, duration = 0.45): number {
  const [displayed, setDisplayed] = useState(target)
  const prevRef = useRef(target)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = target
    if (from === target) return
    const controls = animate(from, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setDisplayed,
    })
    return () => controls.stop()
  }, [target, duration])

  return displayed
}

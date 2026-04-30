let lockCount = 0
let previousBodyOverflow = ''
let previousHtmlOverflow = ''

function isDocumentAvailable(): boolean {
  return typeof document !== 'undefined'
}

export function lockDocumentScroll(): () => void {
  if (!isDocumentAvailable()) return () => {}

  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  lockCount += 1

  let released = false
  return () => {
    if (!isDocumentAvailable() || released) return
    released = true

    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      previousBodyOverflow = ''
      previousHtmlOverflow = ''
    }
  }
}

export function forceUnlockDocumentScroll(): void {
  if (!isDocumentAvailable()) return

  lockCount = 0
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  previousBodyOverflow = ''
  previousHtmlOverflow = ''
}

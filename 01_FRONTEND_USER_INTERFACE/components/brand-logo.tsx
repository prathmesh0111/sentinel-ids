'use client'

/** Sentinel IDS brand emblem — the single source for the logo everywhere. */
export function BrandLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt="Sentinel IDS logo" className={`${className} rounded-lg shrink-0`} />
  )
}

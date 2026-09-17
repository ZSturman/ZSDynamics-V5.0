"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "bannerDismissed:v1"

export function Banner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setDismissed(raw === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  // While we haven't checked localStorage yet, render nothing to avoid hydration mismatch
  if (dismissed === null) return null
  if (dismissed) return null

  return (
    <div className="w-full bg-accent text-accent-foreground">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="text-sm">Welcome — I occasionally post updates here. Thanks for visiting.</div>
        <div className="flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss banner">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

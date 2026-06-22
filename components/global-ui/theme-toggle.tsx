"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "dark") {
        setIsDark(true)
      } else if (stored === "light") {
        setIsDark(false)
      } else {
        // fallback to prefers-color-scheme
        const prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        setIsDark(Boolean(prefers))
      }
    } catch {
      setIsDark(false)
    }
  }, [])

  useEffect(() => {
    if (isDark === null) return
    const doc = document.documentElement
    if (isDark) doc.classList.add("dark")
    else doc.classList.remove("dark")
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light")
    } catch {
      // ignore
    }
  }, [isDark])

  if (isDark === null) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsDark((v) => !v)}
      aria-label="Toggle color theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  )
}

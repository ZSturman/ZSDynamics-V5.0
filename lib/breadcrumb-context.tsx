"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface BreadcrumbContextType {
  previousPath: string | null
  previousLabel: string | null
  setPreviousPath: (path: string, label: string) => void
  clearPreviousPath: () => void
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [previousPath, setPreviousPathState] = useState<string | null>(null)
  const [previousLabel, setPreviousLabelState] = useState<string | null>(null)

  const setPreviousPath = useCallback((path: string, label: string) => {
    setPreviousPathState(path)
    setPreviousLabelState(label)
  }, [])

  const clearPreviousPath = useCallback(() => {
    setPreviousPathState(null)
    setPreviousLabelState(null)
  }, [])

  return (
    <BreadcrumbContext.Provider
      value={{ previousPath, previousLabel, setPreviousPath, clearPreviousPath }}
    >
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext)
  if (context === undefined) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider")
  }
  return context
}

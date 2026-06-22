import React from "react"

type Size = "sm" | "md" | "lg"

export function LoadingSpinner({ size = "md", className = "" }: { size?: Size; className?: string }) {
  const sizeClasses: Record<Size, string> = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  }

  return (
    <div className={`flex items-center justify-center ${className}`} aria-live="polite" aria-busy="true">
      <svg
        className={`${sizeClasses[size]} animate-spin text-primary`} 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export default LoadingSpinner

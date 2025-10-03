"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"

interface SBOMUploaderProps {
  onFilesUpload: (files: File[]) => void
}

export function SBOMUploader({ onFilesUpload }: SBOMUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      onFilesUpload(files)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="p-6 border-b border-border">
      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Upload Files</h2>

      <input ref={fileInputRef} type="file" accept=".json" multiple onChange={handleFileChange} className="hidden" />

      <Button onClick={handleClick} className="w-full bg-transparent" variant="outline">
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Select SBOM Files
      </Button>

      <p className="text-xs text-muted-foreground mt-2">Upload one or more CycloneDX JSON files</p>
    </div>
  )
}

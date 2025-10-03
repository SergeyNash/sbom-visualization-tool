"use client"

import { Download, FileJson, FileText } from "lucide-react"
import type { ParsedSBOM } from "@/lib/types"
import { exportToJSON, exportToPDF } from "@/lib/export"

interface ExportPanelProps {
  sbomData: ParsedSBOM
}

export function ExportPanel({ sbomData }: ExportPanelProps) {
  const handleExportJSON = () => {
    exportToJSON(sbomData)
  }

  const handleExportPDF = () => {
    exportToPDF(sbomData)
  }

  return (
    <div className="p-6 border-b border-border space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Export</h2>
      </div>

      <button
        onClick={handleExportJSON}
        className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent transition-colors"
      >
        <FileJson className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">Export as JSON</div>
          <div className="text-xs text-muted-foreground">Structured data format</div>
        </div>
      </button>

      <button
        onClick={handleExportPDF}
        className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent transition-colors"
      >
        <FileText className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">Export as PDF</div>
          <div className="text-xs text-muted-foreground">Visual report</div>
        </div>
      </button>
    </div>
  )
}

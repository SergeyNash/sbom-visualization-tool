"use client"

import { useState } from "react"
import { SBOMUploader } from "@/components/sbom-uploader"
import { DependencyTable } from "@/components/dependency-table"
import { DependencyGraph } from "@/components/dependency-graph"
import { FilterPanel } from "@/components/filter-panel"
import { ComponentDetails } from "@/components/component-details"
import { ExportPanel } from "@/components/export-panel"
import { parseSBOMFiles } from "@/lib/sbom-parser"
import type { ParsedSBOM, Component, FilterState } from "@/lib/types"
import { Network, Table } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Home() {
  const [sbomData, setSBOMData] = useState<ParsedSBOM | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "graph">("table")
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    dependencyType: "all",
    severity: "all",
    cveId: "",
  })

  const handleFilesUpload = async (files: File[]) => {
    try {
      const parsed = await parseSBOMFiles(files)
      setSBOMData(parsed)
      setSelectedComponent(null)
    } catch (error) {
      console.error("[v0] Error parsing SBOM files:", error)
      alert("Error parsing SBOM files. Please check the file format.")
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <aside className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-balance">SBOM Visualizer</h1>
          <p className="text-sm text-muted-foreground mt-1">Dependency Graph Analysis</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SBOMUploader onFilesUpload={handleFilesUpload} />

          {sbomData && (
            <>
              <div className="p-4 border-b border-border">
                <label className="text-sm font-medium mb-2 block">Visualization Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors",
                      viewMode === "table"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <Table className="w-4 h-4" />
                    <span className="text-sm font-medium">Table</span>
                  </button>
                  <button
                    onClick={() => setViewMode("graph")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors",
                      viewMode === "graph"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <Network className="w-4 h-4" />
                    <span className="text-sm font-medium">Graph</span>
                  </button>
                </div>
              </div>

              <FilterPanel filters={filters} onFiltersChange={setFilters} />
              <ExportPanel sbomData={sbomData} />
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!sbomData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Upload SBOM Files</h2>
              <p className="text-muted-foreground text-balance">
                Upload one or more CycloneDX SBOM files to visualize your project dependencies
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {viewMode === "table" ? (
                <div className="h-full overflow-y-auto p-6">
                  <DependencyTable
                    sbomData={sbomData}
                    filters={filters}
                    onComponentSelect={setSelectedComponent}
                    selectedComponent={selectedComponent}
                  />
                </div>
              ) : (
                <DependencyGraph
                  sbomData={sbomData}
                  filters={filters}
                  onComponentSelect={setSelectedComponent}
                  selectedComponent={selectedComponent}
                />
              )}
            </div>

            {selectedComponent && (
              <ComponentDetails component={selectedComponent} onClose={() => setSelectedComponent(null)} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

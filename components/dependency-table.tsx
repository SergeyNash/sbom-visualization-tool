"use client"

import { useState, useMemo } from "react"
import type { ParsedSBOM, Component, FilterState } from "@/lib/types"
import { Package, AlertTriangle, ChevronUp, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface DependencyTableProps {
  sbomData: ParsedSBOM
  filters: FilterState
  onComponentSelect: (component: Component) => void
  selectedComponent: Component | null
}

type SortField = "name" | "version" | "type" | "isDirect" | "vulnerabilities"
type SortDirection = "asc" | "desc"

export function DependencyTable({ sbomData, filters, onComponentSelect, selectedComponent }: DependencyTableProps) {
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredComponents = useMemo(() => {
    const components = Array.from(sbomData.components.values())

    return components.filter((comp) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (!comp.name.toLowerCase().includes(searchLower) && !comp.version.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // Additional search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        if (!comp.name.toLowerCase().includes(searchLower) && !comp.version.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // Dependency type filter
      if (filters.dependencyType === "direct" && !comp.isDirect) return false
      if (filters.dependencyType === "transitive" && comp.isDirect) return false

      // Severity filter
      if (filters.severity !== "all") {
        const hasSeverity = comp.vulnerabilities.some((v) => v.severity === filters.severity)
        if (!hasSeverity && comp.vulnerabilities.length > 0) return false
        if (!hasSeverity && comp.vulnerabilities.length === 0 && filters.severity !== "all") return false
      }

      // CVE filter
      if (filters.cveId) {
        const hasCVE = comp.vulnerabilities.some((v) => v.id.toLowerCase().includes(filters.cveId.toLowerCase()))
        if (!hasCVE) return false
      }

      return true
    })
  }, [sbomData.components, filters, searchTerm])

  const sortedComponents = useMemo(() => {
    return [...filteredComponents].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "version":
          aValue = a.version.toLowerCase()
          bValue = b.version.toLowerCase()
          break
        case "type":
          aValue = a.type.toLowerCase()
          bValue = b.type.toLowerCase()
          break
        case "isDirect":
          aValue = a.isDirect ? 1 : 0
          bValue = b.isDirect ? 1 : 0
          break
        case "vulnerabilities":
          aValue = a.vulnerabilities.length
          bValue = b.vulnerabilities.length
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [filteredComponents, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getMaxSeverity = (vulnerabilities: Component["vulnerabilities"]): string => {
    if (vulnerabilities.length === 0) return "none"

    const severityOrder = ["critical", "high", "medium", "low", "info"]
    for (const severity of severityOrder) {
      if (vulnerabilities.some((v) => v.severity === severity)) {
        return severity
      }
    }
    return "none"
  }

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-muted"
    }
  }

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive"
      case "high":
        return "secondary"
      case "medium":
        return "outline"
      case "low":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-balance">{sbomData.projectName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sbomData.totalComponents} components ({sbomData.directCount} direct, {sbomData.transitiveCount} transitive)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {sortedComponents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No components match the current filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      Component
                      {sortField === "name" && (
                        sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 font-medium">
                    <button
                      onClick={() => handleSort("version")}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      Version
                      {sortField === "version" && (
                        sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 font-medium">
                    <button
                      onClick={() => handleSort("type")}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      Type
                      {sortField === "type" && (
                        sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 font-medium">
                    <button
                      onClick={() => handleSort("isDirect")}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      Dependency
                      {sortField === "isDirect" && (
                        sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 font-medium">
                    <button
                      onClick={() => handleSort("vulnerabilities")}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      Vulnerabilities
                      {sortField === "vulnerabilities" && (
                        sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 font-medium">License</th>
                </tr>
              </thead>
              <tbody>
                {sortedComponents.map((component) => {
                  const maxSeverity = getMaxSeverity(component.vulnerabilities)
                  const isSelected = selectedComponent?.id === component.id

                  return (
                    <tr
                      key={component.id}
                      className={cn(
                        "border-b border-border hover:bg-accent/50 cursor-pointer transition-colors",
                        isSelected && "bg-accent"
                      )}
                      onClick={() => onComponentSelect(component)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full flex-shrink-0", getSeverityColor(maxSeverity))} />
                          <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{component.name}</div>
                            {component.purl && (
                              <div className="text-xs text-muted-foreground truncate font-mono">
                                {component.purl}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <code className="text-sm bg-muted px-2 py-1 rounded">{component.version}</code>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{component.type}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={component.isDirect ? "default" : "secondary"}>
                          {component.isDirect ? "Direct" : "Transitive"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {component.vulnerabilities.length === 0 ? (
                          <span className="text-sm text-muted-foreground">None</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              <span className="text-sm font-medium">{component.vulnerabilities.length}</span>
                            </div>
                            <Badge variant={getSeverityBadgeVariant(maxSeverity)}>
                              {maxSeverity.toUpperCase()}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{component.license || "Unknown"}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {sortedComponents.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {sortedComponents.length} of {sbomData.totalComponents} components
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import type { ParsedSBOM, Component, FilterState } from "@/lib/types"
import { ChevronRight, ChevronDown, Package, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface DependencyTreeProps {
  sbomData: ParsedSBOM
  filters: FilterState
  onComponentSelect: (component: Component) => void
  selectedComponent: Component | null
}

export function DependencyTree({ sbomData, filters, onComponentSelect, selectedComponent }: DependencyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

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
  }, [sbomData.components, filters])

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const expandAll = () => {
    const allIds = new Set(Array.from(sbomData.components.keys()))
    setExpandedNodes(allIds)
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
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
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="border border-border rounded-lg bg-card">
        {filteredComponents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No components match the current filters</div>
        ) : (
          <div className="divide-y divide-border">
            {sbomData.rootComponents
              .filter((rootId) => filteredComponents.some((c) => c.id === rootId))
              .map((rootId) => {
                const component = sbomData.components.get(rootId)
                if (!component) return null
                return (
                  <TreeNode
                    key={component.id}
                    component={component}
                    allComponents={sbomData.components}
                    filteredComponents={filteredComponents}
                    expandedNodes={expandedNodes}
                    onToggle={toggleNode}
                    onSelect={onComponentSelect}
                    selectedComponent={selectedComponent}
                    level={0}
                  />
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

interface TreeNodeProps {
  component: Component
  allComponents: Map<string, Component>
  filteredComponents: Component[]
  expandedNodes: Set<string>
  onToggle: (id: string) => void
  onSelect: (component: Component) => void
  selectedComponent: Component | null
  level: number
}

function TreeNode({
  component,
  allComponents,
  filteredComponents,
  expandedNodes,
  onToggle,
  onSelect,
  selectedComponent,
  level,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(component.id)
  const hasChildren = component.dependencies.length > 0
  const isSelected = selectedComponent?.id === component.id

  const maxSeverity = getMaxSeverity(component.vulnerabilities)
  const severityColor = getSeverityColor(maxSeverity)

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-3 hover:bg-accent/50 cursor-pointer transition-colors",
          isSelected && "bg-accent",
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => onSelect(component)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(component.id)
            }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-accent rounded"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0" />
        )}

        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", severityColor)} />

        <Package className="w-4 h-4 flex-shrink-0 text-muted-foreground" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{component.name}</span>
            <span className="text-sm text-muted-foreground flex-shrink-0">{component.version}</span>
          </div>
        </div>

        {component.vulnerabilities.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <AlertTriangle className={cn("w-4 h-4", severityColor.replace("bg-", "text-"))} />
            <span className="text-sm font-medium">{component.vulnerabilities.length}</span>
          </div>
        )}

        {component.isDirect && (
          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded flex-shrink-0">Direct</span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {component.dependencies.map((depId) => {
            const dep = allComponents.get(depId)
            if (!dep) return null

            // Check if this dependency matches filters
            const matchesFilter = filteredComponents.some((c) => c.id === dep.id)
            if (!matchesFilter) return null

            return (
              <TreeNode
                key={dep.id}
                component={dep}
                allComponents={allComponents}
                filteredComponents={filteredComponents}
                expandedNodes={expandedNodes}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedComponent={selectedComponent}
                level={level + 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function getMaxSeverity(vulnerabilities: Component["vulnerabilities"]): string {
  if (vulnerabilities.length === 0) return "none"

  const severityOrder = ["critical", "high", "medium", "low", "info"]
  for (const severity of severityOrder) {
    if (vulnerabilities.some((v) => v.severity === severity)) {
      return severity
    }
  }
  return "none"
}

function getSeverityColor(severity: string): string {
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

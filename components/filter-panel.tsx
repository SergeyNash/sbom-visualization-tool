"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FilterState } from "@/lib/types"
import { Search, Filter } from "lucide-react"

interface FilterPanelProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    })
  }

  return (
    <div className="p-6 border-b border-border space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Filters</h2>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search" className="text-xs text-muted-foreground">
          Search Components
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            type="text"
            placeholder="Search by name..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Dependency Type */}
      <div className="space-y-2">
        <Label htmlFor="dependency-type" className="text-xs text-muted-foreground">
          Dependency Type
        </Label>
        <Select value={filters.dependencyType} onValueChange={(value) => updateFilter("dependencyType", value)}>
          <SelectTrigger id="dependency-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dependencies</SelectItem>
            <SelectItem value="direct">Direct Only</SelectItem>
            <SelectItem value="transitive">Transitive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <Label htmlFor="severity" className="text-xs text-muted-foreground">
          Vulnerability Severity
        </Label>
        <Select value={filters.severity} onValueChange={(value) => updateFilter("severity", value)}>
          <SelectTrigger id="severity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Critical
              </span>
            </SelectItem>
            <SelectItem value="high">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                High
              </span>
            </SelectItem>
            <SelectItem value="medium">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Medium
              </span>
            </SelectItem>
            <SelectItem value="low">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Low
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CVE ID */}
      <div className="space-y-2">
        <Label htmlFor="cve-id" className="text-xs text-muted-foreground">
          CVE ID
        </Label>
        <Input
          id="cve-id"
          type="text"
          placeholder="e.g., CVE-2024-1234"
          value={filters.cveId}
          onChange={(e) => updateFilter("cveId", e.target.value)}
        />
      </div>

      {/* Clear Filters */}
      {(filters.search || filters.dependencyType !== "all" || filters.severity !== "all" || filters.cveId) && (
        <button
          onClick={() =>
            onFiltersChange({
              search: "",
              dependencyType: "all",
              severity: "all",
              cveId: "",
            })
          }
          className="w-full px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  )
}

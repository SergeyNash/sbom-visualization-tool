"use client"

import { X, Package, AlertTriangle, Shield, ExternalLink } from "lucide-react"
import type { Component } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ComponentDetailsProps {
  component: Component
  onClose: () => void
}

export function ComponentDetails({ component, onClose }: ComponentDetailsProps) {
  const maxSeverity = getMaxSeverity(component.vulnerabilities)

  const getRemediation = (vuln: Component["vulnerabilities"][0]) => {
    if (vuln.remediation) return vuln.remediation

    // Generate basic remediation advice
    if (vuln.severity === "critical" || vuln.severity === "high") {
      return `Update ${component.name} to the latest patched version immediately. Check the package repository for security advisories.`
    } else if (vuln.severity === "medium") {
      return `Consider updating ${component.name} to a patched version. Review the vulnerability details and assess impact on your application.`
    } else {
      return `Update ${component.name} when convenient. This is a low-severity issue with minimal risk.`
    }
  }

  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h2 className="text-lg font-semibold truncate">{component.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{component.version}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-accent rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Information</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="outline">{component.type}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dependency</span>
              <Badge variant={component.isDirect ? "default" : "secondary"}>
                {component.isDirect ? "Direct" : "Transitive"}
              </Badge>
            </div>

            {component.license && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">License</span>
                <Badge variant="outline">{component.license}</Badge>
              </div>
            )}

            {component.purl && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Package URL</span>
                <div className="text-xs font-mono bg-muted p-2 rounded break-all">{component.purl}</div>
              </div>
            )}

            {component.path && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Path</span>
                <div className="text-xs font-mono bg-muted p-2 rounded break-all">{component.path}</div>
              </div>
            )}
          </div>
        </div>

        {/* Vulnerabilities */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vulnerabilities</h3>
          </div>

          {component.vulnerabilities.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-green-500">No known vulnerabilities</span>
            </div>
          ) : (
            <div className="space-y-2">
              {component.vulnerabilities.map((vuln, index) => (
                <div key={index} className={cn("p-3 border rounded-lg space-y-2", getSeverityStyles(vuln.severity))}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{vuln.id}</span>
                    <Badge variant="outline" className={getSeverityBadgeStyles(vuln.severity)}>
                      {vuln.severity.toUpperCase()}
                    </Badge>
                  </div>

                  {vuln.description && <p className="text-sm text-muted-foreground">{vuln.description}</p>}

                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold mb-1">Remediation</p>
                    <p className="text-xs text-muted-foreground">{getRemediation(vuln)}</p>
                  </div>

                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${vuln.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View on NVD
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dependencies */}
        {component.dependencies.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dependencies ({component.dependencies.length})
            </h3>
            <div className="space-y-1">
              {component.dependencies.slice(0, 10).map((depId) => (
                <div key={depId} className="text-sm font-mono text-muted-foreground truncate">
                  {depId}
                </div>
              ))}
              {component.dependencies.length > 10 && (
                <div className="text-sm text-muted-foreground italic">+{component.dependencies.length - 10} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
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

function getSeverityStyles(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 border-red-500/20"
    case "high":
      return "bg-orange-500/10 border-orange-500/20"
    case "medium":
      return "bg-yellow-500/10 border-yellow-500/20"
    case "low":
      return "bg-green-500/10 border-green-500/20"
    default:
      return "bg-muted border-border"
  }
}

function getSeverityBadgeStyles(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-red-500 text-red-500"
    case "high":
      return "border-orange-500 text-orange-500"
    case "medium":
      return "border-yellow-500 text-yellow-500"
    case "low":
      return "border-green-500 text-green-500"
    default:
      return ""
  }
}

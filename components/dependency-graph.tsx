"use client"

import { useEffect, useRef, useMemo, useState, useCallback } from "react"
import * as d3 from "d3"
import type { ParsedSBOM, Component, FilterState } from "@/lib/types"
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DependencyGraphProps {
  sbomData: ParsedSBOM
  filters: FilterState
  onComponentSelect: (component: Component) => void
  selectedComponent: Component | null
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  component: Component | null // null for root project node
  severityColor: string
  x?: number
  y?: number
  isRoot?: boolean
  isCollapsed?: boolean
  childCount?: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

export function DependencyGraph({ sbomData, filters, onComponentSelect, selectedComponent }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)

  const filteredComponents = useMemo(() => {
    const components = Array.from(sbomData.components.values())

    return components.filter((comp) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (!comp.name.toLowerCase().includes(searchLower) && !comp.version.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      if (filters.dependencyType === "direct" && !comp.isDirect) return false
      if (filters.dependencyType === "transitive" && comp.isDirect) return false

      if (filters.severity !== "all") {
        const hasSeverity = comp.vulnerabilities.some((v) => v.severity === filters.severity)
        if (!hasSeverity && comp.vulnerabilities.length > 0) return false
        if (!hasSeverity && comp.vulnerabilities.length === 0 && filters.severity !== "all") return false
      }

      if (filters.cveId) {
        const hasCVE = comp.vulnerabilities.some((v) => v.id.toLowerCase().includes(filters.cveId.toLowerCase()))
        if (!hasCVE) return false
      }

      return true
    })
  }, [sbomData.components, filters])

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const filteredIds = new Set(filteredComponents.map((c) => c.id))

    const rootNode: GraphNode = {
      id: "__root__",
      component: null,
      severityColor: "bg-primary",
      isRoot: true,
      isCollapsed: collapsedNodes.has("__root__"),
    }
    nodes.push(rootNode)

    const visibleNodes = new Set<string>(["__root__"])
    const nodesToProcess: string[] = []

    filteredComponents.forEach((component) => {
      if (component.isDirect) {
        nodesToProcess.push(component.id)
        visibleNodes.add(component.id)
      }
    })

    while (nodesToProcess.length > 0) {
      const currentId = nodesToProcess.shift()!
      const component = filteredComponents.find((c) => c.id === currentId)
      if (!component) continue

      const isCollapsed = collapsedNodes.has(currentId)

      if (!isCollapsed) {
        component.dependencies.forEach((depId) => {
          if (filteredIds.has(depId) && !visibleNodes.has(depId)) {
            nodesToProcess.push(depId)
            visibleNodes.add(depId)
          }
        })
      }
    }

    filteredComponents.forEach((component) => {
      if (!visibleNodes.has(component.id)) return

      const maxSeverity = getMaxSeverity(component.vulnerabilities)
      const severityColor = getSeverityColor(maxSeverity)
      const childCount = component.dependencies.filter((id) => filteredIds.has(id)).length

      nodes.push({
        id: component.id,
        component,
        severityColor,
        isCollapsed: collapsedNodes.has(component.id),
        childCount,
      })
    })

    filteredComponents.forEach((component) => {
      if (component.isDirect && visibleNodes.has(component.id)) {
        links.push({
          source: "__root__",
          target: component.id,
        })
      }
    })

    filteredComponents.forEach((component) => {
      if (!visibleNodes.has(component.id)) return
      if (collapsedNodes.has(component.id)) return

      component.dependencies.forEach((depId) => {
        if (filteredIds.has(depId) && visibleNodes.has(depId)) {
          links.push({
            source: component.id,
            target: depId,
          })
        }
      })
    })

    return { nodes, links }
  }, [filteredComponents, collapsedNodes])

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const { width, height } = dimensions

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    const g = svg.append("g")

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(var(--muted-foreground))")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-width", 1)

    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graphData.links)
          .id((d) => d.id)
          .distance(150),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(70))

    const link = g
      .append("g")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)")
      .attr("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.1))")

    const node = g
      .append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, GraphNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended))
      .on("click", (event, d) => {
        event.stopPropagation()
        if (d.component) {
          toggleExpand(d.id)
          onComponentSelect(d.component)
        }
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation()
        if (d.childCount && d.childCount > 0) {
          toggleCollapse(d.id)
        }
      })
      .on("mouseenter", (event, d) => {
        setHoveredNode(d)
      })
      .on("mouseleave", () => {
        setHoveredNode(null)
      })

    node.each(function (d) {
      const g = d3.select(this)
      const isExpanded = expandedNodes.has(d.id)

      if (d.isRoot) {
        // Root node - always expanded
        g.append("circle")
          .attr("r", 35)
          .attr("fill", "hsl(var(--primary))")
          .attr("stroke", "hsl(var(--primary-foreground))")
          .attr("stroke-width", 2)

        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", -8)
          .attr("font-size", "16")
          .attr("font-weight", "bold")
          .attr("fill", "hsl(var(--primary-foreground))")
          .text("📦")

        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", 20)
          .attr("font-size", "12")
          .attr("font-weight", "600")
          .attr("fill", "hsl(var(--primary-foreground))")
          .text("Project")
      } else {
        // Component nodes - dot or expanded rectangle
        const maxSeverity = getMaxSeverity(d.component!.vulnerabilities)
        const nodeColor = getCVEColor(maxSeverity, d.component!.isDirect)

        if (isExpanded) {
          // Expanded rectangle
          const nodeWidth = 140
          const nodeHeight = 90

          // Main rectangle
          g.append("rect")
            .attr("width", nodeWidth)
            .attr("height", nodeHeight)
            .attr("x", -nodeWidth / 2)
            .attr("y", -nodeHeight / 2)
            .attr("rx", 8)
            .attr("fill", nodeColor)
            .attr("stroke", (d) => (selectedComponent?.id === d.id ? "hsl(var(--primary))" : "hsl(var(--border))"))
            .attr("stroke-width", (d) => (selectedComponent?.id === d.id ? 3 : 1))
            .attr("filter", "drop-shadow(0 3px 6px rgba(0,0,0,0.2))")

          // Library name (top)
          g.append("text")
            .attr("x", 0)
            .attr("y", -nodeHeight / 2 + 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "13")
            .attr("font-weight", "600")
            .attr("fill", "white")
            .text((d) => {
              const name = d.component!.name
              return name.length > 16 ? name.substring(0, 16) + "..." : name
            })

          // Version (bottom right)
          g.append("text")
            .attr("x", nodeWidth / 2 - 10)
            .attr("y", nodeHeight / 2 - 10)
            .attr("text-anchor", "end")
            .attr("font-size", "11")
            .attr("font-weight", "500")
            .attr("fill", "white")
            .text((d) => d.component!.version)

          // Threat level (bottom left)
          g.append("text")
            .attr("x", -nodeWidth / 2 + 10)
            .attr("y", nodeHeight / 2 - 10)
            .attr("text-anchor", "start")
            .attr("font-size", "11")
            .attr("font-weight", "500")
            .attr("fill", "white")
            .text(maxSeverity === "none" ? "N/A" : maxSeverity.toUpperCase())

          // Close button (top right)
          g.append("circle")
            .attr("cx", nodeWidth / 2 - 15)
            .attr("cy", -nodeHeight / 2 + 15)
            .attr("r", 10)
            .attr("fill", "rgba(255,255,255,0.9)")
            .attr("stroke", "hsl(var(--border))")
            .attr("stroke-width", 1)

          g.append("text")
            .attr("x", nodeWidth / 2 - 15)
            .attr("y", -nodeHeight / 2 + 19)
            .attr("text-anchor", "middle")
            .attr("font-size", "12")
            .attr("font-weight", "bold")
            .attr("fill", "hsl(var(--foreground))")
            .text("×")

          // Expand/collapse button (if has children)
          if (d.childCount && d.childCount > 0) {
            g.append("circle")
              .attr("cx", nodeWidth / 2 - 15)
              .attr("cy", nodeHeight / 2 - 15)
              .attr("r", 10)
              .attr("fill", "rgba(255,255,255,0.9)")
              .attr("stroke", "hsl(var(--border))")
              .attr("stroke-width", 1)

            g.append("text")
              .attr("x", nodeWidth / 2 - 15)
              .attr("y", nodeHeight / 2 - 11)
              .attr("text-anchor", "middle")
              .attr("font-size", "12")
              .attr("font-weight", "bold")
              .attr("fill", "hsl(var(--foreground))")
              .text(d.isCollapsed ? "+" : "−")
          }
        } else {
          // Collapsed dot
          const dotRadius = 8

          g.append("circle")
            .attr("r", dotRadius)
            .attr("fill", nodeColor)
            .attr("stroke", (d) => (selectedComponent?.id === d.id ? "hsl(var(--primary))" : "white"))
            .attr("stroke-width", (d) => (selectedComponent?.id === d.id ? 3 : 2))
            .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.3))")

          // Show vulnerability count if any
          if (d.component!.vulnerabilities.length > 0) {
            g.append("text")
              .attr("text-anchor", "middle")
              .attr("dy", 4)
              .attr("font-size", "8")
              .attr("font-weight", "bold")
              .attr("fill", "white")
              .text(d.component!.vulnerabilities.length)
          }

          // Show expand indicator
          g.append("circle")
            .attr("r", 3)
            .attr("fill", "rgba(255,255,255,0.8)")
            .attr("cx", dotRadius * 0.7)
            .attr("cy", -dotRadius * 0.7)
        }
      }
    })

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!)

      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    const zoomIn = () => {
      svg.transition().call(zoom.scaleBy, 1.3)
    }

    const zoomOut = () => {
      svg.transition().call(zoom.scaleBy, 0.7)
    }

    const resetZoom = () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity)
    }
    ;(svgRef.current as any).zoomIn = zoomIn
    ;(svgRef.current as any).zoomOut = zoomOut
    ;(svgRef.current as any).resetZoom = resetZoom

    return () => {
      simulation.stop()
    }
  }, [graphData, dimensions, onComponentSelect, selectedComponent, toggleCollapse, expandedNodes])

  const handleZoomIn = () => {
    ;(svgRef.current as any)?.zoomIn?.()
  }

  const handleZoomOut = () => {
    ;(svgRef.current as any)?.zoomOut?.()
  }

  const handleResetZoom = () => {
    ;(svgRef.current as any)?.resetZoom?.()
  }

  const handleExpandAll = () => {
    setCollapsedNodes(new Set())
  }

  const handleCollapseAll = () => {
    const allNodeIds = new Set(graphData.nodes.filter((n) => n.childCount && n.childCount > 0).map((n) => n.id))
    setCollapsedNodes(allNodeIds)
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-background">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />

      {hoveredNode && hoveredNode.component && (
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none bg-card border border-border rounded-lg p-3 shadow-lg z-50"
          style={{
            left: "50%",
            top: "20px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="text-sm font-semibold">{hoveredNode.component.name}</div>
          <div className="text-xs text-muted-foreground">{hoveredNode.component.version}</div>
          {hoveredNode.component.vulnerabilities.length > 0 && (
            <div className="text-xs text-orange-500 mt-1">
              {hoveredNode.component.vulnerabilities.length} vulnerabilities
            </div>
          )}
          {hoveredNode.childCount && hoveredNode.childCount > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {hoveredNode.childCount} dependencies • Double-click to {hoveredNode.isCollapsed ? "expand" : "collapse"}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button size="icon" variant="outline" onClick={handleZoomIn} className="bg-card">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={handleZoomOut} className="bg-card">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={handleResetZoom} className="bg-card">
          <Maximize2 className="w-4 h-4" />
        </Button>
        <div className="h-px bg-border my-1" />
        <Button size="icon" variant="outline" onClick={handleExpandAll} className="bg-card" title="Expand all">
          <Maximize className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={handleCollapseAll} className="bg-card" title="Collapse all">
          <Minimize2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="absolute top-4 right-4 bg-card border border-border rounded-lg p-3 text-xs space-y-3">
        <div>
          <div className="font-semibold mb-2">CVE Level</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "#dc2626" }} />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "#ea580c" }} />
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "#ca8a04" }} />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "#16a34a" }} />
              <span>Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "#2563eb" }} />
              <span>Direct (No CVE)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "#6b7280" }} />
              <span>Transitive (No CVE)</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-2">
          <div className="font-semibold mb-2">Interactions</div>
          <div className="space-y-1 text-[10px]">
            <div>Click: Expand/select node</div>
            <div>Double-click: Collapse children</div>
            <div>Drag: Move node</div>
            <div>Scroll: Zoom</div>
          </div>
        </div>
      </div>
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

function getCVEColor(severity: string, isDirect: boolean): string {
  switch (severity) {
    case "critical":
      return "#dc2626" // Red
    case "high":
      return "#ea580c" // Orange
    case "medium":
      return "#ca8a04" // Yellow
    case "low":
      return "#16a34a" // Green
    default:
      // No vulnerabilities - blue for direct, grey for transitive
      return isDirect ? "#2563eb" : "#6b7280"
  }
}

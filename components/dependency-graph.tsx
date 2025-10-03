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
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(var(--muted-foreground))")

    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graphData.links)
          .id((d) => d.id)
          .distance(150),
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(60))

    const link = g
      .append("g")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)")

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

      if (d.isRoot) {
        g.append("circle")
          .attr("r", 40)
          .attr("fill", "hsl(var(--primary))")
          .attr("stroke", "hsl(var(--primary-foreground))")
          .attr("stroke-width", 2)

        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", -5)
          .attr("font-size", "14")
          .attr("font-weight", "bold")
          .attr("fill", "hsl(var(--primary-foreground))")
          .text("📦")

        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", 15)
          .attr("font-size", "10")
          .attr("font-weight", "600")
          .attr("fill", "hsl(var(--primary-foreground))")
          .text("Project")
      } else {
        g.append("rect")
          .attr("width", 180)
          .attr("height", 70)
          .attr("x", -90)
          .attr("y", -35)
          .attr("rx", 8)
          .attr("fill", "hsl(var(--card))")
          .attr("stroke", (d) => (selectedComponent?.id === d.id ? "hsl(var(--primary))" : "hsl(var(--border))"))
          .attr("stroke-width", (d) => (selectedComponent?.id === d.id ? 2 : 1))

        g.append("circle")
          .attr("cx", -75)
          .attr("cy", -20)
          .attr("r", 4)
          .attr("fill", (d) => {
            const color = d.severityColor
            return color === "bg-red-500"
              ? "#ef4444"
              : color === "bg-orange-500"
                ? "#f97316"
                : color === "bg-yellow-500"
                  ? "#eab308"
                  : color === "bg-green-500"
                    ? "#22c55e"
                    : "hsl(var(--muted))"
          })

        g.append("text")
          .attr("x", -75)
          .attr("y", 0)
          .attr("text-anchor", "start")
          .attr("font-size", "14")
          .attr("fill", "hsl(var(--muted-foreground))")
          .text("📦")

        g.append("text")
          .attr("x", -55)
          .attr("y", -5)
          .attr("text-anchor", "start")
          .attr("font-size", "12")
          .attr("font-weight", "500")
          .attr("fill", "hsl(var(--foreground))")
          .text((d) => {
            const name = d.component!.name
            return name.length > 20 ? name.substring(0, 20) + "..." : name
          })

        g.append("text")
          .attr("x", -55)
          .attr("y", 10)
          .attr("text-anchor", "start")
          .attr("font-size", "10")
          .attr("fill", "hsl(var(--muted-foreground))")
          .text((d) => d.component!.version)

        let xOffset = -75

        if (d.component!.isDirect) {
          g.append("rect")
            .attr("x", xOffset)
            .attr("y", 18)
            .attr("width", 35)
            .attr("height", 14)
            .attr("rx", 3)
            .attr("fill", "hsl(var(--primary) / 0.1)")

          g.append("text")
            .attr("x", xOffset + 17.5)
            .attr("y", 28)
            .attr("text-anchor", "middle")
            .attr("font-size", "9")
            .attr("fill", "hsl(var(--primary))")
            .text("Direct")

          xOffset += 40
        }

        if (d.component!.vulnerabilities.length > 0) {
          g.append("text")
            .attr("x", xOffset)
            .attr("y", 28)
            .attr("text-anchor", "start")
            .attr("font-size", "10")
            .attr(
              "fill",
              d.severityColor === "bg-red-500"
                ? "#ef4444"
                : d.severityColor === "bg-orange-500"
                  ? "#f97316"
                  : d.severityColor === "bg-yellow-500"
                    ? "#eab308"
                    : "#22c55e",
            )
            .text(`⚠ ${d.component!.vulnerabilities.length}`)

          xOffset += 30
        }

        if (d.childCount && d.childCount > 0) {
          g.append("circle")
            .attr("cx", 75)
            .attr("cy", 0)
            .attr("r", 10)
            .attr("fill", "hsl(var(--primary))")
            .attr("stroke", "hsl(var(--background))")
            .attr("stroke-width", 2)

          g.append("text")
            .attr("x", 75)
            .attr("y", 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "12")
            .attr("font-weight", "bold")
            .attr("fill", "hsl(var(--primary-foreground))")
            .text(d.isCollapsed ? "+" : "−")
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
  }, [graphData, dimensions, onComponentSelect, selectedComponent, toggleCollapse])

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
          <div className="font-semibold mb-2">Severity</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Low</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-2">
          <div className="font-semibold mb-2">Interactions</div>
          <div className="space-y-1 text-[10px]">
            <div>Click: Select node</div>
            <div>Double-click: Expand/collapse</div>
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

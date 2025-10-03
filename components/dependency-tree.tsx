"use client"

import { useEffect, useRef, useMemo, useState, useCallback } from "react"
import * as d3 from "d3"
import type { ParsedSBOM, Component, FilterState } from "@/lib/types"
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Maximize, Package, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DependencyTreeProps {
  sbomData: ParsedSBOM
  filters: FilterState
  onComponentSelect: (component: Component) => void
  selectedComponent: Component | null
}

interface TreeNode extends d3.SimulationNodeDatum {
  id: string
  component: Component | null
  severityColor: string
  x?: number
  y?: number
  isRoot?: boolean
  isCollapsed?: boolean
  childCount?: number
  level?: number
  parent?: string
  children?: TreeNode[]
}

interface TreeLink extends d3.SimulationLinkDatum<TreeNode> {
  source: string | TreeNode
  target: string | TreeNode
}

export function DependencyTree({ sbomData, filters, onComponentSelect, selectedComponent }: DependencyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null)

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

  const treeData = useMemo(() => {
    const nodes: TreeNode[] = []
    const links: TreeLink[] = []
    const filteredIds = new Set(filteredComponents.map((c) => c.id))

    // Create root node
    const rootNode: TreeNode = {
      id: "__root__",
      component: null,
      severityColor: "bg-primary",
      isRoot: true,
      isCollapsed: collapsedNodes.has("__root__"),
      level: 0,
    }
    nodes.push(rootNode)

    // Build hierarchical tree structure
    const buildTree = (parentId: string, level: number, parentComponent?: Component) => {
      if (level > 5) return // Limit depth to prevent infinite recursion

      const children = parentComponent 
        ? parentComponent.dependencies.filter(id => filteredIds.has(id))
        : sbomData.rootComponents.filter(id => filteredIds.has(id))

      children.forEach(childId => {
        const component = sbomData.components.get(childId)
        if (!component) return

        const isCollapsed = collapsedNodes.has(childId)
        const maxSeverity = getMaxSeverity(component.vulnerabilities)
        const severityColor = getSeverityColor(maxSeverity)
        
        const node: TreeNode = {
          id: childId,
          component,
          severityColor,
          isCollapsed,
          level: level + 1,
          parent: parentId,
          childCount: component.dependencies.filter(id => filteredIds.has(id)).length,
        }
        
        nodes.push(node)

        // Add link
        links.push({
          source: parentId,
          target: childId,
        })

        // Recursively add children if not collapsed
        if (!isCollapsed && component.dependencies.length > 0) {
          buildTree(childId, level + 1, component)
        }
      })
    }

    // Start building from root
    buildTree("__root__", 0)

    return { nodes, links }
  }, [filteredComponents, collapsedNodes, sbomData.components, sbomData.rootComponents])

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

  const expandAll = () => {
    setCollapsedNodes(new Set())
  }

  const collapseAll = () => {
    const allNodeIds = new Set(treeData.nodes.filter((n) => n.childCount && n.childCount > 0).map((n) => n.id))
    setCollapsedNodes(allNodeIds)
  }

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
    if (!svgRef.current || treeData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const { width, height } = dimensions

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    const g = svg.append("g")

    // Add arrow markers
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

    // Create hierarchical layout
    const treeLayout = d3.tree<TreeNode>()
      .size([width - 200, height - 200])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth!)

    // Build hierarchy
    const root = d3.hierarchy(treeData.nodes.find(n => n.isRoot)!, (d) => {
      if (d.isCollapsed) return []
      return treeData.nodes.filter(n => n.parent === d.id)
    })

    const tree = treeLayout(root)

    // Update nodes with tree positions
    treeData.nodes.forEach(node => {
      const treeNode = tree.find(n => n.data.id === node.id)
      if (treeNode) {
        node.x = treeNode.x! + 100
        node.y = treeNode.y! + 100
      }
    })

    // Create simulation for smooth interactions
    const simulation = d3
      .forceSimulation<TreeNode>(treeData.nodes)
      .force("link", d3.forceLink<TreeNode, TreeLink>(treeData.links).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50))

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(treeData.links)
      .join("line")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)")

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(treeData.nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, TreeNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended))
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

    // Render nodes
    node.each(function (d) {
      const g = d3.select(this)

      if (d.isRoot) {
        // Root node
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
        // Component nodes
        const nodeWidth = 200
        const nodeHeight = 80

        g.append("rect")
          .attr("width", nodeWidth)
          .attr("height", nodeHeight)
          .attr("x", -nodeWidth / 2)
          .attr("y", -nodeHeight / 2)
          .attr("rx", 12)
          .attr("fill", "hsl(var(--card))")
          .attr("stroke", (d) => (selectedComponent?.id === d.id ? "hsl(var(--primary))" : "hsl(var(--border))"))
          .attr("stroke-width", (d) => (selectedComponent?.id === d.id ? 3 : 1))
          .attr("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.1))")

        // Severity indicator
        g.append("circle")
          .attr("cx", -nodeWidth / 2 + 20)
          .attr("cy", -nodeHeight / 2 + 20)
          .attr("r", 6)
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

        // Package icon
        g.append("text")
          .attr("x", -nodeWidth / 2 + 20)
          .attr("y", 5)
          .attr("text-anchor", "middle")
          .attr("font-size", "16")
          .attr("fill", "hsl(var(--muted-foreground))")
          .text("📦")

        // Component name
        g.append("text")
          .attr("x", 0)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .attr("font-size", "14")
          .attr("font-weight", "600")
          .attr("fill", "hsl(var(--foreground))")
          .text((d) => {
            const name = d.component!.name
            return name.length > 25 ? name.substring(0, 25) + "..." : name
          })

        // Version
        g.append("text")
          .attr("x", 0)
          .attr("y", 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "12")
          .attr("fill", "hsl(var(--muted-foreground))")
          .text((d) => d.component!.version)

        // Badges
        let xOffset = -nodeWidth / 2 + 20

        if (d.component!.isDirect) {
          g.append("rect")
            .attr("x", xOffset)
            .attr("y", nodeHeight / 2 - 25)
            .attr("width", 45)
            .attr("height", 18)
            .attr("rx", 9)
            .attr("fill", "hsl(var(--primary) / 0.1)")

          g.append("text")
            .attr("x", xOffset + 22.5)
            .attr("y", nodeHeight / 2 - 13)
            .attr("text-anchor", "middle")
            .attr("font-size", "10")
            .attr("font-weight", "500")
            .attr("fill", "hsl(var(--primary))")
            .text("Direct")

          xOffset += 50
        }

        if (d.component!.vulnerabilities.length > 0) {
          g.append("rect")
            .attr("x", xOffset)
            .attr("y", nodeHeight / 2 - 25)
            .attr("width", 35)
            .attr("height", 18)
            .attr("rx", 9)
            .attr("fill", (d) => {
              const color = d.severityColor
              return color === "bg-red-500"
                ? "#fee"
                : color === "bg-orange-500"
                  ? "#ffe"
                  : color === "bg-yellow-500"
                    ? "#ffc"
                    : "#efe"
            })

          g.append("text")
            .attr("x", xOffset + 17.5)
            .attr("y", nodeHeight / 2 - 13)
            .attr("text-anchor", "middle")
            .attr("font-size", "10")
            .attr("font-weight", "500")
            .attr("fill", (d) => {
              const color = d.severityColor
              return color === "bg-red-500"
                ? "#dc2626"
                : color === "bg-orange-500"
                  ? "#ea580c"
                  : color === "bg-yellow-500"
                    ? "#ca8a04"
                    : "#16a34a"
            })
            .text(`⚠ ${d.component!.vulnerabilities.length}`)

          xOffset += 40
        }

        // Expand/collapse button
        if (d.childCount && d.childCount > 0) {
          g.append("circle")
            .attr("cx", nodeWidth / 2 - 20)
            .attr("cy", 0)
            .attr("r", 12)
            .attr("fill", "hsl(var(--primary))")
            .attr("stroke", "hsl(var(--background))")
            .attr("stroke-width", 2)

          g.append("text")
            .attr("x", nodeWidth / 2 - 20)
            .attr("y", 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "14")
            .attr("font-weight", "bold")
            .attr("fill", "hsl(var(--primary-foreground))")
            .text(d.isCollapsed ? "+" : "−")
        }
      }
    })

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as TreeNode).x!)
        .attr("y1", (d) => (d.source as TreeNode).y!)
        .attr("x2", (d) => (d.target as TreeNode).x!)
        .attr("y2", (d) => (d.target as TreeNode).y!)

      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event: d3.D3DragEvent<SVGGElement, TreeNode, TreeNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, TreeNode, TreeNode>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, TreeNode, TreeNode>) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    // Zoom controls
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
  }, [treeData, dimensions, onComponentSelect, selectedComponent, toggleCollapse])

  const handleZoomIn = () => {
    ;(svgRef.current as any)?.zoomIn?.()
  }

  const handleZoomOut = () => {
    ;(svgRef.current as any)?.zoomOut?.()
  }

  const handleResetZoom = () => {
    ;(svgRef.current as any)?.resetZoom?.()
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

      {/* Interactive Tree Graph */}
      <div ref={containerRef} className="relative h-full w-full bg-background border border-border rounded-lg overflow-hidden">
        {filteredComponents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No components match the current filters</p>
            </div>
          </div>
        ) : (
          <>
            <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />

            {/* Tooltip */}
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

            {/* Controls */}
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
            </div>

            {/* Legend */}
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
          </>
        )}
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

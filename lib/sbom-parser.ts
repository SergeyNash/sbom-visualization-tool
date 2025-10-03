import type { SBOMFile, ParsedSBOM, Component } from "./types"

export async function parseSBOMFiles(files: File[]): Promise<ParsedSBOM> {
  const sbomFiles: SBOMFile[] = []

  // Parse all JSON files
  for (const file of files) {
    const text = await file.text()
    const json = JSON.parse(text) as SBOMFile
    sbomFiles.push(json)
  }

  // Merge components from all files
  const componentsMap = new Map<string, Component>()
  const dependencyGraph = new Map<string, Set<string>>()
  let projectName = "Unknown Project"
  let timestamp = new Date().toISOString()

  for (const sbom of sbomFiles) {
    // Extract project name from first file
    if (sbom.metadata?.component?.name) {
      projectName = sbom.metadata.component.name
    }
    timestamp = sbom.metadata?.timestamp || timestamp

    // Process components
    if (sbom.components) {
      for (const comp of sbom.components) {
        const componentId = comp["bom-ref"] || `${comp.name}@${comp.version}`

        // Extract license
        const license = comp.licenses?.[0]?.license?.id || comp.licenses?.[0]?.license?.name || "Unknown"

        // Extract path from properties
        const pathProp = comp.properties?.find((p) => p.name === "syft:location:0:path")
        const path = pathProp?.value || ""

        // Create or update component
        if (!componentsMap.has(componentId)) {
          componentsMap.set(componentId, {
            id: componentId,
            name: comp.name,
            version: comp.version,
            type: comp.type,
            purl: comp.purl,
            license,
            isDirect: false, // Will be determined later
            vulnerabilities: [],
            dependencies: [],
            path,
          })
        }
      }
    }

    // Process dependencies
    if (sbom.dependencies) {
      for (const dep of sbom.dependencies) {
        if (dep.dependsOn) {
          const deps = dependencyGraph.get(dep.ref) || new Set()
          dep.dependsOn.forEach((d) => deps.add(d))
          dependencyGraph.set(dep.ref, deps)
        }
      }
    }
  }

  // Build dependency relationships
  const rootComponents: string[] = []
  const allDependencies = new Set<string>()

  dependencyGraph.forEach((deps, ref) => {
    deps.forEach((dep) => allDependencies.add(dep))

    const component = componentsMap.get(ref)
    if (component) {
      component.dependencies = Array.from(deps)
    }
  })

  // Identify root components (not depended on by others)
  componentsMap.forEach((comp, id) => {
    if (!allDependencies.has(id)) {
      rootComponents.push(id)
      comp.isDirect = true
    }
  })

  // Mark direct dependencies
  rootComponents.forEach((rootId) => {
    const root = componentsMap.get(rootId)
    if (root) {
      root.dependencies.forEach((depId) => {
        const dep = componentsMap.get(depId)
        if (dep) {
          dep.isDirect = true
        }
      })
    }
  })

  // If no dependency graph, treat all as direct
  if (rootComponents.length === 0) {
    componentsMap.forEach((comp) => {
      comp.isDirect = true
      rootComponents.push(comp.id)
    })
  }

  const directCount = Array.from(componentsMap.values()).filter((c) => c.isDirect).length
  const transitiveCount = componentsMap.size - directCount

  return {
    projectName,
    timestamp,
    components: componentsMap,
    rootComponents,
    totalComponents: componentsMap.size,
    directCount,
    transitiveCount,
  }
}

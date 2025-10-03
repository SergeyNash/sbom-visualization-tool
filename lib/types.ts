export interface SBOMFile {
  bomFormat: string
  specVersion: string
  serialNumber: string
  version: number
  metadata: {
    timestamp: string
    tools: {
      components: Array<{
        type: string
        author: string
        name: string
        version: string
      }>
    }
    component: {
      "bom-ref": string
      type: string
      name: string
      version?: string
    }
  }
  components: Array<{
    "bom-ref": string
    type: string
    name: string
    version: string
    cpe?: string
    purl?: string
    properties?: Array<{
      name: string
      value: string
    }>
    licenses?: Array<{
      license: {
        id?: string
        name?: string
      }
    }>
  }>
  dependencies?: Array<{
    ref: string
    dependsOn?: string[]
  }>
}

export interface Component {
  id: string
  name: string
  version: string
  type: string
  purl?: string
  license?: string
  isDirect: boolean
  vulnerabilities: Vulnerability[]
  dependencies: string[]
  path: string
}

export interface Vulnerability {
  id: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  description?: string
  remediation?: string
}

export interface ParsedSBOM {
  projectName: string
  timestamp: string
  components: Map<string, Component>
  rootComponents: string[]
  totalComponents: number
  directCount: number
  transitiveCount: number
}

export interface FilterState {
  search: string
  dependencyType: "all" | "direct" | "transitive"
  severity: "all" | "critical" | "high" | "medium" | "low"
  cveId: string
}

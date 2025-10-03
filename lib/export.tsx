import type { ParsedSBOM } from "./types"

export function exportToJSON(sbomData: ParsedSBOM) {
  const components = Array.from(sbomData.components.values()).map((comp) => ({
    name: comp.name,
    version: comp.version,
    type: comp.type,
    license: comp.license,
    isDirect: comp.isDirect,
    purl: comp.purl,
    path: comp.path,
    vulnerabilities: comp.vulnerabilities.map((v) => ({
      id: v.id,
      severity: v.severity,
      description: v.description,
      remediation: v.remediation,
    })),
    dependencies: comp.dependencies,
  }))

  const exportData = {
    projectName: sbomData.projectName,
    timestamp: sbomData.timestamp,
    summary: {
      totalComponents: sbomData.totalComponents,
      directDependencies: sbomData.directCount,
      transitiveDependencies: sbomData.transitiveCount,
      vulnerabilities: {
        critical: countVulnerabilitiesBySeverity(sbomData, "critical"),
        high: countVulnerabilitiesBySeverity(sbomData, "high"),
        medium: countVulnerabilitiesBySeverity(sbomData, "medium"),
        low: countVulnerabilitiesBySeverity(sbomData, "low"),
      },
    },
    components,
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `sbom-export-${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportToPDF(sbomData: ParsedSBOM) {
  // Create HTML content for PDF
  const components = Array.from(sbomData.components.values())
  const criticalCount = countVulnerabilitiesBySeverity(sbomData, "critical")
  const highCount = countVulnerabilitiesBySeverity(sbomData, "high")
  const mediumCount = countVulnerabilitiesBySeverity(sbomData, "medium")
  const lowCount = countVulnerabilitiesBySeverity(sbomData, "low")

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SBOM Report - ${sbomData.projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
      background: white;
      color: #000;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
    h3 { font-size: 16px; margin-top: 24px; margin-bottom: 12px; }
    .header { margin-bottom: 32px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 4px; }
    .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
    .summary-card { border: 1px solid #e5e5e5; padding: 16px; border-radius: 8px; }
    .summary-card h3 { margin: 0 0 8px 0; font-size: 14px; color: #666; text-transform: uppercase; }
    .summary-card .value { font-size: 32px; font-weight: bold; }
    .vuln-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
    .vuln-card { border: 1px solid #e5e5e5; padding: 12px; border-radius: 6px; text-align: center; }
    .vuln-card.critical { background: #fee; border-color: #fcc; }
    .vuln-card.high { background: #ffe; border-color: #fec; }
    .vuln-card.medium { background: #ffc; border-color: #feb; }
    .vuln-card.low { background: #efe; border-color: #cfc; }
    .vuln-card .count { font-size: 24px; font-weight: bold; }
    .vuln-card .label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    tr:hover { background: #fafafa; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .badge.direct { background: #e0e7ff; color: #4338ca; }
    .badge.transitive { background: #f3f4f6; color: #6b7280; }
    .badge.critical { background: #fee; color: #dc2626; }
    .badge.high { background: #ffe; color: #ea580c; }
    .badge.medium { background: #ffc; color: #ca8a04; }
    .badge.low { background: #efe; color: #16a34a; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SBOM Dependency Report</h1>
    <div class="meta">Project: ${sbomData.projectName}</div>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
    <div class="meta">Analysis Date: ${new Date(sbomData.timestamp).toLocaleString()}</div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Components</h3>
      <div class="value">${sbomData.totalComponents}</div>
    </div>
    <div class="summary-card">
      <h3>Direct Dependencies</h3>
      <div class="value">${sbomData.directCount}</div>
    </div>
  </div>

  <h2>Vulnerability Summary</h2>
  <div class="vuln-grid">
    <div class="vuln-card critical">
      <div class="count">${criticalCount}</div>
      <div class="label">Critical</div>
    </div>
    <div class="vuln-card high">
      <div class="count">${highCount}</div>
      <div class="label">High</div>
    </div>
    <div class="vuln-card medium">
      <div class="count">${mediumCount}</div>
      <div class="label">Medium</div>
    </div>
    <div class="vuln-card low">
      <div class="count">${lowCount}</div>
      <div class="label">Low</div>
    </div>
  </div>

  <h2>Component Details</h2>
  <table>
    <thead>
      <tr>
        <th>Component</th>
        <th>Version</th>
        <th>Type</th>
        <th>License</th>
        <th>Vulnerabilities</th>
      </tr>
    </thead>
    <tbody>
      ${components
        .map(
          (comp) => `
        <tr>
          <td><strong>${comp.name}</strong></td>
          <td>${comp.version}</td>
          <td><span class="badge ${comp.isDirect ? "direct" : "transitive"}">${comp.isDirect ? "Direct" : "Transitive"}</span></td>
          <td>${comp.license || "Unknown"}</td>
          <td>
            ${
              comp.vulnerabilities.length === 0
                ? '<span style="color: #16a34a;">None</span>'
                : comp.vulnerabilities.map((v) => `<span class="badge ${v.severity}">${v.id}</span>`).join(" ")
            }
          </td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    Generated by SBOM Visualizer
  </div>
</body>
</html>
  `

  // Create a blob and download
  const blob = new Blob([html], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `sbom-report-${new Date().toISOString().split("T")[0]}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  // Note: For true PDF generation, you would need a library like jsPDF or html2pdf
  // This exports as HTML which can be printed to PDF by the browser
  console.log("[v0] PDF export: HTML file generated. Use browser Print to PDF for final PDF.")
}

function countVulnerabilitiesBySeverity(sbomData: ParsedSBOM, severity: string): number {
  let count = 0
  sbomData.components.forEach((comp) => {
    count += comp.vulnerabilities.filter((v) => v.severity === severity).length
  })
  return count
}

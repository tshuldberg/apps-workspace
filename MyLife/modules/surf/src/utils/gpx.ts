import type { GpxTrackPoint } from '../types'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function exportTrackToGpx(
  name: string,
  points: GpxTrackPoint[],
): string {
  const safeName = escapeXml(name || 'Recorded Track')
  const nowIso = new Date().toISOString()

  const trkpts = points
    .map((point) => {
      const elevation = point.elevationMeters != null
        ? `<ele>${point.elevationMeters.toFixed(2)}</ele>`
        : ''
      const time = point.timestamp
        ? `<time>${escapeXml(point.timestamp)}</time>`
        : ''
      return `<trkpt lat="${point.latitude.toFixed(8)}" lon="${point.longitude.toFixed(8)}">${elevation}${time}</trkpt>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MySurf" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <time>${nowIso}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>`
}

export function importTrackFromGpx(xml: string): {
  name: string
  points: GpxTrackPoint[]
} {
  const nameMatch = xml.match(/<name>([^<]+)<\/name>/i)
  const name = nameMatch?.[1]?.trim() || 'Imported Track'

  const points: GpxTrackPoint[] = []
  const trkptRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi

  let match = trkptRegex.exec(xml)
  while (match) {
    const latitude = Number(match[1])
    const longitude = Number(match[2])
    const body = match[3] || ''

    const eleMatch = body.match(/<ele>([^<]+)<\/ele>/i)
    const timeMatch = body.match(/<time>([^<]+)<\/time>/i)

    points.push({
      latitude,
      longitude,
      elevationMeters: eleMatch ? Number(eleMatch[1]) : undefined,
      timestamp: timeMatch ? timeMatch[1] : undefined,
    })

    match = trkptRegex.exec(xml)
  }

  return { name, points }
}

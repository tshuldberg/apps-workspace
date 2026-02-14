import React, { useMemo } from 'react'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { colors } from '../constants/theme'

interface SparklineProps {
  data: number[]
  width: number
  height: number
  positive?: boolean
}

export function Sparkline({ data, width, height, positive = true }: SparklineProps) {
  const pathStr = useMemo(() => {
    if (data.length < 2) return ''

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const stepX = width / (data.length - 1)
    const points = data.map((v, i) => ({
      x: i * stepX,
      y: height - ((v - min) / range) * (height * 0.8) - height * 0.1,
    }))

    const path = Skia.Path.Make()
    path.moveTo(points[0]!.x, points[0]!.y)
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i]!.x, points[i]!.y)
    }

    return path
  }, [data, width, height])

  if (!pathStr || data.length < 2) return null

  return (
    <Canvas style={{ width, height }}>
      <Path
        path={pathStr}
        color={positive ? colors.tradingGreen : colors.tradingRed}
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
        strokeJoin="round"
      />
    </Canvas>
  )
}

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, Text, Dimensions, LayoutChangeEvent } from 'react-native'
import {
  Canvas,
  Rect,
  Line,
  vec,
  Group,
  useFont,
  Text as SkiaText,
  Path,
  Skia,
} from '@shopify/react-native-skia'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import type { OHLCV, Timeframe } from '@marlin/shared'
import { formatPrice, formatVolume } from '@marlin/shared'
import { colors, spacing, fontSize } from '../../constants/theme'

interface SkiaChartProps {
  data: OHLCV[]
  timeframe: Timeframe
  symbol?: string
}

interface CrosshairData {
  x: number
  y: number
  bar: OHLCV
  visible: boolean
}

const VOLUME_HEIGHT_RATIO = 0.2
const CANDLE_PADDING = 0.15
const MIN_CANDLE_WIDTH = 2
const MAX_CANDLE_WIDTH = 40
const PRICE_LABEL_WIDTH = 65
const TIME_AXIS_HEIGHT = 24
const CHART_PADDING_TOP = 8

export function SkiaChart({ data, timeframe, symbol }: SkiaChartProps) {
  const [layout, setLayout] = useState({ width: Dimensions.get('window').width, height: 300 })
  const [crosshair, setCrosshair] = useState<CrosshairData>({
    x: 0,
    y: 0,
    bar: data[0] ?? { open: 0, high: 0, low: 0, close: 0, volume: 0, timestamp: 0 },
    visible: false,
  })

  const scaleX = useSharedValue(1)
  const savedScaleX = useSharedValue(1)
  const translateX = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)

  const [currentScale, setCurrentScale] = useState(1)
  const [currentTranslateX, setCurrentTranslateX] = useState(0)

  const chartWidth = layout.width - PRICE_LABEL_WIDTH
  const chartHeight = layout.height - TIME_AXIS_HEIGHT
  const priceChartHeight = chartHeight * (1 - VOLUME_HEIGHT_RATIO) - CHART_PADDING_TOP
  const volumeChartHeight = chartHeight * VOLUME_HEIGHT_RATIO

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setLayout({ width, height })
  }, [])

  const syncValues = useCallback((s: number, tx: number) => {
    setCurrentScale(s)
    setCurrentTranslateX(tx)
  }, [])

  const candleWidth = useMemo(() => {
    if (data.length === 0) return 8
    const raw = (chartWidth / data.length) * currentScale
    return Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, raw))
  }, [chartWidth, data.length, currentScale])

  const visibleRange = useMemo(() => {
    if (data.length === 0) return { start: 0, end: 0 }
    const totalWidth = data.length * candleWidth
    const offset = -currentTranslateX
    const start = Math.max(0, Math.floor(offset / candleWidth) - 1)
    const end = Math.min(
      data.length,
      Math.ceil((offset + chartWidth) / candleWidth) + 1,
    )
    return { start, end }
  }, [data.length, candleWidth, currentTranslateX, chartWidth])

  const visibleData = useMemo(
    () => data.slice(visibleRange.start, visibleRange.end),
    [data, visibleRange],
  )

  const { priceMin, priceMax, volumeMax } = useMemo(() => {
    if (visibleData.length === 0) {
      return { priceMin: 0, priceMax: 1, volumeMax: 1 }
    }
    let min = Infinity
    let max = -Infinity
    let volMax = 0
    for (const bar of visibleData) {
      if (bar.low < min) min = bar.low
      if (bar.high > max) max = bar.high
      if (bar.volume > volMax) volMax = bar.volume
    }
    const padding = (max - min) * 0.05
    return {
      priceMin: min - padding,
      priceMax: max + padding,
      volumeMax: volMax,
    }
  }, [visibleData])

  const priceToY = useCallback(
    (price: number) => {
      const range = priceMax - priceMin
      if (range === 0) return CHART_PADDING_TOP + priceChartHeight / 2
      return CHART_PADDING_TOP + (1 - (price - priceMin) / range) * priceChartHeight
    },
    [priceMin, priceMax, priceChartHeight],
  )

  const volumeToHeight = useCallback(
    (volume: number) => {
      if (volumeMax === 0) return 0
      return (volume / volumeMax) * volumeChartHeight * 0.9
    },
    [volumeMax, volumeChartHeight],
  )

  const indexToX = useCallback(
    (index: number) => {
      return index * candleWidth + currentTranslateX + candleWidth / 2
    },
    [candleWidth, currentTranslateX],
  )

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScaleX.value = scaleX.value
    })
    .onUpdate((e) => {
      const newScale = Math.max(0.5, Math.min(10, savedScaleX.value * e.scale))
      scaleX.value = newScale
      runOnJS(syncValues)(newScale, translateX.value)
    })

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      savedTranslateX.value = translateX.value
    })
    .onUpdate((e) => {
      const totalWidth = data.length * candleWidth
      const maxTranslate = 0
      const minTranslate = -(totalWidth - chartWidth)
      const newTranslate = Math.max(
        minTranslate,
        Math.min(maxTranslate, savedTranslateX.value + e.translationX),
      )
      translateX.value = newTranslate
      runOnJS(syncValues)(scaleX.value, newTranslate)
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scaleX.value = withTiming(1)
      translateX.value = withTiming(0)
      runOnJS(syncValues)(1, 0)
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(200)
    .onStart((e) => {
      const x = e.x
      const barIndex = Math.round(
        (x - currentTranslateX - candleWidth / 2) / candleWidth,
      )
      const clampedIndex = Math.max(0, Math.min(data.length - 1, barIndex))
      const bar = data[clampedIndex]
      if (bar) {
        runOnJS(setCrosshair)({
          x: indexToX(clampedIndex),
          y: priceToY(bar.close),
          bar,
          visible: true,
        })
      }
    })
    .onEnd(() => {
      runOnJS(setCrosshair)((prev: CrosshairData) => ({ ...prev, visible: false }))
    })

  const composed = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(panGesture, pinchGesture),
    longPressGesture,
  )

  const volumeAreaY = CHART_PADDING_TOP + priceChartHeight

  return (
    <View style={styles.container} onLayout={onLayout}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={composed}>
          <Animated.View style={StyleSheet.absoluteFill}>
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Price grid lines */}
              {Array.from({ length: 5 }).map((_, i) => {
                const price = priceMin + ((priceMax - priceMin) * i) / 4
                const y = priceToY(price)
                return (
                  <Line
                    key={`grid-${i}`}
                    p1={vec(0, y)}
                    p2={vec(chartWidth, y)}
                    color="rgba(30, 41, 59, 0.5)"
                    strokeWidth={0.5}
                  />
                )
              })}

              {/* Volume separator line */}
              <Line
                p1={vec(0, volumeAreaY)}
                p2={vec(chartWidth, volumeAreaY)}
                color={colors.border}
                strokeWidth={0.5}
              />

              {/* Candlesticks */}
              <Group clip={Skia.XYWHRect(0, 0, chartWidth, chartHeight)}>
                {visibleData.map((bar, i) => {
                  const globalIndex = visibleRange.start + i
                  const x = indexToX(globalIndex)
                  const isUp = bar.close >= bar.open
                  const color = isUp ? colors.tradingGreen : colors.tradingRed
                  const bodyWidth = candleWidth * (1 - CANDLE_PADDING * 2)
                  const wickWidth = Math.max(1, bodyWidth * 0.1)

                  const bodyTop = priceToY(Math.max(bar.open, bar.close))
                  const bodyBottom = priceToY(Math.min(bar.open, bar.close))
                  const bodyHeight = Math.max(1, bodyBottom - bodyTop)

                  const wickTop = priceToY(bar.high)
                  const wickBottom = priceToY(bar.low)

                  const volH = volumeToHeight(bar.volume)
                  const volY = volumeAreaY + volumeChartHeight - volH

                  return (
                    <Group key={`candle-${globalIndex}`}>
                      {/* Upper wick */}
                      <Rect
                        x={x - wickWidth / 2}
                        y={wickTop}
                        width={wickWidth}
                        height={bodyTop - wickTop}
                        color={color}
                      />
                      {/* Body */}
                      <Rect
                        x={x - bodyWidth / 2}
                        y={bodyTop}
                        width={bodyWidth}
                        height={bodyHeight}
                        color={color}
                      />
                      {/* Lower wick */}
                      <Rect
                        x={x - wickWidth / 2}
                        y={bodyBottom}
                        width={wickWidth}
                        height={wickBottom - bodyBottom}
                        color={color}
                      />
                      {/* Volume bar */}
                      <Rect
                        x={x - bodyWidth / 2}
                        y={volY}
                        width={bodyWidth}
                        height={volH}
                        color={isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}
                      />
                    </Group>
                  )
                })}
              </Group>

              {/* Crosshair */}
              {crosshair.visible && (
                <Group>
                  <Line
                    p1={vec(crosshair.x, 0)}
                    p2={vec(crosshair.x, chartHeight)}
                    color={colors.crosshairLine}
                    strokeWidth={0.5}
                    style="stroke"
                  />
                  <Line
                    p1={vec(0, crosshair.y)}
                    p2={vec(chartWidth, crosshair.y)}
                    color={colors.crosshairLine}
                    strokeWidth={0.5}
                    style="stroke"
                  />
                </Group>
              )}
            </Canvas>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Price labels on right side */}
      <View style={[styles.priceLabels, { left: chartWidth }]}>
        {Array.from({ length: 5 }).map((_, i) => {
          const price = priceMin + ((priceMax - priceMin) * (4 - i)) / 4
          return (
            <Text key={`price-${i}`} style={styles.priceLabel}>
              {formatPrice(price)}
            </Text>
          )
        })}
      </View>

      {/* Crosshair tooltip */}
      {crosshair.visible && (
        <View
          style={[
            styles.tooltip,
            {
              left: Math.min(crosshair.x + 12, chartWidth - 160),
              top: Math.max(CHART_PADDING_TOP, crosshair.y - 80),
            },
          ]}
        >
          <Text style={styles.tooltipLabel}>
            O{' '}
            <Text style={styles.tooltipValue}>{formatPrice(crosshair.bar.open)}</Text>
          </Text>
          <Text style={styles.tooltipLabel}>
            H{' '}
            <Text style={styles.tooltipValue}>{formatPrice(crosshair.bar.high)}</Text>
          </Text>
          <Text style={styles.tooltipLabel}>
            L{' '}
            <Text style={styles.tooltipValue}>{formatPrice(crosshair.bar.low)}</Text>
          </Text>
          <Text style={styles.tooltipLabel}>
            C{' '}
            <Text style={styles.tooltipValue}>{formatPrice(crosshair.bar.close)}</Text>
          </Text>
          <Text style={styles.tooltipLabel}>
            Vol{' '}
            <Text style={styles.tooltipValue}>
              {formatVolume(crosshair.bar.volume)}
            </Text>
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyBlack,
  },
  priceLabels: {
    position: 'absolute',
    top: CHART_PADDING_TOP,
    width: PRICE_LABEL_WIDTH,
    bottom: TIME_AXIS_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 15, 26, 0.95)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 8,
    minWidth: 130,
  },
  tooltipLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  tooltipValue: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
})

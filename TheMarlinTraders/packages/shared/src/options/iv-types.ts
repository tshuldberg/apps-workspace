export interface IVAnalytics {
  symbol: string
  currentIV: number
  ivRank: number // 0-100
  ivPercentile: number // 0-100
  hv20: number
  hv50: number
  hv100: number
}

export interface IVSurface {
  symbol: string
  expirations: string[] // YYYY-MM-DD
  strikes: number[]
  ivMatrix: number[][] // [expirationIndex][strikeIndex]
}

export interface SkewData {
  symbol: string
  expiration: string
  strikes: number[]
  callIVs: number[]
  putIVs: number[]
}

export interface TermStructure {
  symbol: string
  expirations: string[] // YYYY-MM-DD
  atm_ivs: number[]
}

export interface VolatilityCone {
  period: number // lookback days
  percentile5: number
  percentile25: number
  median: number
  percentile75: number
  percentile95: number
  current: number
}

export interface ExpectedMove {
  symbol: string
  expiration: string
  upperBound: number
  lowerBound: number
  probability: number // 0-1
}

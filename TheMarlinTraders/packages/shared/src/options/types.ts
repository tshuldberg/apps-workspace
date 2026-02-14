export type OptionType = 'call' | 'put'

export interface Strike {
  price: number
  call?: OptionsContract
  put?: OptionsContract
}

export interface Expiration {
  date: string // YYYY-MM-DD
  dte: number // days to expiration
  isWeekly: boolean
  isMonthly: boolean
}

export interface GreeksResult {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

export interface OptionsContract {
  symbol: string // OCC symbol e.g. AAPL240119C00150000
  underlying: string
  type: OptionType
  strike: number
  expiration: string // YYYY-MM-DD
  bid: number
  ask: number
  last: number
  volume: number
  openInterest: number
  iv: number
  greeks: GreeksResult
}

export interface OptionsChainData {
  underlying: string
  underlyingPrice: number
  expiration: string
  strikes: Strike[]
  updatedAt: number
}

export interface IVData {
  currentIV: number
  ivRank: number // 0-100, where current IV sits in 52-week range
  ivPercentile: number // 0-100, % of days below current IV
  putCallRatio: number
  ivHistory: { date: string; iv: number }[]
}

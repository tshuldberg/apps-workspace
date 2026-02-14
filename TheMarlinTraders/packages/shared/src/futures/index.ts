export type {
  FuturesContract,
  ContinuousContract,
  AdjustmentMethod,
  SpreadTrade,
  SpreadType,
  COTData,
  RolloverEntry,
  RolloverCalendar,
  FuturesAssetClass,
  FuturesQuote,
  DetectedPattern,
  PatternScanConfig,
  ScanResult,
} from './types.js'

export type {
  ContractSpec,
} from './calculators.js'

export {
  getContractMultiplier,
  getContractSpec,
  getAllContractSpecs,
  calculateTickValue,
  calculatePnL,
  calculateMarginRequired,
  calculateSpreadValue,
  calculateTicks,
  calculateCOTIndex,
  CONTRACT_SPECS,
} from './calculators.js'

/**
 * TypeScript型定義
 * バックエンドAPIとのインターフェース定義
 */

// 基本的な軌道データ型
export interface TrackData {
  distance: number
  irregularity: number
  cant?: number
  slack?: number
  bcValue?: number
  cdValue?: number
  cantCorrection?: number
  slackCorrection?: number
}

// 統計情報型
export interface Statistics {
  min: number
  max: number
  avg: number
  stdDev: number
}

// データセット型
export interface DataSet {
  data: TrackData[]
  statistics: Statistics
  filename?: string
}

// ピーク型
export interface Peak {
  index: number
  distance: number
  value: number
  type: 'maximum' | 'minimum' | 'local_maximum' | 'local_minimum'
  prominence?: number
  deviation?: number
}

// ピーク検出結果型
export interface PeakDetectionResult {
  success: boolean
  maxima: Peak[]
  minima: Peak[]
  allPeaks?: Peak[]
  totalPeaks: number
  maximaCount: number
  minimaCount: number
  error?: string
}

// ピーク検出オプション型
export interface PeakDetectionOptions {
  minHeight?: number
  minDistance?: number
  threshold?: number
  detectMaxima?: boolean
  detectMinima?: boolean
  outlierSigma?: number
}

// フィルタタイプ
export type FilterType =
  | 'moving_average_3'
  | 'moving_average_5'
  | 'moving_average_7'
  | 'moving_average_9'
  | 'weighted_average'
  | 'low_pass'
  | 'high_pass'
  | 'median'
  | 'savitzky_golay'
  | 'gaussian'
  | 'fft_lowpass'
  | 'fft_highpass'
  | 'fft_bandpass'

// フィルタオプション型
export interface FilterOptions {
  windowSize?: number
  alpha?: number
  sigma?: number
  weights?: number[]
  cutoffFreq?: number
  lowCutoff?: number
  highCutoff?: number
}

// フィルタ適用結果型
export interface FilterResult {
  success: boolean
  data?: TrackData[]
  filterType: string
  description: string
  dataPoints: number
  error?: string
}

// MTT計算パラメータ型
export interface MTTCalculationParams {
  bcCoefficient?: number
  cdCoefficient?: number
  cantCorrectionCoeff?: number
  slackCorrectionCoeff?: number
  thresholds?: {
    bcThreshold?: number
    cdThreshold?: number
  }
}

// MTT計算結果型
export interface MTTCalculationResult {
  success: boolean
  results: TrackData[]
  statistics: {
    bc: Statistics
    cd: Statistics
  }
  parameters: {
    bcCoefficient: number
    cdCoefficient: number
    cantCorrectionCoeff: number
    slackCorrectionCoeff: number
  }
  dataPoints: number
  evaluation?: MTTEvaluation
  error?: string
}

// MTT判定結果型
export interface MTTEvaluation {
  success: boolean
  bcWarnings: {
    count: number
    warnings: Array<{
      index: number
      distance: number
      bcValue: number
      severity: 'high' | 'medium'
    }>
  }
  cdWarnings: {
    count: number
    warnings: Array<{
      index: number
      distance: number
      cdValue: number
      severity: 'high' | 'medium'
    }>
  }
  summary: {
    totalWarnings: number
    highSeverityCount: number
    evaluation: string
  }
}

// 補正係数型
export interface CorrectionCoefficients {
  cant?: number
  slack?: number
}

// 補正適用結果型
export interface CorrectionResult {
  success: boolean
  data?: Array<{
    distance: number
    original: number
    cantCorrection: number
    slackCorrection: number
    totalCorrection: number
    corrected: number
  }>
  statistics?: Statistics
  coefficients?: {
    cant: number
    slack: number
  }
  dataPoints: number
  error?: string
}

// 周波数スペクトル分析結果型
export interface SpectrumAnalysisResult {
  success: boolean
  fftSize: number
  originalLength: number
  powerSpectrum: number[]
  frequencies: number[]
  dominantFrequencies: Array<{
    frequency: number
    power: number
    index: number
  }>
  totalPower: number
}

// エクスポートフォーマット型
export type ExportFormat = 'excel' | 'xlsx' | 'csv' | 'json'

// エクスポートオプション型
export interface ExportOptions {
  statistics?: Statistics
  peaks?: Peak[]
  mttResults?: MTTCalculationResult
  dataPoints?: number
  measurementDate?: string
  lineName?: string
  section?: string
}

// APIレスポンス型（汎用）
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// タブタイプ
export type TabType = 'upload' | 'filter' | 'peaks' | 'mtt' | 'export'

// アプリケーション状態型
export interface AppState {
  currentTab: TabType
  originalData: DataSet | null
  filteredData: DataSet | null
  restoredData: DataSet | null
  peaks: PeakDetectionResult | null
  mttResults: MTTCalculationResult | null
  loading: boolean
  error: string | null
}

// チャート設定型
export interface ChartConfig {
  showOriginal: boolean
  showFiltered: boolean
  showRestored: boolean
  showPeaks: boolean
  peakMarkerSize: number
  lineWidth: number
  animationDuration: number
}

// フィルタ設定型
export interface FilterSettings {
  selectedFilter: FilterType
  options: FilterOptions
  autoApply: boolean
}

// MTT設定型
export interface MTTSettings {
  bcCoefficient: number
  cdCoefficient: number
  cantCoefficient: number
  slackCoefficient: number
  bcThreshold: number
  cdThreshold: number
}

// ピーク検出設定型
export interface PeakDetectionSettings {
  minHeight: number
  minDistance: number
  threshold: number
  detectMaxima: boolean
  detectMinima: boolean
  showOutliers: boolean
  outlierSigma: number
}

// 異常値型
export interface Outlier {
  index: number
  distance: number
  value: number
  deviation: number
  type: 'high' | 'low'
}

// FFT設定型
export interface FFTSettings {
  filterType: 'fft_lowpass' | 'fft_highpass' | 'fft_bandpass'
  cutoffFreq: number
  lowCutoff: number
  highCutoff: number
}

// ========================================
// 旧ラボデータ対応の型定義
// ========================================

// 複数測定項目データ型
export interface MultiMeasurementData {
  distance: number // 距離 (m)
  measurements: {
    elevation_left?: number      // 高低（左） (mm)
    elevation_right?: number     // 高低（右） (mm)
    level_left?: number          // 水準（左） (mm)
    level_right?: number         // 水準（右） (mm)
    alignment_left?: number      // 通り（左） (mm)
    alignment_right?: number     // 通り（右） (mm)
    gauge?: number               // 軌間 (mm)
    [key: string]: number | undefined // 追加の測定項目
  }
}

// 測定項目タイプ
export type MeasurementType =
  | 'elevation_left'
  | 'elevation_right'
  | 'level_left'
  | 'level_right'
  | 'alignment_left'
  | 'alignment_right'
  | 'gauge'

// 測定項目メタデータ
export interface MeasurementTypeMetadata {
  key: MeasurementType
  label: string
  unit: string
  color: string
  description: string
}

// MDTファイルデータ型
export interface MDTData {
  fileId: string
  lineName: string
  direction: '上' | '下'
  measurementDate: string
  startKilometer: number
  endKilometer: number | null
  metadata?: {
    encoding: string
    fileSize: number
    rawContent: string
  }
}

// O010*.csvデータ型
export interface O010Data {
  header: {
    measurementDate: string | null
    course: string | null
    section: string | null
    startKilometer: number | null
    endKilometer: number | null
    rawHeader: string
  }
  measurements: Array<{
    type: string
    lineNumber: number
    kilometer: number | null
    measurements: {
      values: (number | null)[]
      parsed: Record<string, number | null>
    }
    rawLine: string
  }>
  totalRecords: number
}

// 旧ラボデータアップロード結果型
export interface LegacyDataUploadResult {
  success: boolean
  mdtData?: MDTData
  o010Data?: O010Data | null
  multiMeasurementData?: MultiMeasurementData[]
  error?: string
  message?: string
}

// 複数測定項目統計型
export interface MultiMeasurementStatistics {
  [key: string]: Statistics
}

// 複数測定項目データセット型
export interface MultiMeasurementDataSet {
  data: MultiMeasurementData[]
  statistics: MultiMeasurementStatistics
  availableMeasurements: MeasurementType[]
  filename?: string
  metadata?: {
    mdtData?: MDTData
    o010Header?: O010Data['header']
  }
}

// ========================================
// 復元波形計算関連の型定義
// ========================================

// データポイント型
export interface DataPoint {
  distance: number
  value: number
}

// 移動量ポイント型
export interface MovementPoint {
  distance: number
  amount: number
}

// ゼロクロス点型
export interface ZeroCrossPoint {
  distance: number
  index: number
  type: 'ascending' | 'descending'
}

// フィルタ情報型
export interface FilterInfo {
  minFreq: number
  maxFreq: number
  minWavelength: number
  maxWavelength: number
}

// 復元波形計算オプション型
export interface RestorationWaveformOptions {
  minWavelength?: number        // 最小波長（m）デフォルト: 6.0
  maxWavelength?: number         // 最大波長（m）デフォルト: 40.0
  samplingInterval?: number      // サンプリング間隔（m）デフォルト: 0.25
}

// 復元波形計算結果型
export interface RestorationWaveformResult {
  success: boolean
  data?: {
    restorationWaveform: DataPoint[]     // 復元波形
    planLine: DataPoint[]                // 計画線
    movementAmounts: MovementPoint[]     // 移動量
    zeroCrossPoints: ZeroCrossPoint[]    // ゼロクロス点
    filterInfo: FilterInfo               // フィルタ情報
    metadata: {
      originalDataPoints: number
      resampledDataPoints: number
      fftSize: number
      zeroCrossCount: number
      minWavelength: number
      maxWavelength: number
      samplingInterval: number
    }
  }
  error?: string
  stack?: string
}

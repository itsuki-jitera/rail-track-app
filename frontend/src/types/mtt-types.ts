/**
 * MTT (Measured Track data Type) ファイル関連の型定義
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく定義
 * - MTTファイルは測定データの標準交換フォーマット
 * - バイナリ形式でレール毎のデータを効率的に保存
 */

/**
 * MTTファイルバージョン
 */
export enum MTTVersion {
  V1 = 1,  // 初期バージョン
  V2 = 2,  // 拡張データ対応
  V3 = 3   // 品質情報追加
}

/**
 * MTTデータタイプフラグ
 * ビットフラグで複数のデータタイプを組み合わせ可能
 */
export enum MTTDataType {
  LEVEL     = 0x0001,  // 高低狂い
  ALIGNMENT = 0x0002,  // 通り狂い
  GAUGE     = 0x0004,  // 軌間
  CANT      = 0x0008,  // カント
  TWIST     = 0x0010,  // 水準（ねじれ）
  VERSINE   = 0x0020,  // 正矢
  RESTORED  = 0x0100,  // 復元波形
  PLAN_LINE = 0x0200,  // 計画線
  MOVEMENT  = 0x0400,  // 移動量
  CORRECTED = 0x0800,  // 補正済み
  ALS       = 0x1000   // ALS処理済み
}

/**
 * MTTファイルヘッダー
 */
export interface MTTHeader {
  signature: string;           // ファイル識別子 ('MTT')
  version: MTTVersion;         // ファイルバージョン
  dataType: number;            // データタイプ（ビットフラグ）
  railSide: 0 | 1;            // レール位置 (0:左, 1:右)
  dataCount: number;          // データ点数
  dataInterval: number;       // データ間隔 (m)
  startPosition: number;      // 開始位置 (m)
  measurementDate: Date;      // 測定日時
  vehicleType: string;        // 測定車両タイプ
  lineSection: string;        // 線区

  // 解釈済みフィールド
  dataTypeNames?: string[];   // データタイプ名のリスト
  railSideName?: 'left' | 'right';  // レール位置名
}

/**
 * MTTデータポイント
 */
export interface MTTDataPoint {
  index: number;              // インデックス
  position: number;           // 位置 (m)
  values: {
    level?: number;         // 高低狂い (mm)
    alignment?: number;     // 通り狂い (mm)
    gauge?: number;         // 軌間 (mm)
    cant?: number;          // カント (mm)
    twist?: number;         // 水準 (mm)
    versine?: number;       // 正矢 (mm)
  };
  quality?: number;           // 品質指標 (0-100)
}

/**
 * MTTファイルデータ
 */
export interface MTTFileData {
  header: MTTHeader;
  data: MTTDataPoint[];
  metadata?: MTTMetadata;
  statistics?: MTTStatistics;
}

/**
 * MTTメタデータ
 */
export interface MTTMetadata {
  fileType: 'MTT';
  version: number;
  createdAt: Date;
  vehicleType: string;
  lineSection: string;
  railSide: 'left' | 'right';
  dataTypes: string[];
  dataCount: number;
  dataInterval: number;
  totalLength: number;
  startPosition: number;
  endPosition: number;

  // 拡張メタデータ
  processingHistory?: ProcessingStep[];
  correlationInfo?: CorrelationInfo;
  alsInfo?: ALSInfo;
}

/**
 * 処理ステップ情報
 */
export interface ProcessingStep {
  type: 'restoration' | 'correction' | 'als' | 'plan' | 'movement';
  timestamp: Date;
  parameters: Record<string, any>;
  operator?: string;
  notes?: string;
}

/**
 * 相関情報
 */
export interface CorrelationInfo {
  referenceFile?: string;
  correlationCoefficient?: number;
  offset?: number;
  confidence?: number;
  handMeasurements?: {
    sectionId: string;
    position: number;
    correlation: number;
  }[];
}

/**
 * ALS処理情報
 */
export interface ALSInfo {
  baselineLength: number;      // 基準線長 (m)
  subtractedValue: number;     // 差し引き値 (mm)
  processingDate: Date;
  method: 'moving_average' | 'polynomial' | 'spline';
  parameters?: {
    degree?: number;          // 多項式次数
    windowSize?: number;      // 移動平均窓サイズ
    smoothingFactor?: number; // 平滑化係数
  };
}

/**
 * MTT統計情報
 */
export interface MTTStatistics {
  [dataType: string]: {
    count: number;
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    range: number;
    rms: number;
    percentiles?: {
      p25?: number;
      p50?: number;
      p75?: number;
      p95?: number;
      p99?: number;
    };
  };
}

/**
 * MTT書き込みオプション
 */
export interface MTTWriteOptions {
  dataType?: number;
  railSide?: 0 | 1;
  dataInterval?: number;
  startPosition?: number;
  vehicleType?: string;
  lineSection?: string;
  version?: MTTVersion;
  includeQuality?: boolean;
  compression?: boolean;
}

/**
 * MTT読み込みオプション
 */
export interface MTTReadOptions {
  validateChecksum?: boolean;
  loadMetadata?: boolean;
  loadStatistics?: boolean;
  filterDataTypes?: MTTDataType[];
  positionRange?: {
    start: number;
    end: number;
  };
}

/**
 * MTT変換オプション
 */
export interface MTTConvertOptions {
  format: 'csv' | 'json' | 'excel' | 'xml';
  includeHeader?: boolean;
  includeMetadata?: boolean;
  includeStatistics?: boolean;
  pretty?: boolean;
  encoding?: 'utf8' | 'shift-jis' | 'euc-jp';
  delimiter?: ',' | '\t' | ';';
  decimalPlaces?: number;
}

/**
 * MTTマージオプション
 */
export interface MTTMergeOptions {
  mergeStrategy: 'override' | 'average' | 'concat';
  alignByPosition?: boolean;
  interpolateMissing?: boolean;
  resampleInterval?: number;
}

/**
 * MTT検証結果
 */
export interface MTTValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  info: {
    fileSize: number;
    checksumValid?: boolean;
    dataIntegrity: boolean;
    headerValid: boolean;
    dataConsistent: boolean;
  };
}

/**
 * MTTファイルセット
 * 左右レールとその他関連ファイルのセット
 */
export interface MTTFileSet {
  leftRail?: MTTFileData;
  rightRail?: MTTFileData;
  gauge?: MTTFileData;
  cant?: MTTFileData;
  kilometer?: {
    positions: number[];
    kilometers: number[];
    wbSections?: Array<{
      start: number;
      end: number;
      type: string;
    }>;
  };
  curveElements?: Array<{
    start: number;
    end: number;
    radius: number;
    cant: number;
  }>;
  metadata?: {
    projectName?: string;
    measurementCampaign?: string;
    operator?: string;
    notes?: string;
  };
}

/**
 * MTT処理パイプライン
 */
export interface MTTProcessingPipeline {
  steps: Array<{
    id: string;
    type: 'filter' | 'transform' | 'aggregate' | 'export';
    enabled: boolean;
    parameters: Record<string, any>;
  }>;
  input: MTTFileData | MTTFileData[];
  output?: {
    format: 'mtt' | 'csv' | 'json';
    path: string;
  };
}

/**
 * MTTユーティリティ関数のインターフェース
 */
export interface MTTUtils {
  // ファイル操作
  read: (path: string, options?: MTTReadOptions) => Promise<MTTFileData>;
  write: (path: string, data: MTTFileData, options?: MTTWriteOptions) => Promise<void>;
  validate: (data: MTTFileData) => MTTValidationResult;

  // 変換
  toCSV: (data: MTTFileData, options?: MTTConvertOptions) => string;
  toJSON: (data: MTTFileData, options?: MTTConvertOptions) => string;
  fromCSV: (csv: string, header: Partial<MTTHeader>) => MTTFileData;
  fromJSON: (json: string) => MTTFileData;

  // データ操作
  merge: (files: MTTFileData[], options?: MTTMergeOptions) => MTTFileData;
  slice: (data: MTTFileData, start: number, end: number) => MTTFileData;
  filter: (data: MTTFileData, predicate: (point: MTTDataPoint) => boolean) => MTTFileData;
  transform: (data: MTTFileData, transformer: (point: MTTDataPoint) => MTTDataPoint) => MTTFileData;

  // 統計
  calculateStatistics: (data: MTTFileData) => MTTStatistics;
  compareFiles: (file1: MTTFileData, file2: MTTFileData) => {
    correlation: number;
    differences: Record<string, number>;
  };

  // ヘルパー
  getDataTypeNames: (flags: number) => string[];
  getDataTypeFlags: (names: string[]) => number;
  isDataTypeSet: (flags: number, type: MTTDataType) => boolean;
  setDataType: (flags: number, type: MTTDataType) => number;
  clearDataType: (flags: number, type: MTTDataType) => number;
}
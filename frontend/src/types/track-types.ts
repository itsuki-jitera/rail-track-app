/**
 * 軌道関連の型定義
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく定義
 * - レールの左右は作業方向を向いて左、右とする
 * - 通り狂いは軌道を上から見た位置関係
 * - 高低狂いは軌道を横から見た位置関係
 */

/**
 * 作業方向の定義
 * forward: 下り方向（キロ程が増加する方向）
 * backward: 上り方向（キロ程が減少する方向）
 */
export type WorkDirection = 'forward' | 'backward';

/**
 * レール位置の定義
 * 作業方向を向いて左右を判定
 */
export type RailSide = 'left' | 'right';

/**
 * データタイプの定義
 */
export type DataType = 'level' | 'alignment' | 'gauge' | 'cant' | 'twist';

/**
 * 基本的な測定データ点
 */
export interface MeasurementPoint {
  position: number;        // 位置 (m)
  kilometer?: number;      // キロ程 (km)
  timestamp?: Date;        // 測定時刻
  quality?: number;        // データ品質 (0-100)
}

/**
 * 軌道狂いデータ
 */
export interface IrregularityData extends MeasurementPoint {
  value: number;          // 狂い量 (mm)
  type: DataType;         // データタイプ
  railSide: RailSide;     // レール位置
}

/**
 * 左右レールの統合データ構造
 */
export interface RailData {
  // 左レールデータ
  left: {
    level: number[];          // 高低狂い (mm)
    alignment: number[];      // 通り狂い (mm)
    versine?: number[];       // 正矢 (mm)
    cant?: number[];          // カント (mm)
    gauge?: number[];         // 軌間 (mm)
  };

  // 右レールデータ
  right: {
    level: number[];          // 高低狂い (mm)
    alignment: number[];      // 通り狂い (mm)
    versine?: number[];       // 正矢 (mm)
    cant?: number[];          // カント (mm)
    gauge?: number[];         // 軌間 (mm)
  };

  // 共通データ
  positions: number[];        // 位置配列 (m)
  kilometers?: number[];     // キロ程配列 (km)
  workDirection: WorkDirection;  // 作業方向
  dataInterval: number;      // データ間隔 (m)

  // メタデータ
  metadata?: {
    measurementDate: Date;    // 測定日
    trainType: string;        // 測定車両タイプ（マヤ等）
    lineSection: string;      // 線区
    weather?: string;         // 天候
    temperature?: number;     // 気温
  };
}

/**
 * 復元波形データ
 */
export interface RestoredWaveformData extends RailData {
  // 復元パラメータ
  restorationParams: {
    lambdaLower: number;      // 復元波長下限 (m)
    lambdaUpper: number;      // 復元波長上限 (m)
    dataType: DataType;       // データタイプ
    method: string;           // 復元方法
  };

  // 統計情報
  statistics?: {
    mean: number;
    sigma: number;
    rms: number;
    min: number;
    max: number;
  };
}

/**
 * 計画線データ
 */
export interface PlanLineData {
  positions: number[];        // 位置配列 (m)

  // 左レール計画値
  leftTargets: {
    level: number[];          // 目標高低 (mm)
    alignment: number[];      // 目標通り (mm)
  };

  // 右レール計画値
  rightTargets: {
    level: number[];          // 目標高低 (mm)
    alignment: number[];      // 目標通り (mm)
  };

  // 制約条件
  constraints?: {
    fixedPoints: Array<{      // 固定点
      position: number;
      railSide: RailSide;
      mustKeep: boolean;
    }>;
    movementLimits: Array<{   // 移動量制限
      start: number;
      end: number;
      maxMovement: number;
    }>;
  };

  // 計画線タイプ
  planType: 'convex' | 'linear' | 'spline' | 'manual';

  // こう上優先設定
  upwardPriority?: {
    enabled: boolean;
    maxUpward: number;        // 最大上方向移動 (mm)
    maxDownward: number;      // 最大下方向移動 (mm)
  };
}

/**
 * 移動量データ
 */
export interface MovementAmountData {
  position: number;           // 位置 (m)
  railSide: RailSide;         // レール位置

  // 高低の移動量
  levelMovement: {
    current: number;          // 現在値 (mm)
    target: number;           // 目標値 (mm)
    amount: number;           // 移動量 (mm)
    direction: 'up' | 'down'; // 移動方向
    isConstrained: boolean;   // 制限超過
  };

  // 通りの移動量
  alignmentMovement: {
    current: number;          // 現在値 (mm)
    target: number;           // 目標値 (mm)
    amount: number;           // 移動量 (mm)
    direction: 'left' | 'right'; // 移動方向
    isConstrained: boolean;   // 制限超過
  };
}

/**
 * WB区間情報
 */
export interface WBSection {
  start: number;              // 開始位置 (m)
  end: number;                // 終了位置 (m)
  type: 'WB' | 'W';          // 区間タイプ
  description: string;        // 説明（橋梁、トンネル等）

  // キロ程情報
  startKilometer?: number;    // 開始キロ程 (km)
  endKilometer?: number;      // 終了キロ程 (km)
  originalKilometer?: number[]; // ラボックス元データのキロ程

  // 実延長
  actualLength?: number;      // 実際の長さ (m)

  // 制約
  restrictions?: {
    noDownwardMovement?: boolean;  // 下方向移動禁止
    maxMovement?: number;          // 最大移動量 (mm)
    fixedHeight?: boolean;         // 高さ固定
  };
}

/**
 * 曲線諸元データ
 */
export interface CurveElement {
  start: number;              // 開始位置 (m)
  end: number;                // 終了位置 (m)
  radius: number;             // 半径 (m)
  cant: number;               // カント (mm)

  // 緩和曲線情報
  transition?: {
    type: 'clothoid' | 'cubic' | 'sine';  // 緩和曲線タイプ
    length: number;           // 緩和曲線長 (m)
    startRadius?: number;     // 開始半径 (m)
    endRadius?: number;       // 終了半径 (m)
  };

  // 速度制限
  speedLimit?: number;        // 制限速度 (km/h)

  // 向き
  direction?: 'left' | 'right';  // 曲線方向
}

/**
 * 統合軌道データ
 * すべての軌道情報を含む総合的なデータ構造
 */
export interface IntegratedTrackData {
  // 基本情報
  workDirection: WorkDirection;
  dataInterval: number;
  totalLength: number;        // 全長 (m)

  // 測定データ
  measurementData: RailData;

  // 復元波形
  restoredWaveform?: RestoredWaveformData;

  // 計画線
  planLine?: PlanLineData;

  // 移動量
  movementAmounts?: MovementAmountData[];

  // 区間情報
  wbSections: WBSection[];
  curveElements: CurveElement[];

  // 手検測データ
  handMeasurements?: Array<{
    position: number;
    railSide: RailSide;
    level: number;
    alignment: number;
    measurementDate: Date;
  }>;

  // 処理履歴
  history?: Array<{
    action: string;
    timestamp: Date;
    parameters: any;
    result: any;
  }>;
}

/**
 * 表示設定
 */
export interface DisplaySettings {
  workDirection: WorkDirection;
  railSide: RailSide | 'both';
  dataType: DataType;

  // チャート設定
  chart: {
    showKilometer: boolean;   // キロ程表示
    highlightWB: boolean;     // WB区間強調
    showConstraints: boolean; // 制約表示
    showMovement: boolean;    // 移動量表示
  };

  // 視点設定
  viewpoint: {
    level: 'side';           // 横から見る（固定）
    alignment: 'top';        // 上から見る（固定）
  };

  // 色設定
  colors?: {
    leftRail?: string;
    rightRail?: string;
    planLine?: string;
    constraint?: string;
    wbSection?: string;
  };
}

/**
 * ユーティリティ関数の型定義
 */
export interface TrackDataUtils {
  // データ変換
  convertToRailData: (rawData: any[], options: any) => RailData;

  // 統計計算
  calculateStatistics: (data: number[]) => {
    mean: number;
    sigma: number;
    rms: number;
    min: number;
    max: number;
  };

  // 位置変換
  positionToKilometer: (position: number, wbSections: WBSection[]) => number;
  kilometerToPosition: (kilometer: number, wbSections: WBSection[]) => number;

  // データ検証
  validateTrackData: (data: IntegratedTrackData) => {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * エクスポート用インターフェース
 */
export interface ExportOptions {
  format: 'csv' | 'json' | 'mtt' | 'excel';
  includeMetadata: boolean;
  railSide: RailSide | 'both';
  dataTypes: DataType[];
  dateFormat?: string;
  encoding?: string;
}
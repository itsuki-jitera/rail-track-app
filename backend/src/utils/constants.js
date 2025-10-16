/**
 * 軌道復元システムの定数定義
 * VB6システムから移植した主要な定数
 */

// MTT値の基準値（VBシステムからの標準値）
export const MTT_STANDARD_VALUES = {
  leftRail: {
    BC: 3.63,  // Before Correction（補正前）
    CD: 9.37   // Corrected Data（補正後）
  },
  rightRail: {
    BC: 3.63,
    CD: 9.37
  }
};

// カント補正係数（モック値）
export const CANT_CORRECTION = {
  coefficient: 0.15,      // カント補正係数
  defaultValue: 0.0,      // デフォルトカント値
  maxValue: 200.0,        // 最大カント値 (mm)
  minValue: -200.0        // 最小カント値 (mm)
};

// スラック補正係数（モック値）
export const SLACK_CORRECTION = {
  coefficient: 0.08,      // スラック補正係数
  defaultValue: 0.0,      // デフォルトスラック値
  maxValue: 50.0,         // 最大スラック値 (mm)
  minValue: -50.0         // 最小スラック値 (mm)
};

// FFT処理のデフォルトパラメータ
export const FFT_PARAMS = {
  defaultSampleRate: 100,     // サンプリングレート (Hz)
  defaultCutoffFreq: 10,      // カットオフ周波数 (Hz)
  windowTypes: ['hamming', 'hann', 'blackman', 'rectangular']
};

// フィルタパラメータ
export const FILTER_PARAMS = {
  movingAverage: {
    points3: 3,   // 3点移動平均
    points5: 5,   // 5点移動平均
    points7: 7,   // 7点移動平均
    points9: 9    // 9点移動平均
  },
  weighted: {
    // 重み付き移動平均の重み（中心重視）
    weights5: [1, 2, 3, 2, 1],   // 5点
    weights7: [1, 2, 3, 4, 3, 2, 1]  // 7点
  }
};

// ピーク検出のデフォルトパラメータ
export const PEAK_DETECTION_PARAMS = {
  minPeakHeight: 5.0,          // 最小ピーク高さ (mm)
  minPeakDistance: 1.0,        // 最小ピーク間距離 (m)
  threshold: 0.5,              // 閾値 (標準偏差の倍数)
  windowSize: 10,              // ローリングウィンドウサイズ
  detectMaxima: true,          // 極大値を検出
  detectMinima: true           // 極小値を検出
};

// データ品質チェックの閾値
export const DATA_QUALITY = {
  maxIrregularity: 100.0,      // 最大軌道狂い量 (mm)
  minIrregularity: -100.0,     // 最小軌道狂い量 (mm)
  maxDistance: 100000.0,       // 最大距離 (m)
  minDataPoints: 10,           // 最小データ点数
  maxDataPoints: 1000000       // 最大データ点数
};

// 区間情報（モック）
export const SECTION_INFO = {
  sectionId: "区間001",
  lineName: "東海道本線",
  direction: "上り",
  startKilometer: "100.0",
  endKilometer: "110.0"
};

// レール種別
export const RAIL_TYPE = {
  LEFT: 'left',
  RIGHT: 'right',
  BOTH: 'both'
};

// データ形式タイプ
export const DATA_FORMAT = {
  CSV: 'csv',
  DCP: 'dcp',
  LABOCS: 'labocs',
  UNKNOWN: 'unknown'
};

// エラーメッセージ
export const ERROR_MESSAGES = {
  INVALID_DATA: 'データが不正です',
  INSUFFICIENT_DATA: 'データ点数が不足しています',
  OUT_OF_RANGE: '値が範囲外です',
  CALCULATION_ERROR: '計算中にエラーが発生しました',
  FFT_ERROR: 'FFT処理中にエラーが発生しました',
  PEAK_DETECTION_ERROR: 'ピーク検出中にエラーが発生しました',
  MTT_CALCULATION_ERROR: 'MTT値計算中にエラーが発生しました'
};

// 成功メッセージ
export const SUCCESS_MESSAGES = {
  FILTER_APPLIED: 'フィルタ処理が完了しました',
  PEAKS_DETECTED: 'ピーク検出が完了しました',
  MTT_CALCULATED: 'MTT値の計算が完了しました',
  DATA_EXPORTED: 'データのエクスポートが完了しました'
};

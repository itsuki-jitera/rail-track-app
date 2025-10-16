/**
 * MTT値計算ロジックの実装
 * VBシステムのMTT値計算を再実装
 */

import { MTT_STANDARD_VALUES } from '../utils/constants.js';
import { applyCantCorrection, applySlackCorrection } from './corrections.js';

/**
 * BC値（Before Correction: 補正前）を計算
 * @param {number} measuredValue - 測定値 (mm)
 * @param {number} bcCoefficient - BC補正係数（デフォルト: 3.63）
 * @param {number} offset - オフセット値（デフォルト: 0）
 * @returns {number} BC値
 */
export function calculateBC(measuredValue, bcCoefficient = 3.63, offset = 0) {
  return measuredValue * bcCoefficient + offset;
}

/**
 * CD値（Corrected Data: 補正後）を計算
 * @param {number} bcValue - BC値
 * @param {number} cantCorrection - カント補正値 (mm)
 * @param {number} slackCorrection - スラック補正値 (mm)
 * @param {number} cdCoefficient - CD補正係数（デフォルト: 9.37）
 * @returns {number} CD値
 */
export function calculateCD(bcValue, cantCorrection = 0, slackCorrection = 0, cdCoefficient = 9.37) {
  // CD値 = BC値 - カント補正 - スラック補正
  // 実際のVBシステムではさらに複雑な計算があるが、基本的な式として実装
  const baseCD = bcValue - cantCorrection - slackCorrection;

  // CD係数による調整（簡略版）
  return baseCD * (cdCoefficient / 10.0);
}

/**
 * 単一データポイントのMTT値を計算
 * @param {Object} point - データポイント {distance, irregularity, cant?, slack?}
 * @param {Object} params - 計算パラメータ
 * @returns {Object} MTT計算結果
 */
export function calculateMTTForPoint(point, params = {}) {
  const bcCoeff = params.bcCoefficient || MTT_STANDARD_VALUES.leftRail.BC;
  const cdCoeff = params.cdCoefficient || MTT_STANDARD_VALUES.leftRail.CD;
  const cantCoeff = params.cantCorrectionCoeff || 0.15;
  const slackCoeff = params.slackCorrectionCoeff || 0.08;

  // 測定値
  const measured = point.irregularity;

  // カント値とスラック値（データに含まれていれば使用、なければデフォルト0）
  const cant = point.cant || 0;
  const slack = point.slack || 0;

  // カント補正値とスラック補正値を計算
  const cantCorrection = cant * cantCoeff;
  const slackCorrection = slack * slackCoeff;

  // BC値を計算
  const bcValue = calculateBC(measured, bcCoeff, 0);

  // CD値を計算
  const cdValue = calculateCD(bcValue, cantCorrection, slackCorrection, cdCoeff);

  return {
    distance: point.distance,
    measured: parseFloat(measured.toFixed(3)),
    cant: parseFloat(cant.toFixed(3)),
    slack: parseFloat(slack.toFixed(3)),
    cantCorrection: parseFloat(cantCorrection.toFixed(3)),
    slackCorrection: parseFloat(slackCorrection.toFixed(3)),
    bcValue: parseFloat(bcValue.toFixed(3)),
    cdValue: parseFloat(cdValue.toFixed(3))
  };
}

/**
 * データセット全体のMTT値を計算
 * @param {Array} data - 軌道データ配列
 * @param {Object} params - 計算パラメータ
 * @returns {Object} MTT計算結果
 */
export function calculateMTTValues(data, params = {}) {
  if (!data || data.length === 0) {
    return {
      success: false,
      error: 'データが空です',
      results: []
    };
  }

  try {
    const results = data.map(point => calculateMTTForPoint(point, params));

    // 統計情報を計算
    const bcValues = results.map(r => r.bcValue);
    const cdValues = results.map(r => r.cdValue);

    const bcStats = {
      min: Math.min(...bcValues),
      max: Math.max(...bcValues),
      avg: bcValues.reduce((a, b) => a + b, 0) / bcValues.length,
      stdDev: Math.sqrt(bcValues.reduce((sum, val) =>
        sum + Math.pow(val - bcValues.reduce((a, b) => a + b, 0) / bcValues.length, 2), 0) / bcValues.length)
    };

    const cdStats = {
      min: Math.min(...cdValues),
      max: Math.max(...cdValues),
      avg: cdValues.reduce((a, b) => a + b, 0) / cdValues.length,
      stdDev: Math.sqrt(cdValues.reduce((sum, val) =>
        sum + Math.pow(val - cdValues.reduce((a, b) => a + b, 0) / cdValues.length, 2), 0) / cdValues.length)
    };

    return {
      success: true,
      results,
      statistics: {
        bc: {
          min: parseFloat(bcStats.min.toFixed(3)),
          max: parseFloat(bcStats.max.toFixed(3)),
          avg: parseFloat(bcStats.avg.toFixed(3)),
          stdDev: parseFloat(bcStats.stdDev.toFixed(3))
        },
        cd: {
          min: parseFloat(cdStats.min.toFixed(3)),
          max: parseFloat(cdStats.max.toFixed(3)),
          avg: parseFloat(cdStats.avg.toFixed(3)),
          stdDev: parseFloat(cdStats.stdDev.toFixed(3))
        }
      },
      parameters: {
        bcCoefficient: params.bcCoefficient || MTT_STANDARD_VALUES.leftRail.BC,
        cdCoefficient: params.cdCoefficient || MTT_STANDARD_VALUES.leftRail.CD,
        cantCorrectionCoeff: params.cantCorrectionCoeff || 0.15,
        slackCorrectionCoeff: params.slackCorrectionCoeff || 0.08
      },
      dataPoints: results.length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

/**
 * 左右レール別のMTT値を計算
 * @param {Object} data - {leftRail: [], rightRail: []} 形式のデータ
 * @param {Object} params - 計算パラメータ
 * @returns {Object} 左右レールのMTT計算結果
 */
export function calculateDualRailMTT(data, params = {}) {
  if (!data || !data.leftRail || !data.rightRail) {
    return {
      success: false,
      error: '左右レールのデータが必要です',
      leftRail: null,
      rightRail: null
    };
  }

  try {
    const leftParams = {
      bcCoefficient: params.leftBcCoeff || MTT_STANDARD_VALUES.leftRail.BC,
      cdCoefficient: params.leftCdCoeff || MTT_STANDARD_VALUES.leftRail.CD,
      cantCorrectionCoeff: params.cantCorrectionCoeff || 0.15,
      slackCorrectionCoeff: params.slackCorrectionCoeff || 0.08
    };

    const rightParams = {
      bcCoefficient: params.rightBcCoeff || MTT_STANDARD_VALUES.rightRail.BC,
      cdCoefficient: params.rightCdCoeff || MTT_STANDARD_VALUES.rightRail.CD,
      cantCorrectionCoeff: params.cantCorrectionCoeff || 0.15,
      slackCorrectionCoeff: params.slackCorrectionCoeff || 0.08
    };

    const leftResult = calculateMTTValues(data.leftRail, leftParams);
    const rightResult = calculateMTTValues(data.rightRail, rightParams);

    return {
      success: true,
      leftRail: leftResult,
      rightRail: rightResult,
      summary: {
        totalDataPoints: leftResult.dataPoints + rightResult.dataPoints,
        leftDataPoints: leftResult.dataPoints,
        rightDataPoints: rightResult.dataPoints
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      leftRail: null,
      rightRail: null
    };
  }
}

/**
 * MTT値の判定（基準値との比較）
 * @param {Object} mttResult - MTT計算結果
 * @param {Object} thresholds - 判定閾値
 * @returns {Object} 判定結果
 */
export function evaluateMTT(mttResult, thresholds = {}) {
  if (!mttResult || !mttResult.success) {
    return {
      success: false,
      error: 'MTT計算結果が不正です'
    };
  }

  const bcThreshold = thresholds.bcThreshold || 15.0;  // BC値の警告閾値 (mm)
  const cdThreshold = thresholds.cdThreshold || 30.0;  // CD値の警告閾値 (mm)

  const bcWarnings = [];
  const cdWarnings = [];

  mttResult.results.forEach((point, index) => {
    if (Math.abs(point.bcValue) > bcThreshold) {
      bcWarnings.push({
        index,
        distance: point.distance,
        bcValue: point.bcValue,
        severity: Math.abs(point.bcValue) > bcThreshold * 1.5 ? 'high' : 'medium'
      });
    }

    if (Math.abs(point.cdValue) > cdThreshold) {
      cdWarnings.push({
        index,
        distance: point.distance,
        cdValue: point.cdValue,
        severity: Math.abs(point.cdValue) > cdThreshold * 1.5 ? 'high' : 'medium'
      });
    }
  });

  return {
    success: true,
    bcWarnings: {
      count: bcWarnings.length,
      warnings: bcWarnings
    },
    cdWarnings: {
      count: cdWarnings.length,
      warnings: cdWarnings
    },
    summary: {
      totalWarnings: bcWarnings.length + cdWarnings.length,
      highSeverityCount: [...bcWarnings, ...cdWarnings].filter(w => w.severity === 'high').length,
      evaluation: bcWarnings.length === 0 && cdWarnings.length === 0 ? '良好' : '要注意'
    }
  };
}

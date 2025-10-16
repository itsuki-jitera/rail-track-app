/**
 * カント補正・スラック補正処理の実装
 * VBシステムの補正ロジックを再実装
 */

import { CANT_CORRECTION, SLACK_CORRECTION } from '../utils/constants.js';

/**
 * カント補正を適用
 * @param {number} measuredValue - 測定値 (mm)
 * @param {number} cantValue - カント値 (mm)
 * @param {number} coefficient - カント補正係数（デフォルト: 0.15）
 * @returns {number} 補正後の値
 */
export function applyCantCorrection(measuredValue, cantValue, coefficient = CANT_CORRECTION.coefficient) {
  const correction = cantValue * coefficient;
  return measuredValue - correction;
}

/**
 * スラック補正を適用
 * @param {number} measuredValue - 測定値 (mm)
 * @param {number} slackValue - スラック値 (mm)
 * @param {number} coefficient - スラック補正係数（デフォルト: 0.08）
 * @returns {number} 補正後の値
 */
export function applySlackCorrection(measuredValue, slackValue, coefficient = SLACK_CORRECTION.coefficient) {
  const correction = slackValue * coefficient;
  return measuredValue - correction;
}

/**
 * カントとスラックの両方の補正を適用
 * @param {number} measuredValue - 測定値 (mm)
 * @param {number} cantValue - カント値 (mm)
 * @param {number} slackValue - スラック値 (mm)
 * @param {Object} coefficients - 補正係数 {cant, slack}
 * @returns {Object} 補正結果
 */
export function applyBothCorrections(measuredValue, cantValue, slackValue, coefficients = {}) {
  const cantCoeff = coefficients.cant || CANT_CORRECTION.coefficient;
  const slackCoeff = coefficients.slack || SLACK_CORRECTION.coefficient;

  const cantCorrection = cantValue * cantCoeff;
  const slackCorrection = slackValue * slackCoeff;
  const correctedValue = measuredValue - cantCorrection - slackCorrection;

  return {
    original: measuredValue,
    cantCorrection,
    slackCorrection,
    totalCorrection: cantCorrection + slackCorrection,
    corrected: parseFloat(correctedValue.toFixed(3))
  };
}

/**
 * データセット全体にカント補正を適用
 * @param {Array} data - 軌道データ配列 [{distance, irregularity, cant}, ...]
 * @param {number} coefficient - カント補正係数
 * @returns {Array} 補正後のデータ
 */
export function applyCantCorrectionToDataset(data, coefficient = CANT_CORRECTION.coefficient) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  return data.map(point => {
    const cantValue = point.cant || 0;
    const corrected = applyCantCorrection(point.irregularity, cantValue, coefficient);

    return {
      distance: point.distance,
      irregularity: parseFloat(corrected.toFixed(3)),
      originalIrregularity: point.irregularity,
      cant: cantValue,
      cantCorrection: parseFloat((cantValue * coefficient).toFixed(3))
    };
  });
}

/**
 * データセット全体にスラック補正を適用
 * @param {Array} data - 軌道データ配列 [{distance, irregularity, slack}, ...]
 * @param {number} coefficient - スラック補正係数
 * @returns {Array} 補正後のデータ
 */
export function applySlackCorrectionToDataset(data, coefficient = SLACK_CORRECTION.coefficient) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  return data.map(point => {
    const slackValue = point.slack || 0;
    const corrected = applySlackCorrection(point.irregularity, slackValue, coefficient);

    return {
      distance: point.distance,
      irregularity: parseFloat(corrected.toFixed(3)),
      originalIrregularity: point.irregularity,
      slack: slackValue,
      slackCorrection: parseFloat((slackValue * coefficient).toFixed(3))
    };
  });
}

/**
 * データセット全体にカント・スラック両方の補正を適用
 * @param {Array} data - 軌道データ配列 [{distance, irregularity, cant, slack}, ...]
 * @param {Object} coefficients - 補正係数 {cant, slack}
 * @returns {Object} 補正結果
 */
export function applyAllCorrectionsToDataset(data, coefficients = {}) {
  if (!data || data.length === 0) {
    return {
      success: false,
      error: 'データが空です',
      corrected: []
    };
  }

  try {
    const cantCoeff = coefficients.cant || CANT_CORRECTION.coefficient;
    const slackCoeff = coefficients.slack || SLACK_CORRECTION.coefficient;

    const correctedData = data.map(point => {
      const cantValue = point.cant || 0;
      const slackValue = point.slack || 0;

      const result = applyBothCorrections(
        point.irregularity,
        cantValue,
        slackValue,
        { cant: cantCoeff, slack: slackCoeff }
      );

      return {
        distance: point.distance,
        ...result
      };
    });

    // 補正後の統計を計算
    const correctedValues = correctedData.map(d => d.corrected);
    const avg = correctedValues.reduce((a, b) => a + b, 0) / correctedValues.length;
    const variance = correctedValues.reduce((sum, val) =>
      sum + Math.pow(val - avg, 2), 0) / correctedValues.length;

    const statistics = {
      min: Math.min(...correctedValues),
      max: Math.max(...correctedValues),
      avg: parseFloat(avg.toFixed(3)),
      stdDev: parseFloat(Math.sqrt(variance).toFixed(3))
    };

    return {
      success: true,
      data: correctedData,
      statistics,
      coefficients: {
        cant: cantCoeff,
        slack: slackCoeff
      },
      dataPoints: correctedData.length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      corrected: []
    };
  }
}

/**
 * カント値を推定（モック実装）
 * 実際のVBシステムでは複雑な計算があるが、簡易版として実装
 * @param {number} distance - 距離 (m)
 * @param {Object} sectionInfo - 区間情報
 * @returns {number} 推定カント値 (mm)
 */
export function estimateCant(distance, sectionInfo = {}) {
  const baseCant = sectionInfo.baseCant || 50.0;
  const curvatureRadius = sectionInfo.curvatureRadius || 800.0;

  // 簡易的な計算式（実際はもっと複雑）
  // カント = 基準カント + 曲線による変動
  const variation = Math.sin(distance / curvatureRadius * Math.PI) * 30.0;

  return parseFloat((baseCant + variation).toFixed(2));
}

/**
 * スラック値を推定（モック実装）
 * @param {number} distance - 距離 (m)
 * @param {Object} sectionInfo - 区間情報
 * @returns {number} 推定スラック値 (mm)
 */
export function estimateSlack(distance, sectionInfo = {}) {
  const baseSlack = sectionInfo.baseSlack || 10.0;
  const variation = Math.cos(distance / 100.0 * Math.PI) * 3.0;

  return parseFloat((baseSlack + variation).toFixed(2));
}

/**
 * カント・スラック値を含むデータセットを生成（モック）
 * @param {Array} data - 基本軌道データ配列
 * @param {Object} sectionInfo - 区間情報
 * @returns {Array} カント・スラック付きデータ
 */
export function addCantSlackToDataset(data, sectionInfo = {}) {
  if (!data || data.length === 0) {
    return [];
  }

  return data.map(point => ({
    ...point,
    cant: estimateCant(point.distance, sectionInfo),
    slack: estimateSlack(point.distance, sectionInfo)
  }));
}

/**
 * 補正係数の妥当性をチェック
 * @param {number} coefficient - 補正係数
 * @param {string} type - 補正タイプ ('cant' or 'slack')
 * @returns {Object} チェック結果
 */
export function validateCorrectionCoefficient(coefficient, type = 'cant') {
  const limits = type === 'cant' ?
    { min: 0.0, max: 1.0, recommended: 0.15 } :
    { min: 0.0, max: 0.5, recommended: 0.08 };

  const isValid = coefficient >= limits.min && coefficient <= limits.max;
  const isRecommended = Math.abs(coefficient - limits.recommended) < 0.05;

  return {
    isValid,
    isRecommended,
    coefficient,
    type,
    message: isValid ?
      (isRecommended ? '推奨値です' : '有効な範囲内ですが、推奨値から外れています') :
      `範囲外です（${limits.min} - ${limits.max}）`,
    limits
  };
}

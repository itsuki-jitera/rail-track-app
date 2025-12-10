/**
 * MTT移動量補正計算エンジン
 * PDFドキュメント P9-11の仕様に基づく実装
 */

const MTTConfiguration = require('../config/mtt-config');

class MovementCorrectionCalculator {
  constructor(options = {}) {
    this.mttType = options.mttType || '08-16';
    this.mttConfig = MTTConfiguration.getConfig(this.mttType);
    this.workDirection = options.workDirection || 'forward';
    this.correctionEnabled = {
      leveling: options.levelingCorrection || false,
      lining: options.liningCorrection || false
    };
  }

  /**
   * 高低の計画線が凸となる箇所での移動量補正
   * PDFドキュメント P9 図1に基づく実装
   * @param {Array} movements - 移動量データ配列
   * @param {Array} planLine - 計画線データ配列
   * @returns {Array} 補正後の移動量
   */
  correctForConvexPlan(movements, planLine) {
    if (!this.correctionEnabled.leveling) {
      return movements;
    }

    const corrected = [...movements];
    const bcLength = this.mttConfig.leveling.bcLength;
    const cdLength = this.mttConfig.leveling.cdLength;

    for (let i = 0; i < corrected.length; i++) {
      // C点でのミドル位置を基準に計算
      const cPosition = i;
      const bPosition = Math.max(0, i - Math.round(bcLength));
      const dPosition = Math.min(corrected.length - 1, i + Math.round(cdLength));

      // 計画線の傾きを確認
      if (this.isPlanLineConvex(planLine, bPosition, cPosition, dPosition)) {
        // フロント誘導量の補正を計算
        const correction = this.calculateConvexCorrection(
          planLine[bPosition],
          planLine[cPosition],
          planLine[dPosition],
          bcLength,
          cdLength
        );

        corrected[i].levelingCorrection = correction;
        corrected[i].correctedLeveling = movements[i].leveling + correction;
      }
    }

    return corrected;
  }

  /**
   * 計画線が凸かどうかを判定
   */
  isPlanLineConvex(planLine, bPos, cPos, dPos) {
    if (!planLine[bPos] || !planLine[cPos] || !planLine[dPos]) {
      return false;
    }

    // B-C間とC-D間の傾きを比較
    const slopeBC = (planLine[cPos].value - planLine[bPos].value) /
                     (cPos - bPos);
    const slopeCD = (planLine[dPos].value - planLine[cPos].value) /
                     (dPos - cPos);

    // 傾きが減少していれば凸
    return slopeBC > slopeCD;
  }

  /**
   * 凸部分の補正量を計算
   */
  calculateConvexCorrection(bValue, cValue, dValue, bcLength, cdLength) {
    // MTTのフロントを適切な位置に誘導するための補正量
    // 計画線の曲率に基づいて計算
    const curvature = this.calculateCurvature(bValue, cValue, dValue, bcLength, cdLength);
    const correction = curvature * cdLength * 0.5; // 補正係数

    return correction;
  }

  /**
   * 曲率を計算
   */
  calculateCurvature(bValue, cValue, dValue, bcLength, cdLength) {
    // 3点から曲率を計算
    const totalLength = bcLength + cdLength;
    const h1 = cValue - bValue;
    const h2 = dValue - cValue;
    const curvature = 2 * (h2 / cdLength - h1 / bcLength) / totalLength;

    return curvature;
  }

  /**
   * 不動点からMTT施工を開始する場合の通り移動量補正
   * PDFドキュメント P9 図2に基づく実装
   * @param {Array} movements - 移動量データ
   * @param {Array} fixedPoints - 不動点情報
   * @returns {Array} 補正後の移動量
   */
  correctForFixedPointStart(movements, fixedPoints) {
    if (!this.correctionEnabled.lining || !fixedPoints || fixedPoints.length === 0) {
      return movements;
    }

    const corrected = [...movements];
    const bcLength = this.mttConfig.lining.bcLength;
    const cdLength = this.mttConfig.lining.cdLength;

    for (const fixedPoint of fixedPoints) {
      const startPos = fixedPoint.start;
      const endPos = fixedPoint.end;

      // 不動点から施工開始する場合
      if (fixedPoint.type === 'start') {
        for (let i = startPos; i < Math.min(startPos + cdLength, corrected.length); i++) {
          const distance = i - startPos;
          if (distance < cdLength) {
            // リアが不動点にある場合の補正
            const correction = this.calculateStartPointCorrection(
              distance,
              cdLength,
              fixedPoint.lateralOffset || 0
            );
            corrected[i].liningCorrection = correction;
            corrected[i].correctedLining = (movements[i].lining || 0) + correction;
          }
        }
      }

      // 不動点で施工終了する場合
      if (fixedPoint.type === 'end') {
        for (let i = Math.max(endPos - cdLength, 0); i < endPos; i++) {
          const distance = endPos - i;
          if (distance < cdLength) {
            // フロントが不動点に近づく場合の補正
            const correction = this.calculateEndPointCorrection(
              distance,
              cdLength,
              fixedPoint.lateralOffset || 0
            );
            corrected[i].liningCorrection = correction;
            corrected[i].correctedLining = (movements[i].lining || 0) + correction;
          }
        }
      }
    }

    return corrected;
  }

  /**
   * 施工開始点での補正量計算
   */
  calculateStartPointCorrection(distance, cdLength, lateralOffset) {
    // 不動点からの距離に応じた補正量
    const ratio = distance / cdLength;
    const correction = lateralOffset * (1 - ratio);
    return correction;
  }

  /**
   * 施工終了点での補正量計算
   */
  calculateEndPointCorrection(distance, cdLength, lateralOffset) {
    // 不動点への距離に応じた補正量
    const ratio = distance / cdLength;
    const correction = -lateralOffset * (1 - ratio);
    return correction;
  }

  /**
   * 統合補正処理
   * @param {Array} movements - 元の移動量データ
   * @param {Object} correctionParams - 補正パラメータ
   * @returns {Array} 全補正適用後の移動量
   */
  applyAllCorrections(movements, correctionParams = {}) {
    let corrected = [...movements];

    // 1. 高低の凸部補正
    if (correctionParams.planLine) {
      corrected = this.correctForConvexPlan(corrected, correctionParams.planLine);
    }

    // 2. 不動点補正
    if (correctionParams.fixedPoints) {
      corrected = this.correctForFixedPointStart(corrected, correctionParams.fixedPoints);
    }

    // 3. MTT機種別の補正係数適用
    corrected = this.applyMTTSpecificCorrections(corrected);

    return corrected;
  }

  /**
   * MTT機種別の補正係数を適用
   */
  applyMTTSpecificCorrections(movements) {
    const corrected = movements.map(movement => {
      const correctedMovement = { ...movement };

      // レベリング補正
      if (this.correctionEnabled.leveling && movement.leveling !== undefined) {
        const levelingFactor = this.getLevelingCorrectionFactor();
        correctedMovement.leveling = movement.leveling * levelingFactor;
      }

      // ライニング補正
      if (this.correctionEnabled.lining && movement.lining !== undefined) {
        const liningFactor = this.getLiningCorrectionFactor();
        correctedMovement.lining = movement.lining * liningFactor;
      }

      return correctedMovement;
    });

    return corrected;
  }

  /**
   * レベリング補正係数を取得
   */
  getLevelingCorrectionFactor() {
    // MTT機種に応じた補正係数
    const factors = {
      '08-16': 1.0,
      '09-16在': 1.05,
      '08-32幹': 0.98,
      '08-475': 1.0,
      '08-1X': 1.02,
      '08-2X': 1.01,
      '08-275': 1.0
    };
    return factors[this.mttType] || 1.0;
  }

  /**
   * ライニング補正係数を取得
   */
  getLiningCorrectionFactor() {
    // MTT機種に応じた補正係数
    const factors = {
      '08-16': 1.0,
      '09-16在': 1.0,
      '08-32幹': 0.99,
      '08-475': 1.0,
      '08-1X': 1.01,
      '08-2X': 1.0,
      '08-275': 1.0
    };
    return factors[this.mttType] || 1.0;
  }
}

module.exports = MovementCorrectionCalculator;
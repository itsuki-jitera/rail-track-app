/**
 * 移動量計算機能 (Movement Calculator)
 *
 * 復元波形と計画線から移動量を計算し、
 * 整正後予測波形およびσ値・良化率を算出
 */

const RestorationFilter = require('./restoration-filter');

class MovementCalculator {
  /**
   * 移動量計算
   * 移動量 = 計画線 - 復元波形
   *
   * @param {number[]} restoredWaveform - 復元波形
   * @param {number[]} planLine - 計画線
   * @returns {object} { movement, predictedWaveform, statistics, improvementRate }
   */
  static calculateMovement(restoredWaveform, planLine) {
    if (restoredWaveform.length !== planLine.length) {
      throw new Error('復元波形と計画線のデータ点数が一致しません');
    }

    const n = restoredWaveform.length;
    const movement = new Array(n);

    // 移動量 = 計画線 - 復元波形
    for (let i = 0; i < n; i++) {
      movement[i] = planLine[i] - restoredWaveform[i];
    }

    // 整正後予測波形 = 復元波形 + 移動量 = 計画線
    const predictedWaveform = new Array(n);
    for (let i = 0; i < n; i++) {
      predictedWaveform[i] = restoredWaveform[i] + movement[i];
    }

    // 統計情報
    const statsRestored = RestorationFilter.calculateStatistics(restoredWaveform);
    const statsPredicted = RestorationFilter.calculateStatistics(predictedWaveform);
    const statsMovement = RestorationFilter.calculateStatistics(movement);

    // 良化率の計算
    const improvementRate = this.calculateImprovementRate(
      statsRestored.sigma,
      statsPredicted.sigma
    );

    return {
      success: true,
      movement,
      predictedWaveform,
      statistics: {
        restored: statsRestored,
        predicted: statsPredicted,
        movement: statsMovement
      },
      improvementRate
    };
  }

  /**
   * 良化率の計算
   * 良化率 (%) = (整正前σ値 - 整正後σ値) / 整正前σ値 × 100
   *
   * @param {number} sigmaBefore - 整正前σ値
   * @param {number} sigmaAfter - 整正後σ値
   * @returns {number} 良化率 (%)
   */
  static calculateImprovementRate(sigmaBefore, sigmaAfter) {
    if (sigmaBefore === 0) return 0;
    return ((sigmaBefore - sigmaAfter) / sigmaBefore) * 100;
  }

  /**
   * 移動量制限チェック
   * @param {number[]} movement - 移動量データ
   * @param {object} restrictions - 制限値 { standard: 標準値, maximum: 最大値 }
   * @returns {object} 制限超過箇所のリスト
   */
  static checkMovementRestrictions(movement, restrictions) {
    const { standard = 30, maximum = 50 } = restrictions; // デフォルト単位: mm

    const violations = {
      standardExceeded: [],
      maximumExceeded: [],
      totalCount: movement.length,
      violationCount: 0
    };

    for (let i = 0; i < movement.length; i++) {
      const absMovement = Math.abs(movement[i]);

      if (absMovement > maximum) {
        violations.maximumExceeded.push({
          index: i,
          value: movement[i],
          absValue: absMovement,
          exceededBy: absMovement - maximum
        });
        violations.violationCount++;
      } else if (absMovement > standard) {
        violations.standardExceeded.push({
          index: i,
          value: movement[i],
          absValue: absMovement,
          exceededBy: absMovement - standard
        });
        violations.violationCount++;
      }
    }

    return violations;
  }

  /**
   * 累積移動量の計算
   * @param {number[]} movement - 移動量データ
   * @returns {number[]} 累積移動量
   */
  static calculateCumulativeMovement(movement) {
    const cumulative = new Array(movement.length);
    cumulative[0] = movement[0];

    for (let i = 1; i < movement.length; i++) {
      cumulative[i] = cumulative[i - 1] + movement[i];
    }

    return cumulative;
  }

  /**
   * P値 (ピーク値) の抽出
   * @param {number[]} data - データ
   * @param {number} windowSize - ピーク検出のウィンドウサイズ (デフォルト: 10点)
   * @returns {object} { pValue, peaks }
   */
  static extractPeakValues(data, windowSize = 10) {
    const peaks = [];
    const n = data.length;

    for (let i = windowSize; i < n - windowSize; i++) {
      let isLocalMax = true;
      const currentValue = Math.abs(data[i]);

      // 前後windowSize点を確認
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i && Math.abs(data[j]) > currentValue) {
          isLocalMax = false;
          break;
        }
      }

      if (isLocalMax && currentValue > 0) {
        peaks.push({
          index: i,
          value: data[i],
          absValue: currentValue
        });
      }
    }

    // ピーク値でソート
    peaks.sort((a, b) => b.absValue - a.absValue);

    // 最大ピーク値 (P値)
    const pValue = peaks.length > 0 ? peaks[0].absValue : 0;

    return {
      pValue,
      peaks: peaks.slice(0, 10) // 上位10個のピーク
    };
  }

  /**
   * 移動量の平滑化 (スムージング)
   * @param {number[]} movement - 移動量データ
   * @param {number} windowSize - 移動平均のウィンドウサイズ
   * @returns {number[]} 平滑化された移動量
   */
  static smoothMovement(movement, windowSize = 5) {
    const n = movement.length;
    const smoothed = new Array(n);
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - halfWindow); j <= Math.min(n - 1, i + halfWindow); j++) {
        sum += movement[j];
        count++;
      }

      smoothed[i] = sum / count;
    }

    return smoothed;
  }

  /**
   * 作業区間の分割
   * @param {number[]} movement - 移動量データ
   * @param {number} maxMovement - 1作業区間あたりの最大移動量 (mm)
   * @returns {object[]} 作業区間のリスト
   */
  static splitWorkSections(movement, maxMovement = 50) {
    const sections = [];
    let currentSection = {
      startIndex: 0,
      endIndex: 0,
      maxMovement: 0,
      avgMovement: 0
    };

    for (let i = 0; i < movement.length; i++) {
      const absMovement = Math.abs(movement[i]);

      if (absMovement > maxMovement) {
        // 現在の区間を確定
        if (currentSection.startIndex !== i) {
          currentSection.endIndex = i - 1;
          currentSection.avgMovement = this.calculateAverage(
            movement.slice(currentSection.startIndex, i)
          );
          sections.push({ ...currentSection });
        }

        // 新しい区間を開始
        currentSection = {
          startIndex: i,
          endIndex: i,
          maxMovement: absMovement,
          avgMovement: 0
        };
      } else {
        currentSection.endIndex = i;
        currentSection.maxMovement = Math.max(currentSection.maxMovement, absMovement);
      }
    }

    // 最後の区間を追加
    if (currentSection.startIndex <= currentSection.endIndex) {
      currentSection.avgMovement = this.calculateAverage(
        movement.slice(currentSection.startIndex, currentSection.endIndex + 1)
      );
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * 平均値計算のヘルパー関数
   * @param {number[]} data - データ
   * @returns {number} 平均値
   */
  static calculateAverage(data) {
    if (data.length === 0) return 0;
    return data.reduce((sum, val) => sum + Math.abs(val), 0) / data.length;
  }

  /**
   * 移動量データのエクスポート用フォーマット
   * @param {number[]} movement - 移動量データ
   * @param {number[]} kilometerPoints - キロ程データ
   * @param {object} options - オプション { dataInterval, startKP }
   * @returns {object[]} フォーマット済みデータ
   */
  static formatMovementData(movement, kilometerPoints = null, options = {}) {
    const { dataInterval = 1.0, startKP = 0.0 } = options;
    const formatted = [];

    for (let i = 0; i < movement.length; i++) {
      const kp = kilometerPoints ? kilometerPoints[i] : startKP + i * dataInterval;

      formatted.push({
        index: i,
        kilometerPoint: kp.toFixed(3),
        movement: movement[i].toFixed(1), // 0.1mm単位
        absMovement: Math.abs(movement[i]).toFixed(1)
      });
    }

    return formatted;
  }
}

module.exports = MovementCalculator;

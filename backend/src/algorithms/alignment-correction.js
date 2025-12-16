/**
 * 通り狂い補正アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - マヤ車の通り狂いの正矢は曲線諸元から計算した正矢よりも小さめになる傾向
 * - 補正率をかけて割増すことができる（通常1.0）
 * - 通り狂いの復元波形は、通り狂いから曲線諸元の台形を差し引いて計算
 */

class AlignmentCorrection {
  /**
   * 通り狂いデータの補正
   *
   * @param {Array} alignmentData - 通り狂いデータ [{ position, versine }]
   * @param {number} correctionRate - 補正率（デフォルト1.0）
   * @param {Object} options - オプション設定
   * @returns {Object} 補正済みデータと統計情報
   */
  static applyCorrectionRate(alignmentData, correctionRate = 1.0, options = {}) {
    const {
      measurementType = 'maya',  // 'maya' | 'laser' | 'other'
      chordLength = 10,          // 正矢測定の弦長 (m)
      verbose = true
    } = options;

    if (verbose) {
      console.log('通り狂い補正処理開始');
      console.log(`測定タイプ: ${measurementType}`);
      console.log(`補正率: ${correctionRate}`);
      console.log(`弦長: ${chordLength}m`);
      console.log(`データ点数: ${alignmentData.length}`);
    }

    // 入力データの検証
    if (!alignmentData || alignmentData.length === 0) {
      throw new Error('通り狂いデータが空です');
    }

    // 補正処理
    const correctedData = alignmentData.map(point => {
      const originalVersine = point.versine || point.alignment || 0;

      // マヤ車特有の補正
      let correctedVersine = originalVersine;
      if (measurementType === 'maya') {
        // マヤ車の測定値は実際より小さめになる傾向があるため補正
        correctedVersine = originalVersine * correctionRate;
      }

      return {
        ...point,
        originalVersine,
        versine: correctedVersine,
        correctionApplied: correctionRate !== 1.0
      };
    });

    // 統計情報の計算
    const statistics = this.calculateStatistics(alignmentData, correctedData);

    if (verbose) {
      console.log('補正前平均:', statistics.originalMean.toFixed(3), 'mm');
      console.log('補正後平均:', statistics.correctedMean.toFixed(3), 'mm');
      console.log('補正による変化率:', statistics.changeRatio.toFixed(1), '%');
    }

    return {
      data: correctedData,
      statistics,
      correctionRate,
      measurementType
    };
  }

  /**
   * 曲線諸元の台形差引
   * 通り狂いから曲線諸元による理論正矢を差し引く
   *
   * @param {Array} alignmentData - 通り狂いデータ
   * @param {Array} curveElements - 曲線諸元 [{ start, end, radius, cant, transition }]
   * @param {Object} options - オプション
   * @returns {Object} 台形差引後のデータ
   */
  static subtractCurveTrapezoid(alignmentData, curveElements, options = {}) {
    const {
      chordLength = 10,      // 弦長 (m)
      dataInterval = 0.25,   // データ間隔 (m)
      verbose = true
    } = options;

    if (verbose) {
      console.log('曲線諸元の台形差引処理開始');
      console.log(`曲線区間数: ${curveElements.length}`);
    }

    // 理論正矢の計算
    const theoreticalVersine = this.calculateTheoreticalVersine(
      alignmentData,
      curveElements,
      chordLength,
      dataInterval
    );

    // 差引処理
    const processedData = alignmentData.map((point, index) => {
      const theoretical = theoreticalVersine[index] || 0;
      const measured = point.versine || point.alignment || 0;
      const residual = measured - theoretical;

      return {
        ...point,
        theoreticalVersine: theoretical,
        measuredVersine: measured,
        residualVersine: residual,
        inCurve: theoretical !== 0
      };
    });

    // 統計情報
    const statistics = this.calculateTrapezoidStatistics(processedData);

    if (verbose) {
      console.log('理論正矢最大値:', statistics.maxTheoretical.toFixed(3), 'mm');
      console.log('残差標準偏差:', statistics.residualStdDev.toFixed(3), 'mm');
      console.log('曲線区間割合:', statistics.curveRatio.toFixed(1), '%');
    }

    return {
      data: processedData,
      statistics,
      curveElements
    };
  }

  /**
   * 理論正矢の計算
   * 曲線半径から正矢を計算
   *
   * @param {Array} dataPoints - データ点
   * @param {Array} curveElements - 曲線諸元
   * @param {number} chordLength - 弦長
   * @param {number} dataInterval - データ間隔
   * @returns {Array} 理論正矢配列
   */
  static calculateTheoreticalVersine(dataPoints, curveElements, chordLength, dataInterval) {
    const versineArray = new Array(dataPoints.length).fill(0);

    for (let i = 0; i < dataPoints.length; i++) {
      const position = dataPoints[i].position || (i * dataInterval);

      // 該当する曲線区間を検索
      const curve = curveElements.find(c =>
        position >= c.start && position <= c.end
      );

      if (curve) {
        if (curve.transition) {
          // 緩和曲線区間
          versineArray[i] = this.calculateTransitionVersine(
            position,
            curve,
            chordLength
          );
        } else if (curve.radius) {
          // 円曲線区間
          // 正矢 = (弦長^2) / (8 * 半径)
          versineArray[i] = (chordLength * chordLength * 1000) / (8 * curve.radius);
        }
      }
    }

    return versineArray;
  }

  /**
   * 緩和曲線区間の正矢計算
   * クロソイド曲線を想定
   *
   * @param {number} position - 現在位置
   * @param {Object} curve - 曲線諸元
   * @param {number} chordLength - 弦長
   * @returns {number} 正矢値
   */
  static calculateTransitionVersine(position, curve, chordLength) {
    const transitionLength = curve.transitionLength || 0;
    if (transitionLength === 0) return 0;

    // 緩和曲線内の相対位置
    const relativePos = position - curve.start;
    const progress = relativePos / transitionLength;

    // クロソイド曲線の場合、曲率は距離に比例
    const maxVersine = (chordLength * chordLength * 1000) / (8 * curve.radius);

    // 3次放物線による近似
    return maxVersine * progress * progress * (3 - 2 * progress);
  }

  /**
   * 補正統計の計算
   */
  static calculateStatistics(originalData, correctedData) {
    const originalValues = originalData.map(d => d.versine || d.alignment || 0);
    const correctedValues = correctedData.map(d => d.versine || 0);

    const originalMean = originalValues.reduce((a, b) => a + b, 0) / originalValues.length;
    const correctedMean = correctedValues.reduce((a, b) => a + b, 0) / correctedValues.length;

    const originalStdDev = Math.sqrt(
      originalValues.reduce((sum, val) => sum + (val - originalMean) ** 2, 0) / originalValues.length
    );
    const correctedStdDev = Math.sqrt(
      correctedValues.reduce((sum, val) => sum + (val - correctedMean) ** 2, 0) / correctedValues.length
    );

    return {
      originalMean,
      correctedMean,
      originalStdDev,
      correctedStdDev,
      changeRatio: ((correctedMean - originalMean) / Math.abs(originalMean)) * 100,
      dataPoints: originalData.length
    };
  }

  /**
   * 台形差引統計の計算
   */
  static calculateTrapezoidStatistics(processedData) {
    const theoretical = processedData.map(d => d.theoreticalVersine || 0);
    const residual = processedData.map(d => d.residualVersine || 0);
    const inCurve = processedData.filter(d => d.inCurve).length;

    const residualMean = residual.reduce((a, b) => a + b, 0) / residual.length;
    const residualStdDev = Math.sqrt(
      residual.reduce((sum, val) => sum + (val - residualMean) ** 2, 0) / residual.length
    );

    return {
      maxTheoretical: Math.max(...theoretical),
      minTheoretical: Math.min(...theoretical),
      residualMean,
      residualStdDev,
      curveRatio: (inCurve / processedData.length) * 100,
      totalPoints: processedData.length,
      curvePoints: inCurve
    };
  }

  /**
   * 補正率の自動推定
   * 既知の曲線区間での理論値と実測値の比較から補正率を推定
   *
   * @param {Array} measurementData - 実測データ
   * @param {Array} curveElements - 曲線諸元
   * @param {Object} options - オプション
   * @returns {number} 推定補正率
   */
  static estimateCorrectionRate(measurementData, curveElements, options = {}) {
    const {
      chordLength = 10,
      confidenceThreshold = 0.8,  // 信頼度閾値
      verbose = true
    } = options;

    // 円曲線区間のみを対象とする（緩和曲線は除外）
    const circularCurves = curveElements.filter(c =>
      c.radius && !c.transition && c.radius < 10000  // 半径10km未満
    );

    if (circularCurves.length === 0) {
      if (verbose) console.log('推定に使用できる円曲線区間がありません');
      return 1.0;  // デフォルト値
    }

    let totalRatio = 0;
    let validSamples = 0;

    for (const curve of circularCurves) {
      // 理論正矢
      const theoretical = (chordLength * chordLength * 1000) / (8 * curve.radius);

      // 該当区間の実測値を取得
      const curveData = measurementData.filter(d =>
        d.position >= curve.start && d.position <= curve.end
      );

      if (curveData.length < 10) continue;  // サンプル数が少ない場合はスキップ

      // 実測値の平均
      const measured = curveData.reduce((sum, d) =>
        sum + (d.versine || d.alignment || 0), 0
      ) / curveData.length;

      if (measured > 0 && theoretical > 0) {
        const ratio = theoretical / measured;

        // 異常値の除外（0.5～2.0の範囲）
        if (ratio >= 0.5 && ratio <= 2.0) {
          totalRatio += ratio;
          validSamples++;
        }
      }
    }

    if (validSamples === 0) {
      if (verbose) console.log('有効なサンプルがありません');
      return 1.0;
    }

    const estimatedRate = totalRatio / validSamples;

    if (verbose) {
      console.log(`補正率推定完了: ${estimatedRate.toFixed(3)}`);
      console.log(`使用サンプル数: ${validSamples}/${circularCurves.length}曲線`);
    }

    // 安全のため、極端な値を制限
    return Math.max(0.8, Math.min(1.3, estimatedRate));
  }
}

module.exports = AlignmentCorrection;
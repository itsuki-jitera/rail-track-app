/**
 * 曲線諸元の台形差引アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 通り狂いから曲線諸元の台形を差し引く
 * - 緩和曲線の始終点を10m弦で測定したときの補正（D/6補正）
 * - 復元波形計算の前処理として実行
 */

class CurveTrapezoid {
  /**
   * 曲線諸元の台形を差し引く
   *
   * @param {Array} alignmentData - 通り狂いデータ
   * @param {Array} curveElements - 曲線諸元
   * @param {Object} options - オプション
   * @returns {Object} 処理結果
   */
  static subtractCurveTrapezoid(alignmentData, curveElements, options = {}) {
    const {
      dataInterval = 0.25,     // データ間隔 (m)
      chordLength = 10,        // 弦長 (m) - 10m弦測定
      applyTransitionCorrection = true,  // 緩和曲線補正を適用
      verbose = true
    } = options;

    if (verbose) {
      console.log('曲線諸元の台形差引処理開始');
      console.log(`曲線区間数: ${curveElements.length}`);
      console.log(`弦長: ${chordLength}m`);
    }

    // データの正規化
    const normalizedData = this.normalizeData(alignmentData);

    // 曲線諸元の理論正矢を計算
    const theoreticalVersine = this.calculateTheoreticalVersine(
      normalizedData,
      curveElements,
      chordLength,
      dataInterval
    );

    // 緩和曲線の補正（D/6補正）
    let correctedVersine = theoreticalVersine;
    if (applyTransitionCorrection) {
      correctedVersine = this.applyTransitionCorrection(
        theoreticalVersine,
        curveElements,
        dataInterval
      );
    }

    // 通り狂いから理論正矢を差し引く
    const subtractedData = normalizedData.map((point, i) => ({
      ...point,
      originalValue: point.value,
      theoreticalVersine: correctedVersine[i],
      subtractedValue: point.value - correctedVersine[i],
      inCurve: correctedVersine[i] !== 0
    }));

    // 統計情報
    const statistics = this.calculateStatistics(
      normalizedData,
      correctedVersine,
      subtractedData
    );

    if (verbose) {
      console.log('曲線諸元の台形差引処理完了');
      console.log(`処理前RMS: ${statistics.original.rms.toFixed(3)}mm`);
      console.log(`処理後RMS: ${statistics.subtracted.rms.toFixed(3)}mm`);
      console.log(`曲線区間の割合: ${statistics.curveRatio.toFixed(1)}%`);
    }

    return {
      data: subtractedData,
      theoreticalVersine: correctedVersine,
      statistics,
      parameters: {
        chordLength,
        dataInterval,
        applyTransitionCorrection
      }
    };
  }

  /**
   * 理論正矢の計算
   */
  static calculateTheoreticalVersine(data, curveElements, chordLength, dataInterval) {
    const versine = new Array(data.length).fill(0);

    // 各曲線要素について処理
    curveElements.forEach(curve => {
      const startIdx = Math.floor(curve.start / dataInterval);
      const endIdx = Math.ceil(curve.end / dataInterval);

      // 円曲線部分の正矢計算
      // 正矢 v = L²/(8R) ここで L:弦長, R:半径
      const circularVersine = (chordLength * chordLength * 1000) / (8 * curve.radius);

      // 緩和曲線がある場合
      if (curve.transition) {
        // 緩和曲線始点
        const tcStart = curve.transition.start || curve.start;
        const tcEnd = curve.transition.startEnd || (curve.start + curve.transition.length);

        // 緩和曲線終点
        const ctStart = curve.transition.endStart || (curve.end - curve.transition.length);
        const ctEnd = curve.transition.end || curve.end;

        // 各区間での正矢設定
        for (let i = startIdx; i <= endIdx && i < versine.length; i++) {
          const position = i * dataInterval;

          if (position >= tcStart && position <= tcEnd) {
            // 緩和曲線（始点側）
            const progress = (position - tcStart) / (tcEnd - tcStart);
            versine[i] = this.calculateTransitionVersine(
              progress,
              circularVersine,
              curve.transition.type || 'clothoid'
            );
          } else if (position >= tcEnd && position <= ctStart) {
            // 円曲線
            versine[i] = circularVersine;
          } else if (position >= ctStart && position <= ctEnd) {
            // 緩和曲線（終点側）
            const progress = 1 - (position - ctStart) / (ctEnd - ctStart);
            versine[i] = this.calculateTransitionVersine(
              progress,
              circularVersine,
              curve.transition.type || 'clothoid'
            );
          }
        }
      } else {
        // 緩和曲線なし（円曲線のみ）
        for (let i = startIdx; i <= endIdx && i < versine.length; i++) {
          const position = i * dataInterval;
          if (position >= curve.start && position <= curve.end) {
            versine[i] = circularVersine;
          }
        }
      }
    });

    return versine;
  }

  /**
   * 緩和曲線部分の正矢計算
   */
  static calculateTransitionVersine(progress, maxVersine, type = 'clothoid') {
    switch (type) {
      case 'clothoid':
        // クロソイド曲線: 正矢は距離の2乗に比例
        return maxVersine * progress * progress;

      case 'cubic':
        // 3次放物線
        return maxVersine * progress * progress * (3 - 2 * progress);

      case 'sine':
        // サインカーブ
        return maxVersine * (1 - Math.cos(Math.PI * progress)) / 2;

      default:
        // 線形
        return maxVersine * progress;
    }
  }

  /**
   * 緩和曲線の補正（D/6補正）
   * 10m弦測定時の緩和曲線始終点での補正
   */
  static applyTransitionCorrection(versine, curveElements, dataInterval) {
    const corrected = [...versine];

    curveElements.forEach(curve => {
      if (!curve.transition) return;

      // 緩和曲線の長さ
      const transitionLength = curve.transition.length || 0;
      if (transitionLength === 0) return;

      // 5m間の正矢の変化量 D
      const halfChord = 5;  // 10m弦の半分
      const pointsInHalfChord = Math.round(halfChord / dataInterval);

      // 緩和曲線始点での補正
      if (curve.transition.start) {
        const startIdx = Math.floor(curve.transition.start / dataInterval);

        // 5m間の正矢変化量を計算
        if (startIdx + pointsInHalfChord < corrected.length) {
          const D = corrected[startIdx + pointsInHalfChord] - corrected[startIdx];

          // 始点での補正: D/6
          corrected[startIdx] += D / 6;

          // 近傍点への影響を考慮（オプション）
          for (let i = 1; i <= 2 && startIdx + i < corrected.length; i++) {
            corrected[startIdx + i] += D / 6 * (1 - i * 0.3);
          }
        }
      }

      // 緩和曲線終点での補正
      if (curve.transition.end) {
        const endIdx = Math.floor(curve.transition.end / dataInterval);

        // 5m間の正矢変化量を計算
        if (endIdx - pointsInHalfChord >= 0) {
          const D = corrected[endIdx] - corrected[endIdx - pointsInHalfChord];

          // 終点での補正: D/6
          corrected[endIdx] += D / 6;

          // 近傍点への影響を考慮（オプション）
          for (let i = 1; i <= 2 && endIdx - i >= 0; i++) {
            corrected[endIdx - i] += D / 6 * (1 - i * 0.3);
          }
        }
      }
    });

    return corrected;
  }

  /**
   * データの正規化
   */
  static normalizeData(data) {
    if (!data || data.length === 0) {
      return [];
    }

    if (typeof data[0] === 'number') {
      return data.map((value, index) => ({
        position: index * 0.25,
        value
      }));
    }

    return data.map((item, index) => ({
      position: item.position !== undefined ? item.position : index * 0.25,
      value: item.value || item
    }));
  }

  /**
   * 統計情報の計算
   */
  static calculateStatistics(originalData, theoreticalVersine, subtractedData) {
    const calcStats = (values) => {
      const n = values.length;
      if (n === 0) return { mean: 0, stdDev: 0, rms: 0, min: 0, max: 0 };

      const mean = values.reduce((sum, val) => sum + val, 0) / n;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      const rms = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0) / n);
      const min = Math.min(...values);
      const max = Math.max(...values);

      return { mean, stdDev, rms, min, max, range: max - min };
    };

    const originalValues = originalData.map(d => d.value);
    const subtractedValues = subtractedData.map(d => d.subtractedValue);
    const curvePoints = theoreticalVersine.filter(v => v !== 0).length;

    return {
      original: calcStats(originalValues),
      theoretical: calcStats(theoreticalVersine),
      subtracted: calcStats(subtractedValues),
      curvePoints: curvePoints,
      totalPoints: originalData.length,
      curveRatio: (curvePoints / originalData.length) * 100,
      improvement: 1 - (calcStats(subtractedValues).rms / calcStats(originalValues).rms)
    };
  }

  /**
   * 曲線諸元データの検証
   */
  static validateCurveElements(curveElements) {
    const errors = [];
    const warnings = [];

    curveElements.forEach((curve, index) => {
      // 必須フィールドの確認
      if (curve.start === undefined || curve.end === undefined) {
        errors.push(`曲線${index + 1}: 開始・終了位置が未定義`);
      }

      if (!curve.radius || curve.radius <= 0) {
        errors.push(`曲線${index + 1}: 半径が無効`);
      }

      // 範囲チェック
      if (curve.start >= curve.end) {
        errors.push(`曲線${index + 1}: 開始位置が終了位置より後`);
      }

      // 緩和曲線チェック
      if (curve.transition) {
        if (!curve.transition.length || curve.transition.length <= 0) {
          warnings.push(`曲線${index + 1}: 緩和曲線長が無効`);
        }

        const totalLength = curve.end - curve.start;
        const transitionLength = (curve.transition.length || 0) * 2;

        if (transitionLength > totalLength) {
          errors.push(`曲線${index + 1}: 緩和曲線長が全長を超過`);
        }
      }

      // 重複チェック
      for (let j = index + 1; j < curveElements.length; j++) {
        const other = curveElements[j];
        if (curve.start < other.end && curve.end > other.start) {
          warnings.push(`曲線${index + 1}と曲線${j + 1}が重複`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 可視化用データの生成
   */
  static generateVisualizationData(data, theoreticalVersine, curveElements) {
    const visualization = {
      originalData: data.map(d => ({
        x: d.position,
        y: d.originalValue || d.value
      })),
      theoreticalVersine: theoreticalVersine.map((v, i) => ({
        x: i * 0.25,
        y: v
      })),
      subtractedData: data.map(d => ({
        x: d.position,
        y: d.subtractedValue || d.value
      })),
      curveRegions: []
    };

    // 曲線区間の可視化
    curveElements.forEach((curve, index) => {
      visualization.curveRegions.push({
        id: `curve_${index}`,
        start: curve.start,
        end: curve.end,
        radius: curve.radius,
        type: curve.transition ? 'with_transition' : 'circular',
        color: 'rgba(255, 206, 86, 0.2)',
        label: `R=${curve.radius}m`
      });

      // 緩和曲線区間
      if (curve.transition) {
        const tcStart = curve.transition.start || curve.start;
        const tcEnd = tcStart + curve.transition.length;
        const ctStart = curve.end - curve.transition.length;
        const ctEnd = curve.transition.end || curve.end;

        visualization.curveRegions.push({
          id: `transition_start_${index}`,
          start: tcStart,
          end: tcEnd,
          type: 'transition',
          color: 'rgba(75, 192, 192, 0.2)',
          label: '緩和曲線'
        });

        visualization.curveRegions.push({
          id: `transition_end_${index}`,
          start: ctStart,
          end: ctEnd,
          type: 'transition',
          color: 'rgba(75, 192, 192, 0.2)',
          label: '緩和曲線'
        });
      }
    });

    return visualization;
  }

  /**
   * バッチ処理
   */
  static batchProcess(datasets, curveElements, options = {}) {
    const results = [];

    datasets.forEach((dataset, index) => {
      try {
        const result = this.subtractCurveTrapezoid(
          dataset.data,
          curveElements,
          { ...options, verbose: false }
        );

        results.push({
          id: dataset.id || `dataset_${index}`,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          id: dataset.id || `dataset_${index}`,
          success: false,
          error: error.message
        });
      }
    });

    return {
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }
}

module.exports = CurveTrapezoid;
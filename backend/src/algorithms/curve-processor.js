/**
 * KANA3 Curve Specification Processor
 * 曲線仕様処理モジュール
 *
 * 機能:
 * - 曲線管理データからの理論正矢計算
 * - カント・スラックの考慮
 * - 緩和曲線区間の処理
 * - 縦曲線（勾配変化）の処理
 */

class CurveProcessor {
  constructor(options = {}) {
    // 軌間（mm）
    this.gaugeWidth = options.gaugeWidth || 1067; // 在来線狭軌

    // 重力加速度（m/s²）
    this.gravity = 9.80665;

    // 曲線補正係数（検測車種別）
    this.correctionFactor = options.correctionFactor || 1.0;

    // デフォルト縦曲線半径（m）
    this.defaultVerticalRadius = options.defaultVerticalRadius || 3000;
  }

  /**
   * 理論正矢の計算
   * 10m弦に対する正矢を計算
   *
   * @param {number} radius - 曲線半径（m）
   * @param {number} chordLength - 弦長（m）デフォルト10m
   * @returns {number} 理論正矢（mm）
   */
  calculateTheoreticalVersine(radius, chordLength = 10) {
    if (radius === 0 || radius === Infinity) {
      return 0;
    }

    // 正矢 = L² / (8R) の公式
    // Lは弦長、Rは半径
    const versine = (chordLength * chordLength) / (8 * radius) * 1000; // mmに変換

    return versine * this.correctionFactor;
  }

  /**
   * カントを考慮した補正正矢の計算
   *
   * @param {number} radius - 曲線半径（m）
   * @param {number} cant - カント（mm）
   * @param {number} speed - 設計速度（km/h）
   * @returns {number} カント補正後の正矢（mm）
   */
  calculateCantCorrectedVersine(radius, cant, speed = 0) {
    const baseVersine = this.calculateTheoreticalVersine(radius);

    if (speed === 0) {
      return baseVersine;
    }

    // カントによる補正
    // 均衡カント C = GV²/(127R) の公式
    // G: 軌間(m), V: 速度(km/h), R: 半径(m)
    const equilibriumCant = (this.gaugeWidth / 1000) * speed * speed / (127 * radius);
    const cantDeficiency = equilibriumCant - cant;

    // カント不足による横方向加速度の影響を正矢に反映
    const correction = cantDeficiency * 0.01; // 補正係数

    return baseVersine + correction;
  }

  /**
   * 緩和曲線区間の正矢計算
   * クロソイド曲線を使用
   *
   * @param {number} position - 緩和曲線始点からの距離（m）
   * @param {number} transitionLength - 緩和曲線長（m）
   * @param {number} radius - 円曲線半径（m）
   * @returns {number} 緩和曲線上の正矢（mm）
   */
  calculateTransitionVersine(position, transitionLength, radius) {
    if (position < 0 || position > transitionLength) {
      return 0;
    }

    // クロソイドパラメータ A = √(R * L)
    const A = Math.sqrt(radius * transitionLength);

    // 位置における曲率
    const curvature = position / (A * A);

    // その位置での半径
    const localRadius = 1 / curvature;

    // 10m弦に対する正矢を計算
    return this.calculateTheoreticalVersine(localRadius);
  }

  /**
   * 曲線データから連続的な正矢データを生成
   *
   * @param {Array} curveData - 曲線管理データ
   * @param {number} startKm - 開始キロ程
   * @param {number} endKm - 終了キロ程
   * @param {number} interval - データ間隔（m）
   * @returns {Array} 正矢データ配列
   */
  generateVersineProfile(curveData, startKm, endKm, interval = 0.25) {
    const profile = [];
    const totalDistance = (endKm - startKm) * 1000; // mに変換
    const numPoints = Math.floor(totalDistance / interval) + 1;

    for (let i = 0; i < numPoints; i++) {
      const position = startKm * 1000 + i * interval;
      const kilometer = position / 1000;

      // 現在位置の曲線を検索
      const curve = this.findCurveAtPosition(curveData, kilometer);

      let versine = 0;

      if (curve) {
        // 曲線区間内での相対位置
        const relativePosition = (kilometer - curve.startKilometer) * 1000;

        if (curve.transitions && curve.transitions.length > 0) {
          // 緩和曲線の処理
          versine = this.processTransitionSection(
            relativePosition,
            curve
          );
        } else {
          // 円曲線の処理
          versine = this.calculateCantCorrectedVersine(
            curve.radius,
            curve.cant || 0,
            curve.designSpeed || 0
          );
        }

        // スラックの考慮
        if (curve.slack) {
          versine += curve.slack * 0.1; // スラック補正
        }
      }

      profile.push({
        kilometer: kilometer,
        position: position,
        versine: versine,
        curveRadius: curve ? curve.radius : Infinity,
        cant: curve ? curve.cant : 0
      });
    }

    return profile;
  }

  /**
   * 指定位置の曲線データを検索
   */
  findCurveAtPosition(curveData, kilometer) {
    for (const curve of curveData) {
      if (kilometer >= curve.startKilometer &&
          kilometer <= curve.endKilometer) {
        return curve;
      }
    }
    return null;
  }

  /**
   * 緩和曲線区間の処理
   */
  processTransitionSection(position, curve) {
    // 入口緩和曲線
    const entryTransition = curve.transitions.find(t => t.type === 'begin');
    const exitTransition = curve.transitions.find(t => t.type === 'end');

    if (entryTransition && position < entryTransition.length) {
      // 入口緩和曲線内
      return this.calculateTransitionVersine(
        position,
        entryTransition.length,
        curve.radius
      );
    }

    if (exitTransition) {
      const circularEnd = (curve.endKilometer - exitTransition.kilometer) * 1000;
      if (position > circularEnd) {
        // 出口緩和曲線内
        const transitionPosition = position - circularEnd;
        return this.calculateTransitionVersine(
          exitTransition.length - transitionPosition,
          exitTransition.length,
          curve.radius
        );
      }
    }

    // 円曲線部
    return this.calculateTheoreticalVersine(curve.radius);
  }

  /**
   * 縦曲線（勾配変化）による高低補正
   *
   * @param {Array} gradientData - 勾配データ
   * @param {Array} elevationData - 高低データ
   * @returns {Array} 縦曲線補正後のデータ
   */
  applyVerticalCurveCorrection(gradientData, elevationData) {
    const correctedData = [];
    const n = Math.min(gradientData.length, elevationData.length);

    for (let i = 0; i < n; i++) {
      let correction = 0;

      if (i > 0 && i < n - 1) {
        // 前後の勾配から勾配変化率を計算
        const gradientChange = Math.abs(
          gradientData[i + 1].gradient - gradientData[i - 1].gradient
        );

        // 勾配変化が大きい場合の縦曲線半径
        let verticalRadius = this.defaultVerticalRadius;
        if (gradientChange > 10) {
          // 10‰を超える場合
          verticalRadius = 4000;
        } else if (gradientChange > 15) {
          // 15‰を超える場合
          verticalRadius = 5000;
        }

        // 縦曲線による高低補正
        const interval = elevationData[i].position - elevationData[i - 1].position;
        correction = (interval * interval) / (2 * verticalRadius) * 1000;
      }

      correctedData.push({
        ...elevationData[i],
        originalValue: elevationData[i].value,
        correctedValue: elevationData[i].value - correction,
        verticalCurveCorrection: correction
      });
    }

    return correctedData;
  }

  /**
   * 複合曲線（S字カーブ等）の処理
   *
   * @param {Array} curves - 連続する曲線データ
   * @returns {Array} 複合曲線処理後のデータ
   */
  processCompoundCurves(curves) {
    const processed = [];

    for (let i = 0; i < curves.length; i++) {
      const current = curves[i];
      const next = curves[i + 1];

      // S字カーブの検出
      if (next && this.isReverseCurve(current, next)) {
        // 逆向き曲線の場合の特殊処理
        const intermediateSection = this.createIntermediateSection(
          current,
          next
        );
        processed.push(...intermediateSection);
      } else {
        processed.push(current);
      }
    }

    return processed;
  }

  /**
   * 逆向き曲線（S字）の判定
   */
  isReverseCurve(curve1, curve2) {
    // 曲線の向きが逆かどうか判定
    // 実際の実装では曲線の方向情報が必要
    const gap = curve2.startKilometer - curve1.endKilometer;
    return gap < 0.1; // 100m以内で接続している場合
  }

  /**
   * 中間セクションの生成
   */
  createIntermediateSection(curve1, curve2) {
    // S字カーブ間の滑らかな遷移を生成
    const sections = [];

    // 実装省略（詳細な遷移計算が必要）
    sections.push(curve1);
    sections.push(curve2);

    return sections;
  }

  /**
   * 曲線データの検証
   *
   * @param {Array} curveData - 曲線データ
   * @returns {Object} 検証結果
   */
  validateCurveData(curveData) {
    const errors = [];
    const warnings = [];

    for (const curve of curveData) {
      // 半径チェック
      if (curve.radius < 100) {
        errors.push(`急曲線: R${curve.radius}m at ${curve.startKilometer}km`);
      } else if (curve.radius < 200) {
        warnings.push(`小半径曲線: R${curve.radius}m at ${curve.startKilometer}km`);
      }

      // カントチェック
      if (curve.cant > 200) {
        errors.push(`過大カント: ${curve.cant}mm at ${curve.startKilometer}km`);
      }

      // 緩和曲線長チェック
      if (curve.transitions) {
        for (const transition of curve.transitions) {
          const minLength = Math.sqrt(curve.radius) * 0.5;
          if (transition.length < minLength) {
            warnings.push(
              `緩和曲線長不足: ${transition.length}m (推奨: ${minLength}m) at ${curve.startKilometer}km`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalCurves: curveData.length,
        minRadius: Math.min(...curveData.map(c => c.radius)),
        maxRadius: Math.max(...curveData.map(c => c.radius)),
        totalLength: curveData.reduce(
          (sum, c) => sum + (c.endKilometer - c.startKilometer),
          0
        )
      }
    };
  }

  /**
   * 曲線パラメータの最適化
   * 実測データから最適な曲線パラメータを推定
   *
   * @param {Array} measuredData - 実測正矢データ
   * @param {Object} initialCurve - 初期曲線パラメータ
   * @returns {Object} 最適化された曲線パラメータ
   */
  optimizeCurveParameters(measuredData, initialCurve) {
    let bestCurve = { ...initialCurve };
    let minError = Infinity;

    // グリッドサーチによる最適化
    const radiusRange = [
      initialCurve.radius * 0.9,
      initialCurve.radius * 1.1
    ];
    const cantRange = [
      Math.max(0, initialCurve.cant - 10),
      initialCurve.cant + 10
    ];

    const radiusStep = (radiusRange[1] - radiusRange[0]) / 10;
    const cantStep = (cantRange[1] - cantRange[0]) / 10;

    for (let r = radiusRange[0]; r <= radiusRange[1]; r += radiusStep) {
      for (let c = cantRange[0]; c <= cantRange[1]; c += cantStep) {
        // 理論値を計算
        const theoretical = this.calculateCantCorrectedVersine(r, c);

        // 誤差を計算
        const error = this.calculateError(measuredData, theoretical);

        if (error < minError) {
          minError = error;
          bestCurve = {
            ...initialCurve,
            radius: r,
            cant: c
          };
        }
      }
    }

    return {
      optimized: bestCurve,
      error: minError,
      improvement: (1 - minError / this.calculateError(
        measuredData,
        this.calculateCantCorrectedVersine(initialCurve.radius, initialCurve.cant)
      )) * 100
    };
  }

  /**
   * 誤差計算
   */
  calculateError(measuredData, theoreticalValue) {
    let sumSquaredError = 0;
    let count = 0;

    for (const point of measuredData) {
      const error = point.value - theoreticalValue;
      sumSquaredError += error * error;
      count++;
    }

    return count > 0 ? Math.sqrt(sumSquaredError / count) : Infinity;
  }
}

module.exports = { CurveProcessor };
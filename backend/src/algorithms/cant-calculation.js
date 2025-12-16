/**
 * カント計算アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 反対側レールの高低復元波形計算
 * - 実カントと設計カントの差の計算
 * - 水準狂い整備に必要なこう上量の計算
 */

class CantCalculation {
  /**
   * 反対側レールの高低計算
   *
   * @param {Object} data - 軌道データ
   * @param {Object} options - オプション
   * @returns {Object} 計算結果
   */
  static calculateOppositeRail(data, options = {}) {
    const {
      selectedRail = 'left',     // 選択レール（left/right）
      gauge = 1067,              // 軌間 (mm)
      curveDirection = null,     // カーブ方向（left/right）
      verbose = true
    } = options;

    if (verbose) {
      console.log('反対側レール計算開始');
      console.log(`選択レール: ${selectedRail}`);
      console.log(`軌間: ${gauge}mm`);
    }

    const result = {
      selectedRail: [],
      oppositeRail: [],
      cant: [],
      statistics: {}
    };

    // 選択レールのデータ
    const selectedData = selectedRail === 'left' ? data.leftLevel : data.rightLevel;
    const waterLevel = data.waterLevel || data.twist || [];
    const designCant = data.designCant || [];

    // 反対側レールの計算
    for (let i = 0; i < selectedData.length; i++) {
      const position = data.positions ? data.positions[i] : i * 0.25;
      const selected = selectedData[i] || 0;
      const water = waterLevel[i] || 0;
      const design = designCant[i] || 0;

      // 水準から反対側レールの高低を計算
      // 水準 = 右レール - 左レール（右カーブで正）
      let opposite;
      if (selectedRail === 'left') {
        // 左レール選択時: 右レール = 左レール + 水準
        opposite = selected + water;
      } else {
        // 右レール選択時: 左レール = 右レール - 水準
        opposite = selected - water;
      }

      result.selectedRail.push({
        position,
        value: selected,
        rail: selectedRail
      });

      result.oppositeRail.push({
        position,
        value: opposite,
        rail: selectedRail === 'left' ? 'right' : 'left'
      });

      // 実カントの計算（水準値そのもの）
      result.cant.push({
        position,
        actualCant: water,
        designCant: design,
        difference: water - design
      });
    }

    // 統計情報
    result.statistics = this.calculateStatistics(result);

    if (verbose) {
      console.log('反対側レール計算完了');
      console.log(`実カント平均: ${result.statistics.cant.actualMean.toFixed(2)}mm`);
      console.log(`カント差平均: ${result.statistics.cant.differenceMean.toFixed(2)}mm`);
    }

    return result;
  }

  /**
   * 実カントと設計カントの差の計算
   *
   * @param {Object} data - 測定データ
   * @param {Object} curveElements - 曲線諸元
   * @param {Object} options - オプション
   * @returns {Object} カント差情報
   */
  static calculateCantDifference(data, curveElements, options = {}) {
    const {
      selectedRail = 'left',
      verbose = true
    } = options;

    if (verbose) {
      console.log('カント差計算開始');
    }

    const result = {
      positions: [],
      actualCant: [],
      designCant: [],
      cantDifference: [],
      adjustedDifference: [],  // レール選択による調整後
      recommendations: []
    };

    // 各位置でのカント計算
    data.positions.forEach((position, i) => {
      // 実カント（水準値）
      const actual = data.waterLevel?.[i] || data.twist?.[i] || 0;

      // 設計カントの取得
      const design = this.getDesignCantAtPosition(position, curveElements);

      // カント差の計算
      let difference = actual - design;

      // レール選択による調整
      // 左レール選択時: 水準 - 設計カント
      // 右レール選択時: 設計カント - 水準
      let adjusted;
      if (selectedRail === 'left') {
        adjusted = actual - design;
      } else {
        adjusted = design - actual;
      }

      result.positions.push(position);
      result.actualCant.push(actual);
      result.designCant.push(design);
      result.cantDifference.push(difference);
      result.adjustedDifference.push(adjusted);

      // 推奨事項の生成
      if (Math.abs(difference) > 10) {
        result.recommendations.push({
          position,
          type: difference > 0 ? 'excess' : 'deficient',
          amount: Math.abs(difference),
          message: difference > 0
            ? `カント過大: ${difference.toFixed(1)}mm`
            : `カント不足: ${Math.abs(difference).toFixed(1)}mm`
        });
      }
    });

    // 統計情報
    const stats = this.calculateCantStatistics(result);
    result.statistics = stats;

    if (verbose) {
      console.log('カント差計算完了');
      console.log(`最大カント差: ${stats.maxDifference.toFixed(2)}mm`);
      console.log(`推奨事項: ${result.recommendations.length}件`);
    }

    return result;
  }

  /**
   * こう上量の計算（水準狂い整正用）
   *
   * @param {Object} cantDifference - カント差データ
   * @param {Object} planLine - 計画線
   * @param {Object} options - オプション
   * @returns {Object} こう上量計算結果
   */
  static calculateUpwardAmount(cantDifference, planLine, options = {}) {
    const {
      selectedRail = 'left',
      targetCantAccuracy = 5,  // 目標カント精度 (mm)
      verbose = true
    } = options;

    if (verbose) {
      console.log('こう上量計算開始');
      console.log(`目標カント精度: ±${targetCantAccuracy}mm`);
    }

    const result = {
      positions: [],
      requiredUpward: [],      // 必要こう上量
      plannedUpward: [],       // 計画こう上量
      cantCorrection: [],      // カント補正量
      isAdequate: [],          // 十分性判定
      totalAdequate: 0,
      totalInadequate: 0
    };

    // 各位置でのこう上量計算
    for (let i = 0; i < cantDifference.positions.length; i++) {
      const position = cantDifference.positions[i];
      const cantDiff = cantDifference.adjustedDifference[i];

      // 必要こう上量（カント差を解消するため）
      let required;
      if (selectedRail === 'left') {
        // 左レール: カント差が正なら上げる必要あり
        required = cantDiff > targetCantAccuracy ? cantDiff - targetCantAccuracy : 0;
      } else {
        // 右レール: カント差が負なら上げる必要あり
        required = cantDiff < -targetCantAccuracy ? Math.abs(cantDiff) - targetCantAccuracy : 0;
      }

      // 計画線からの計画こう上量を取得
      const planned = this.getPlannedUpwardAtPosition(position, planLine);

      // カント補正量
      const correction = planned - required;

      // 十分性判定
      const adequate = planned >= required;

      result.positions.push(position);
      result.requiredUpward.push(required);
      result.plannedUpward.push(planned);
      result.cantCorrection.push(correction);
      result.isAdequate.push(adequate);

      if (adequate) {
        result.totalAdequate++;
      } else {
        result.totalInadequate++;
      }
    }

    // 統計情報
    result.statistics = {
      averageRequired: this.average(result.requiredUpward),
      averagePlanned: this.average(result.plannedUpward),
      adequacyRate: result.totalAdequate / result.positions.length * 100,
      maxShortfall: Math.min(...result.cantCorrection),
      positions: result.positions.length
    };

    if (verbose) {
      console.log('こう上量計算完了');
      console.log(`平均必要量: ${result.statistics.averageRequired.toFixed(2)}mm`);
      console.log(`平均計画量: ${result.statistics.averagePlanned.toFixed(2)}mm`);
      console.log(`充足率: ${result.statistics.adequacyRate.toFixed(1)}%`);
    }

    return result;
  }

  /**
   * カーブ区間の実カント評価
   *
   * @param {Object} cantData - カントデータ
   * @param {Object} curveElements - 曲線諸元
   * @returns {Object} 評価結果
   */
  static evaluateCurveCant(cantData, curveElements) {
    const evaluations = [];

    curveElements.forEach(curve => {
      // カーブ区間内のデータを抽出
      const curveData = cantData.filter(d =>
        d.position >= curve.start && d.position <= curve.end
      );

      if (curveData.length === 0) return;

      // 実カントと設計カントの統計
      const actualCants = curveData.map(d => d.actualCant);
      const differences = curveData.map(d => d.actualCant - curve.cant);

      const evaluation = {
        curveId: curve.id || `curve_${curve.start}_${curve.end}`,
        start: curve.start,
        end: curve.end,
        designCant: curve.cant,
        radius: curve.radius,
        statistics: {
          actualMean: this.average(actualCants),
          actualStdDev: this.standardDeviation(actualCants),
          differenceMean: this.average(differences),
          differenceStdDev: this.standardDeviation(differences),
          maxDifference: Math.max(...differences.map(Math.abs)),
          dataPoints: curveData.length
        },
        evaluation: null
      };

      // 評価判定
      if (Math.abs(evaluation.statistics.differenceMean) <= 5) {
        evaluation.evaluation = 'good';
        evaluation.message = '設計カントに適合';
      } else if (Math.abs(evaluation.statistics.differenceMean) <= 10) {
        evaluation.evaluation = 'acceptable';
        evaluation.message = '許容範囲内';
      } else {
        evaluation.evaluation = 'poor';
        evaluation.message = '要整正';
      }

      evaluations.push(evaluation);
    });

    return {
      evaluations,
      summary: {
        totalCurves: evaluations.length,
        good: evaluations.filter(e => e.evaluation === 'good').length,
        acceptable: evaluations.filter(e => e.evaluation === 'acceptable').length,
        poor: evaluations.filter(e => e.evaluation === 'poor').length
      }
    };
  }

  /**
   * 緩和曲線区間のカント逓減計算
   *
   * @param {Object} transitionCurve - 緩和曲線データ
   * @returns {Array} カント逓減値
   */
  static calculateTransitionCant(transitionCurve) {
    const {
      start,
      end,
      startCant = 0,
      endCant,
      type = 'linear'  // linear, clothoid, cubic
    } = transitionCurve;

    const length = end - start;
    const cantDifference = endCant - startCant;
    const points = [];

    // 0.25m間隔でカント値を計算
    for (let pos = start; pos <= end; pos += 0.25) {
      const ratio = (pos - start) / length;
      let cant;

      switch (type) {
        case 'clothoid':
          // クロソイド緩和曲線
          cant = startCant + cantDifference * ratio * ratio;
          break;

        case 'cubic':
          // 3次放物線
          cant = startCant + cantDifference * ratio * ratio * (3 - 2 * ratio);
          break;

        case 'linear':
        default:
          // 直線逓減
          cant = startCant + cantDifference * ratio;
          break;
      }

      points.push({
        position: pos,
        cant: cant,
        gradient: cantDifference / length  // カント勾配
      });
    }

    return points;
  }

  /**
   * ユーティリティ関数
   */

  static getDesignCantAtPosition(position, curveElements) {
    // 該当する曲線区間を探す
    for (const curve of curveElements) {
      if (position >= curve.start && position <= curve.end) {
        // 緩和曲線区間の場合
        if (curve.transition) {
          const transitionCant = this.calculateTransitionCant({
            start: curve.transition.start,
            end: curve.transition.end,
            startCant: curve.transition.startCant || 0,
            endCant: curve.cant,
            type: curve.transition.type
          });

          const point = transitionCant.find(p =>
            Math.abs(p.position - position) < 0.125
          );

          if (point) {
            return point.cant;
          }
        }

        // 円曲線区間
        return curve.cant;
      }
    }

    // 曲線区間外
    return 0;
  }

  static getPlannedUpwardAtPosition(position, planLine) {
    const point = planLine.find(p => Math.abs(p.position - position) < 0.125);

    if (point && point.movement) {
      // 上方向の移動量のみ返す
      return point.movement > 0 ? point.movement : 0;
    }

    return 0;
  }

  static calculateStatistics(data) {
    const selectedValues = data.selectedRail.map(d => d.value);
    const oppositeValues = data.oppositeRail.map(d => d.value);
    const cantValues = data.cant.map(d => d.actualCant);
    const cantDifferences = data.cant.map(d => d.difference);

    return {
      selected: {
        mean: this.average(selectedValues),
        stdDev: this.standardDeviation(selectedValues),
        min: Math.min(...selectedValues),
        max: Math.max(...selectedValues)
      },
      opposite: {
        mean: this.average(oppositeValues),
        stdDev: this.standardDeviation(oppositeValues),
        min: Math.min(...oppositeValues),
        max: Math.max(...oppositeValues)
      },
      cant: {
        actualMean: this.average(cantValues),
        actualStdDev: this.standardDeviation(cantValues),
        differenceMean: this.average(cantDifferences),
        differenceStdDev: this.standardDeviation(cantDifferences)
      }
    };
  }

  static calculateCantStatistics(data) {
    const differences = data.cantDifference;
    const adjusted = data.adjustedDifference;

    return {
      meanDifference: this.average(differences),
      stdDevDifference: this.standardDeviation(differences),
      maxDifference: Math.max(...differences.map(Math.abs)),
      meanAdjusted: this.average(adjusted),
      stdDevAdjusted: this.standardDeviation(adjusted),
      exceedances: differences.filter(d => Math.abs(d) > 10).length,
      exceedanceRate: differences.filter(d => Math.abs(d) > 10).length / differences.length * 100
    };
  }

  static average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  static standardDeviation(arr) {
    if (arr.length === 0) return 0;
    const mean = this.average(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /**
   * カント表示用データの生成
   */
  static generateCantVisualization(cantData, options = {}) {
    const {
      selectedRail = 'left',
      showDesignCant = true,
      showActualCant = true,
      showDifference = true,
      highlightExcess = true
    } = options;

    const visualization = {
      charts: [],
      annotations: [],
      statistics: {}
    };

    // 実カントのチャートデータ
    if (showActualCant) {
      visualization.charts.push({
        label: '実カント（水準）',
        data: cantData.actualCant.map((val, i) => ({
          x: cantData.positions[i],
          y: val
        })),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)'
      });
    }

    // 設計カントのチャートデータ
    if (showDesignCant) {
      visualization.charts.push({
        label: '設計カント',
        data: cantData.designCant.map((val, i) => ({
          x: cantData.positions[i],
          y: val
        })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderDash: [5, 5]
      });
    }

    // カント差のチャートデータ
    if (showDifference) {
      const diffData = selectedRail === 'left'
        ? cantData.adjustedDifference
        : cantData.adjustedDifference.map(d => -d);

      visualization.charts.push({
        label: `カント差（${selectedRail === 'left' ? '左' : '右'}レール基準）`,
        data: diffData.map((val, i) => ({
          x: cantData.positions[i],
          y: val
        })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)'
      });
    }

    // 超過箇所の強調表示
    if (highlightExcess) {
      cantData.cantDifference.forEach((diff, i) => {
        if (Math.abs(diff) > 10) {
          visualization.annotations.push({
            type: 'box',
            xMin: cantData.positions[i] - 0.125,
            xMax: cantData.positions[i] + 0.125,
            yMin: -200,
            yMax: 200,
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            borderColor: 'rgba(255, 0, 0, 0.3)',
            borderWidth: 1
          });
        }
      });
    }

    // 統計情報
    visualization.statistics = cantData.statistics;

    return visualization;
  }
}

module.exports = CantCalculation;
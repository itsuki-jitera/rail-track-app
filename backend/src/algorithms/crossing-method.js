/**
 * 交叉法（クロスオーバー法）モジュール
 * 既存の計画線と新しい計画線を滑らかに接続
 *
 * 理論:
 * - 緩和曲線（クロソイド曲線）を用いた接続
 * - 直線→曲線、曲線→直線の遷移を滑らかに
 * - カント逓減を考慮した接続長の設定
 */

class CrossingMethod {
  constructor(samplingInterval = 0.25) {
    this.samplingInterval = samplingInterval; // サンプリング間隔（m）

    // デフォルト設定
    this.settings = {
      transitionLength: 50.0,  // 遷移区間長（m）
      transitionType: 'cubic', // 遷移タイプ ('cubic', 'sine', 'clothoid')
      cantGradient: 3.0        // カント逓減（mm/m）
    };
  }

  /**
   * 2つの計画線を滑らかに接続
   * @param {MeasurementData[]} planLine1 - 第1の計画線
   * @param {MeasurementData[]} planLine2 - 第2の計画線
   * @param {number} crossingDistance - 交点距離（m）
   * @param {number} transitionLength - 遷移区間長（m）
   * @returns {MeasurementData[]} 接続後の計画線
   */
  connect(planLine1, planLine2, crossingDistance, transitionLength = null) {
    const length = transitionLength || this.settings.transitionLength;

    // 交点の半分の長さずつ前後に遷移区間を設定
    const halfLength = length / 2.0;
    const startDistance = crossingDistance - halfLength;
    const endDistance = crossingDistance + halfLength;

    // 遷移区間のインデックスを検索
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < planLine1.length; i++) {
      if (planLine1[i].distance >= startDistance && startIdx === -1) {
        startIdx = i;
      }
      if (planLine1[i].distance >= endDistance) {
        endIdx = i;
        break;
      }
    }

    if (startIdx === -1 || endIdx === -1) {
      throw new Error('Invalid crossing distance');
    }

    // 新しい計画線を作成
    const result = [...planLine1];

    // 遷移区間の値を補間
    for (let i = startIdx; i <= endIdx; i++) {
      const distance = result[i].distance;
      const t = (distance - startDistance) / length; // 0.0 ～ 1.0

      // 第1の計画線と第2の計画線の値を取得
      const value1 = this.getValueAtDistance(planLine1, distance);
      const value2 = this.getValueAtDistance(planLine2, distance);

      // 遷移関数を適用
      const blendFactor = this.transitionFunction(t);

      // 補間
      result[i].value = parseFloat((value1 * (1 - blendFactor) + value2 * blendFactor).toFixed(3));
    }

    return result;
  }

  /**
   * 遷移関数（0→1への滑らかな変化）
   * @param {number} t - パラメータ（0.0 ～ 1.0）
   * @returns {number} ブレンド係数（0.0 ～ 1.0）
   */
  transitionFunction(t) {
    switch (this.settings.transitionType) {
      case 'cubic':
        // 3次関数（S字カーブ）
        return 3 * t * t - 2 * t * t * t;

      case 'sine':
        // 正弦関数
        return (1 - Math.cos(Math.PI * t)) / 2;

      case 'clothoid':
        // クロソイド曲線（簡易近似）
        return t * t * (3 - 2 * t);

      default:
        // 線形補間
        return t;
    }
  }

  /**
   * 指定距離での値を取得（線形補間）
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} distance - 距離（m）
   * @returns {number} 補間された値
   */
  getValueAtDistance(planLine, distance) {
    // 最も近い2点を検索
    let beforeIdx = -1;
    let afterIdx = -1;

    for (let i = 0; i < planLine.length - 1; i++) {
      if (planLine[i].distance <= distance && planLine[i + 1].distance >= distance) {
        beforeIdx = i;
        afterIdx = i + 1;
        break;
      }
    }

    if (beforeIdx === -1) {
      // 範囲外の場合は最も近い値を返す
      if (distance < planLine[0].distance) {
        return planLine[0].value;
      } else {
        return planLine[planLine.length - 1].value;
      }
    }

    // 線形補間
    const d1 = planLine[beforeIdx].distance;
    const d2 = planLine[afterIdx].distance;
    const v1 = planLine[beforeIdx].value;
    const v2 = planLine[afterIdx].value;

    const t = (distance - d1) / (d2 - d1);
    return v1 + (v2 - v1) * t;
  }

  /**
   * 緩和曲線（クロソイド）を設定
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} startDistance - 開始距離（m）
   * @param {number} endDistance - 終了距離（m）
   * @param {number} startCurvature - 開始曲率（1/R）
   * @param {number} endCurvature - 終了曲率（1/R）
   * @returns {MeasurementData[]} 更新された計画線
   */
  setClothoid(planLine, startDistance, endDistance, startCurvature, endCurvature) {
    const newPlanLine = [...planLine];

    // 区間のインデックスを検索
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < newPlanLine.length; i++) {
      if (newPlanLine[i].distance >= startDistance && startIdx === -1) {
        startIdx = i;
      }
      if (newPlanLine[i].distance >= endDistance) {
        endIdx = i;
        break;
      }
    }

    if (startIdx === -1 || endIdx === -1) {
      throw new Error('Invalid distance range');
    }

    const length = endDistance - startDistance;
    const startValue = newPlanLine[startIdx].value;

    // クロソイドパラメータ
    const curvatureChange = endCurvature - startCurvature;

    for (let i = startIdx; i <= endIdx; i++) {
      const s = newPlanLine[i].distance - startDistance; // 区間内の距離
      const t = s / length; // 正規化パラメータ

      // 曲率の線形変化
      const curvature = startCurvature + curvatureChange * t;

      // 縦断変化（簡易計算）
      const offset = (curvature * s * s) / 2;

      newPlanLine[i].value = parseFloat((startValue + offset).toFixed(3));
    }

    return newPlanLine;
  }

  /**
   * 直線と曲線を緩和曲線で接続
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} connectionDistance - 接続点距離（m）
   * @param {number} curveRadius - 曲線半径（m）
   * @param {string} transitionType - 遷移タイプ ('entry': 直線→曲線, 'exit': 曲線→直線)
   * @returns {MeasurementData[]} 更新された計画線
   */
  setStraightToCurveTransition(planLine, connectionDistance, curveRadius, transitionType = 'entry') {
    const transitionLength = this.calculateTransitionLength(curveRadius);

    let startDistance, endDistance;
    let startCurvature, endCurvature;

    if (transitionType === 'entry') {
      // 直線→曲線
      startDistance = connectionDistance - transitionLength;
      endDistance = connectionDistance;
      startCurvature = 0; // 直線
      endCurvature = 1 / curveRadius; // 曲線
    } else {
      // 曲線→直線
      startDistance = connectionDistance;
      endDistance = connectionDistance + transitionLength;
      startCurvature = 1 / curveRadius; // 曲線
      endCurvature = 0; // 直線
    }

    return this.setClothoid(planLine, startDistance, endDistance, startCurvature, endCurvature);
  }

  /**
   * 必要な緩和曲線長を計算
   * @param {number} curveRadius - 曲線半径（m）
   * @returns {number} 緩和曲線長（m）
   */
  calculateTransitionLength(curveRadius) {
    // カント逓減から計算
    // L = C / i
    // L: 緩和曲線長、C: カント、i: カント逓減

    // 標準的なカント（簡易計算）
    const cant = Math.min(200, 1067 * 1067 / curveRadius / 15); // mm

    // 緩和曲線長
    const length = cant / this.settings.cantGradient;

    // 最小20m、最大100m
    return Math.max(20, Math.min(100, length));
  }

  /**
   * 遷移タイプを設定
   * @param {string} type - 遷移タイプ ('cubic', 'sine', 'clothoid', 'linear')
   */
  setTransitionType(type) {
    const validTypes = ['cubic', 'sine', 'clothoid', 'linear'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid transition type: ${type}`);
    }
    this.settings.transitionType = type;
  }

  /**
   * カント逓減を設定
   * @param {number} gradient - カント逓減（mm/m）
   */
  setCantGradient(gradient) {
    if (gradient <= 0) {
      throw new Error('Cant gradient must be positive');
    }
    this.settings.cantGradient = gradient;
  }

  /**
   * 設定を取得
   * @returns {Object} 設定
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * 複数の区間を自動接続
   * @param {Array<MeasurementData[]>} planLineSegments - 計画線セグメント配列
   * @returns {MeasurementData[]} 接続後の計画線
   */
  autoConnect(planLineSegments) {
    if (planLineSegments.length === 0) {
      throw new Error('No plan line segments provided');
    }

    if (planLineSegments.length === 1) {
      return planLineSegments[0];
    }

    let result = planLineSegments[0];

    for (let i = 1; i < planLineSegments.length; i++) {
      const nextSegment = planLineSegments[i];

      // 接続点を探す（前のセグメントの終点と次のセグメントの始点の中間）
      const lastDistance = result[result.length - 1].distance;
      const firstDistance = nextSegment[0].distance;
      const crossingDistance = (lastDistance + firstDistance) / 2;

      result = this.connect(result, nextSegment, crossingDistance);
    }

    return result;
  }
}

module.exports = { CrossingMethod };

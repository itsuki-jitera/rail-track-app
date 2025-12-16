/**
 * 計画線編集モジュール
 * 復元波形から最適な計画線を作成・編集
 *
 * 機能:
 * - 移動平均による平滑化
 * - 区間指定による直線・曲線設定
 * - 制約条件（最大勾配、最小曲線半径）の適用
 * - インタラクティブな編集履歴管理
 */

class PlanLineEditor {
  constructor(samplingInterval = 0.25) {
    this.samplingInterval = samplingInterval; // サンプリング間隔（m）

    // 編集履歴
    this.history = [];
    this.currentIndex = -1;

    // デフォルト制約条件
    this.constraints = {
      maxGradient: 35.0,      // 最大勾配（千分率）
      minCurveRadius: 600.0,  // 最小曲線半径（m）
      maxCant: 200.0,         // 最大カント（mm）
      maxCantGradient: 5.0    // カント逓減（mm/m）
    };
  }

  /**
   * 初期計画線を生成（移動平均）
   * @param {MeasurementData[]} restoredWaveform - 復元波形
   * @param {number} windowSize - 移動平均窓サイズ（点数）
   * @returns {MeasurementData[]} 初期計画線
   */
  generateInitialPlanLine(restoredWaveform, windowSize = 800) {
    const length = restoredWaveform.length;
    const planLine = [];

    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < length; i++) {
      let sum = 0.0;
      let count = 0;

      const startIdx = Math.max(0, i - halfWindow);
      const endIdx = Math.min(length - 1, i + halfWindow);

      for (let j = startIdx; j <= endIdx; j++) {
        // 完全なnullチェック - オブジェクト自体がnull/undefinedではないか確認してからvalueプロパティを確認
        if (!restoredWaveform[j]) {
          continue;
        }
        // オブジェクトが存在することを確認してからvalueプロパティを確認
        const item = restoredWaveform[j];
        if (item && typeof item === 'object' && 'value' in item && item.value !== null && item.value !== undefined) {
          sum += item.value;
          count++;
        }
      }

      const average = count > 0 ? sum / count : 0;

      // distanceのnullチェックも改善
      const currentItem = restoredWaveform[i];
      if (currentItem && typeof currentItem === 'object' && 'distance' in currentItem && currentItem.distance !== null && currentItem.distance !== undefined) {
        planLine.push({
          distance: currentItem.distance,
          value: parseFloat(average.toFixed(3))
        });
      }
    }

    // 履歴に追加
    this.addToHistory(planLine, 'initial');

    return planLine;
  }

  /**
   * 区間に直線を設定
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} startDistance - 開始距離（m）
   * @param {number} endDistance - 終了距離（m）
   * @returns {MeasurementData[]} 更新された計画線
   */
  setStraightLine(planLine, startDistance, endDistance) {
    const newPlanLine = [...planLine];

    // 開始点と終了点のインデックスを検索
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

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      throw new Error('Invalid distance range');
    }

    // 直線補間
    const startValue = newPlanLine[startIdx].value;
    const endValue = newPlanLine[endIdx].value;
    const distance = endDistance - startDistance;
    const gradient = (endValue - startValue) / distance;

    // 勾配制約チェック
    const gradientPer1000 = Math.abs(gradient * 1000);
    if (gradientPer1000 > this.constraints.maxGradient) {
      console.warn(`Gradient ${gradientPer1000.toFixed(2)} exceeds maximum ${this.constraints.maxGradient}`);
    }

    for (let i = startIdx; i <= endIdx; i++) {
      const d = newPlanLine[i].distance - startDistance;
      newPlanLine[i].value = parseFloat((startValue + gradient * d).toFixed(3));
    }

    // 履歴に追加
    this.addToHistory(newPlanLine, `straight_${startDistance}_${endDistance}`);

    return newPlanLine;
  }

  /**
   * 区間に円曲線を設定
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} startDistance - 開始距離（m）
   * @param {number} endDistance - 終了距離（m）
   * @param {number} radius - 曲線半径（m）
   * @param {string} direction - 曲線方向 ('left' or 'right')
   * @returns {MeasurementData[]} 更新された計画線
   */
  setCircularCurve(planLine, startDistance, endDistance, radius, direction = 'left') {
    const newPlanLine = [...planLine];

    // 半径制約チェック
    if (radius < this.constraints.minCurveRadius) {
      throw new Error(`Radius ${radius}m is less than minimum ${this.constraints.minCurveRadius}m`);
    }

    // 開始点と終了点のインデックスを検索
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

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      throw new Error('Invalid distance range');
    }

    // 円曲線の計算
    const startValue = newPlanLine[startIdx].value;
    const curveLength = endDistance - startDistance;
    const directionSign = direction === 'left' ? -1 : 1;

    for (let i = startIdx; i <= endIdx; i++) {
      const d = newPlanLine[i].distance - startDistance;
      const angle = d / radius;

      // 円曲線の縦断変化（簡易計算）
      const offset = radius * (1 - Math.cos(angle)) * directionSign;

      newPlanLine[i].value = parseFloat((startValue + offset).toFixed(3));
    }

    // 履歴に追加
    this.addToHistory(newPlanLine, `curve_${startDistance}_${endDistance}_R${radius}`);

    return newPlanLine;
  }

  /**
   * 区間を平滑化
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} startDistance - 開始距離（m）
   * @param {number} endDistance - 終了距離（m）
   * @param {number} windowSize - 移動平均窓サイズ（点数）
   * @returns {MeasurementData[]} 更新された計画線
   */
  smoothSection(planLine, startDistance, endDistance, windowSize = 100) {
    const newPlanLine = [...planLine];

    // 開始点と終了点のインデックスを検索
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

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      throw new Error('Invalid distance range');
    }

    // 移動平均
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = startIdx; i <= endIdx; i++) {
      let sum = 0.0;
      let count = 0;

      const winStart = Math.max(startIdx, i - halfWindow);
      const winEnd = Math.min(endIdx, i + halfWindow);

      for (let j = winStart; j <= winEnd; j++) {
        sum += planLine[j].value;
        count++;
      }

      newPlanLine[i].value = parseFloat((sum / count).toFixed(3));
    }

    // 履歴に追加
    this.addToHistory(newPlanLine, `smooth_${startDistance}_${endDistance}`);

    return newPlanLine;
  }

  /**
   * 点の値を直接編集
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} distance - 距離（m）
   * @param {number} newValue - 新しい値（mm）
   * @returns {MeasurementData[]} 更新された計画線
   */
  editPoint(planLine, distance, newValue) {
    const newPlanLine = [...planLine];

    // 最も近い点を検索
    let closestIdx = -1;
    let minDistance = Infinity;

    for (let i = 0; i < newPlanLine.length; i++) {
      const d = Math.abs(newPlanLine[i].distance - distance);
      if (d < minDistance) {
        minDistance = d;
        closestIdx = i;
      }
    }

    if (closestIdx === -1) {
      throw new Error('Point not found');
    }

    newPlanLine[closestIdx].value = parseFloat(newValue.toFixed(3));

    // 履歴に追加
    this.addToHistory(newPlanLine, `edit_point_${distance}`);

    return newPlanLine;
  }

  /**
   * 履歴に追加
   * @param {MeasurementData[]} planLine - 計画線
   * @param {string} operation - 操作名
   */
  addToHistory(planLine, operation) {
    // 現在の位置より後の履歴を削除
    this.history = this.history.slice(0, this.currentIndex + 1);

    // 新しい状態を追加
    this.history.push({
      planLine: JSON.parse(JSON.stringify(planLine)),
      operation,
      timestamp: new Date()
    });

    this.currentIndex = this.history.length - 1;

    // 履歴の上限（100件）
    if (this.history.length > 100) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * 元に戻す（Undo）
   * @returns {MeasurementData[]|null} 計画線（戻せない場合はnull）
   */
  undo() {
    if (this.currentIndex <= 0) {
      return null;
    }

    this.currentIndex--;
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].planLine));
  }

  /**
   * やり直す（Redo）
   * @returns {MeasurementData[]|null} 計画線（やり直せない場合はnull）
   */
  redo() {
    if (this.currentIndex >= this.history.length - 1) {
      return null;
    }

    this.currentIndex++;
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].planLine));
  }

  /**
   * 履歴をクリア
   */
  clearHistory() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * 制約条件を設定
   * @param {Object} constraints - 制約条件
   */
  setConstraints(constraints) {
    this.constraints = { ...this.constraints, ...constraints };
  }

  /**
   * 制約条件を取得
   * @returns {Object} 制約条件
   */
  getConstraints() {
    return { ...this.constraints };
  }

  /**
   * 履歴情報を取得
   * @returns {Array} 履歴情報
   */
  getHistory() {
    return this.history.map((h, i) => ({
      index: i,
      operation: h.operation,
      timestamp: h.timestamp,
      isCurrent: i === this.currentIndex
    }));
  }
}

module.exports = { PlanLineEditor };

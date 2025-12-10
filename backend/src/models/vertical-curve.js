/**
 * 縦曲線諸元管理モデル
 * PDFドキュメント P16の仕様に基づく実装
 */

class VerticalCurveManager {
  constructor(options = {}) {
    this.curves = options.curves || [];
    this.excludeFrom10mChord = options.excludeFrom10mChord || false;
  }

  /**
   * 縦曲線を追加
   * @param {Object} curveData - 縦曲線データ
   */
  addCurve(curveData) {
    const curve = {
      id: this.generateId(),
      startPosition: curveData.startPosition,    // 開始位置（m）
      endPosition: curveData.endPosition,        // 終了位置（m）
      gradeChangePoint: curveData.gradeChangePoint, // 勾配変更点（m）
      gradeBefore: curveData.gradeBefore,        // 変更前勾配（‰）
      gradeAfter: curveData.gradeAfter,          // 変更後勾配（‰）
      radius: curveData.radius || this.calculateDefaultRadius(curveData), // 推定半径（m）
      type: this.determineType(curveData.gradeBefore, curveData.gradeAfter)
    };

    this.curves.push(curve);
    this.sortCurves();
    return curve;
  }

  /**
   * デフォルト半径の計算
   * PDFドキュメントの仕様に基づく
   */
  calculateDefaultRadius(curveData) {
    const gradeChange = Math.abs(curveData.gradeAfter - curveData.gradeBefore);

    // 勾配変化が10‰未満の場合
    if (gradeChange < 10) {
      return 3000;
    }

    // 平面曲線半径に応じた設定
    const horizontalRadius = curveData.horizontalRadius || 1000;
    if (horizontalRadius <= 800) {
      return 4000;
    } else {
      return 3000;
    }
  }

  /**
   * 縦曲線のタイプを判定
   */
  determineType(gradeBefore, gradeAfter) {
    const change = gradeAfter - gradeBefore;
    if (change > 0) {
      return 'sag'; // 凹型（下向き→上向き）
    } else if (change < 0) {
      return 'crest'; // 凸型（上向き→下向き）
    } else {
      return 'flat'; // 変化なし
    }
  }

  /**
   * 10m弦高低の線形を計算
   * @param {number} position - 位置（m）
   * @returns {number} 10m弦高低値
   */
  calculate10mChordElevation(position) {
    if (this.excludeFrom10mChord) {
      return 0;
    }

    for (const curve of this.curves) {
      if (position >= curve.startPosition && position <= curve.endPosition) {
        return this.calculateChordElevationForCurve(position, curve);
      }
    }

    return 0;
  }

  /**
   * 特定の縦曲線に対する10m弦高低を計算
   */
  calculateChordElevationForCurve(position, curve) {
    // 勾配変更点を中心とした円曲線として計算
    const distanceFromCenter = position - curve.gradeChangePoint;
    const radius = curve.radius;

    // 10m弦の正矢計算
    const chordLength = 10; // m
    const halfChord = chordLength / 2;

    // 位置が曲線の中心付近の場合
    if (Math.abs(distanceFromCenter) < halfChord) {
      // 簡略化した正矢計算
      const versine = (halfChord * halfChord) / (2 * radius);
      return versine * 1000; // mm単位に変換
    }

    return 0;
  }

  /**
   * 縦曲線を更新
   * @param {string} id - 縦曲線ID
   * @param {Object} updates - 更新データ
   */
  updateCurve(id, updates) {
    const index = this.curves.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`縦曲線が見つかりません: ${id}`);
    }

    this.curves[index] = {
      ...this.curves[index],
      ...updates,
      type: this.determineType(
        updates.gradeBefore || this.curves[index].gradeBefore,
        updates.gradeAfter || this.curves[index].gradeAfter
      )
    };

    this.sortCurves();
    return this.curves[index];
  }

  /**
   * 縦曲線を削除
   * @param {string} id - 縦曲線ID
   */
  deleteCurve(id) {
    const index = this.curves.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`縦曲線が見つかりません: ${id}`);
    }

    this.curves.splice(index, 1);
  }

  /**
   * 指定位置の縦曲線を取得
   * @param {number} position - 位置（m）
   * @returns {Object|null} 縦曲線データまたはnull
   */
  getCurveAtPosition(position) {
    for (const curve of this.curves) {
      if (position >= curve.startPosition && position <= curve.endPosition) {
        return curve;
      }
    }
    return null;
  }

  /**
   * 縦曲線リストを位置順にソート
   */
  sortCurves() {
    this.curves.sort((a, b) => a.startPosition - b.startPosition);
  }

  /**
   * IDを生成
   */
  generateId() {
    return `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 縦曲線の検証
   * @returns {Object} 検証結果
   */
  validate() {
    const errors = [];
    const warnings = [];

    for (let i = 0; i < this.curves.length; i++) {
      const curve = this.curves[i];

      // 基本検証
      if (curve.startPosition >= curve.endPosition) {
        errors.push(`縦曲線${i + 1}: 開始位置が終了位置より後になっています`);
      }

      if (curve.gradeChangePoint < curve.startPosition ||
          curve.gradeChangePoint > curve.endPosition) {
        errors.push(`縦曲線${i + 1}: 勾配変更点が曲線範囲外です`);
      }

      // 半径の妥当性チェック
      if (curve.radius < 1000) {
        warnings.push(`縦曲線${i + 1}: 半径が1000m未満です`);
      }

      // 重複チェック
      for (let j = i + 1; j < this.curves.length; j++) {
        const other = this.curves[j];
        if (curve.endPosition > other.startPosition &&
            curve.startPosition < other.endPosition) {
          errors.push(`縦曲線${i + 1}と${j + 1}が重複しています`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 縦曲線諸元サマリーを生成
   * @returns {Array} サマリー配列
   */
  getSummary() {
    return this.curves.map(curve => ({
      位置: `${curve.startPosition}m ～ ${curve.endPosition}m`,
      勾配変更点: `${curve.gradeChangePoint}m`,
      勾配変化: `${curve.gradeBefore}‰ → ${curve.gradeAfter}‰`,
      推定半径: `${curve.radius}m`,
      タイプ: curve.type === 'sag' ? '凹型' : curve.type === 'crest' ? '凸型' : '平坦'
    }));
  }

  /**
   * CSVフォーマットで出力
   * @returns {string} CSV文字列
   */
  toCSV() {
    const headers = ['開始位置(m)', '終了位置(m)', '勾配変更点(m)', '変更前勾配(‰)', '変更後勾配(‰)', '推定半径(m)'];
    const rows = this.curves.map(curve => [
      curve.startPosition,
      curve.endPosition,
      curve.gradeChangePoint,
      curve.gradeBefore,
      curve.gradeAfter,
      curve.radius
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = VerticalCurveManager;
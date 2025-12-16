/**
 * ゼロクロス点計算アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 復元波形のゼロクロス点（値が0を横切る点）を検出
 * - 凸計画線の生成に使用される重要な特徴点
 */

class ZeroCrossCalculator {
  /**
   * ゼロクロス点の計算
   *
   * @param {Array} data - 入力データ配列 [{ position, value }] または数値配列
   * @param {Object} options - オプション
   * @returns {Object} ゼロクロス点情報
   */
  static findZeroCrossPoints(data, options = {}) {
    const {
      threshold = 0.01,      // ゼロ判定の閾値 (mm)
      minInterval = 1.0,     // 最小間隔 (m)
      interpolate = true,    // 補間計算を行うか
      dataInterval = 0.25,   // データ間隔 (m)
      verbose = false
    } = options;

    if (verbose) {
      console.log('ゼロクロス点計算開始');
      console.log(`データ点数: ${data.length}`);
      console.log(`閾値: ${threshold}mm`);
    }

    // データの正規化
    const normalizedData = this.normalizeData(data);

    // ゼロクロス点の検出
    const crossPoints = [];
    let lastCrossPosition = -Infinity;

    for (let i = 1; i < normalizedData.length; i++) {
      const prev = normalizedData[i - 1];
      const curr = normalizedData[i];

      // ゼロをまたぐかチェック
      if (this.isCrossing(prev.value, curr.value, threshold)) {
        const position = interpolate
          ? this.interpolateCrossPosition(prev, curr, dataInterval)
          : prev.position + dataInterval / 2;

        // 最小間隔チェック
        if (position - lastCrossPosition >= minInterval) {
          const type = this.getCrossType(prev.value, curr.value);

          crossPoints.push({
            position,
            index: i - 1,
            type,  // 'up' (負→正) または 'down' (正→負)
            prevValue: prev.value,
            nextValue: curr.value,
            interpolated: interpolate
          });

          lastCrossPosition = position;
        }
      }
    }

    // ゼロクロス区間の解析
    const segments = this.analyzeSegments(crossPoints, normalizedData);

    // 統計情報
    const statistics = this.calculateStatistics(crossPoints, normalizedData);

    if (verbose) {
      console.log(`ゼロクロス点検出完了: ${crossPoints.length}点`);
      console.log(`平均間隔: ${statistics.averageInterval.toFixed(2)}m`);
    }

    return {
      crossPoints,
      segments,
      statistics,
      parameters: {
        threshold,
        minInterval,
        interpolate,
        dataInterval
      }
    };
  }

  /**
   * データの正規化
   */
  static normalizeData(data) {
    if (!data || data.length === 0) {
      return [];
    }

    // 配列の形式を統一
    if (typeof data[0] === 'number') {
      // 数値配列の場合
      return data.map((value, index) => ({
        position: index * 0.25,  // デフォルトのデータ間隔
        value
      }));
    } else if (data[0].hasOwnProperty('value')) {
      // オブジェクト配列の場合
      return data.map((item, index) => ({
        position: item.position !== undefined ? item.position : index * 0.25,
        value: item.value
      }));
    }

    return data;
  }

  /**
   * ゼロクロス判定
   */
  static isCrossing(prevValue, currValue, threshold) {
    // 両方が閾値以内の場合はクロスとみなさない
    if (Math.abs(prevValue) <= threshold && Math.abs(currValue) <= threshold) {
      return false;
    }

    // 符号が異なる場合
    if (prevValue * currValue < 0) {
      return true;
    }

    // 片方が閾値以内で、もう片方が閾値を超えている場合
    if ((Math.abs(prevValue) <= threshold && Math.abs(currValue) > threshold) ||
        (Math.abs(prevValue) > threshold && Math.abs(currValue) <= threshold)) {
      return true;
    }

    return false;
  }

  /**
   * クロスタイプの判定
   */
  static getCrossType(prevValue, currValue) {
    if (prevValue < 0 && currValue >= 0) {
      return 'up';    // 負から正へ（上昇）
    } else if (prevValue >= 0 && currValue < 0) {
      return 'down';  // 正から負へ（下降）
    } else {
      return 'neutral';  // その他
    }
  }

  /**
   * ゼロクロス位置の補間計算
   */
  static interpolateCrossPosition(prev, curr, dataInterval) {
    const prevPos = prev.position;
    const currPos = curr.position || (prevPos + dataInterval);

    // 線形補間でゼロクロス位置を計算
    const ratio = Math.abs(prev.value) / (Math.abs(prev.value) + Math.abs(curr.value));

    return prevPos + ratio * (currPos - prevPos);
  }

  /**
   * ゼロクロス区間の解析
   */
  static analyzeSegments(crossPoints, data) {
    if (crossPoints.length < 2) {
      return [];
    }

    const segments = [];

    for (let i = 0; i < crossPoints.length - 1; i++) {
      const startCross = crossPoints[i];
      const endCross = crossPoints[i + 1];

      // 区間内のデータを抽出
      const segmentData = data.filter(d =>
        d.position >= startCross.position &&
        d.position <= endCross.position
      );

      if (segmentData.length > 0) {
        // 区間の特性を計算
        const values = segmentData.map(d => d.value);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const meanValue = values.reduce((sum, v) => sum + v, 0) / values.length;

        segments.push({
          index: i,
          startPosition: startCross.position,
          endPosition: endCross.position,
          length: endCross.position - startCross.position,
          startType: startCross.type,
          endType: endCross.type,
          dataPoints: segmentData.length,
          statistics: {
            max: maxValue,
            min: minValue,
            mean: meanValue,
            amplitude: maxValue - minValue,
            isPositive: meanValue > 0
          }
        });
      }
    }

    return segments;
  }

  /**
   * 統計情報の計算
   */
  static calculateStatistics(crossPoints, data) {
    if (crossPoints.length === 0) {
      return {
        count: 0,
        averageInterval: 0,
        minInterval: 0,
        maxInterval: 0,
        upCrossings: 0,
        downCrossings: 0,
        density: 0
      };
    }

    // クロス点間の間隔を計算
    const intervals = [];
    for (let i = 1; i < crossPoints.length; i++) {
      intervals.push(crossPoints[i].position - crossPoints[i - 1].position);
    }

    // タイプ別カウント
    const upCrossings = crossPoints.filter(p => p.type === 'up').length;
    const downCrossings = crossPoints.filter(p => p.type === 'down').length;

    // データ範囲
    const dataRange = data[data.length - 1].position - data[0].position;

    return {
      count: crossPoints.length,
      averageInterval: intervals.length > 0
        ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length
        : 0,
      minInterval: intervals.length > 0 ? Math.min(...intervals) : 0,
      maxInterval: intervals.length > 0 ? Math.max(...intervals) : 0,
      upCrossings,
      downCrossings,
      density: dataRange > 0 ? crossPoints.length / dataRange : 0,  // 単位長さあたりのクロス点数
      balance: upCrossings - downCrossings  // 上昇と下降のバランス
    };
  }

  /**
   * ゼロクロス点を基準とした区間分割
   * 凸計画線生成用
   */
  static segmentByZeroCross(data, crossPoints, options = {}) {
    const {
      minSegmentLength = 10,  // 最小区間長 (m)
      mergeShortSegments = true,
      verbose = false
    } = options;

    if (verbose) {
      console.log(`ゼロクロス点による区間分割開始`);
      console.log(`最小区間長: ${minSegmentLength}m`);
    }

    let segments = [];

    // データの開始から最初のクロス点まで
    if (crossPoints.length > 0 && crossPoints[0].position > data[0].position) {
      segments.push({
        start: data[0].position,
        end: crossPoints[0].position,
        type: 'start',
        crossPoints: []
      });
    }

    // クロス点間の区間
    for (let i = 0; i < crossPoints.length - 1; i++) {
      segments.push({
        start: crossPoints[i].position,
        end: crossPoints[i + 1].position,
        type: 'middle',
        crossPoints: [crossPoints[i], crossPoints[i + 1]]
      });
    }

    // 最後のクロス点からデータの終了まで
    if (crossPoints.length > 0) {
      const lastCross = crossPoints[crossPoints.length - 1];
      const lastData = data[data.length - 1];
      if (lastCross.position < lastData.position) {
        segments.push({
          start: lastCross.position,
          end: lastData.position,
          type: 'end',
          crossPoints: [lastCross]
        });
      }
    }

    // 短い区間の処理
    if (mergeShortSegments) {
      segments = this.mergeShortSegments(segments, minSegmentLength);
    }

    if (verbose) {
      console.log(`区間分割完了: ${segments.length}区間`);
    }

    return segments;
  }

  /**
   * 短い区間のマージ
   */
  static mergeShortSegments(segments, minLength) {
    const merged = [];
    let currentSegment = null;

    for (const segment of segments) {
      const segmentLength = segment.end - segment.start;

      if (segmentLength >= minLength) {
        // 十分な長さの区間
        if (currentSegment) {
          merged.push(currentSegment);
          currentSegment = null;
        }
        merged.push(segment);
      } else {
        // 短い区間
        if (currentSegment) {
          // 前の区間とマージ
          currentSegment.end = segment.end;
          currentSegment.crossPoints.push(...segment.crossPoints);
        } else {
          currentSegment = { ...segment };
        }
      }
    }

    // 最後の区間を追加
    if (currentSegment) {
      if (merged.length > 0) {
        // 最後の区間とマージ
        const lastSegment = merged[merged.length - 1];
        lastSegment.end = currentSegment.end;
        lastSegment.crossPoints.push(...currentSegment.crossPoints);
      } else {
        merged.push(currentSegment);
      }
    }

    return merged;
  }

  /**
   * ゼロクロス点の可視化用データ生成
   */
  static generateVisualizationData(data, crossPoints) {
    return {
      originalData: data,
      crossPoints: crossPoints.map(cp => ({
        x: cp.position,
        y: 0,  // ゼロ位置
        type: cp.type,
        marker: {
          symbol: cp.type === 'up' ? 'triangle-up' : 'triangle-down',
          size: 10,
          color: cp.type === 'up' ? '#28a745' : '#dc3545'
        }
      })),
      segments: this.analyzeSegments(crossPoints, data).map(seg => ({
        start: seg.startPosition,
        end: seg.endPosition,
        color: seg.statistics.isPositive ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 99, 132, 0.1)',
        label: `${seg.length.toFixed(1)}m`
      }))
    };
  }

  /**
   * ゼロクロス密度の計算
   * 単位長さあたりのゼロクロス点数を計算
   */
  static calculateZeroCrossDensity(data, windowSize = 100, stepSize = 10) {
    const densityData = [];
    const dataLength = data[data.length - 1].position - data[0].position;

    for (let pos = data[0].position; pos <= data[data.length - 1].position - windowSize; pos += stepSize) {
      // ウィンドウ内のデータを抽出
      const windowData = data.filter(d =>
        d.position >= pos && d.position < pos + windowSize
      );

      if (windowData.length > 0) {
        // ウィンドウ内のゼロクロス点を計算
        const crossPoints = this.findZeroCrossPoints(windowData, {
          verbose: false,
          minInterval: 0  // ウィンドウ内では最小間隔を無視
        });

        densityData.push({
          position: pos + windowSize / 2,  // ウィンドウの中心位置
          density: crossPoints.crossPoints.length / windowSize,  // 単位長さあたりの数
          count: crossPoints.crossPoints.length
        });
      }
    }

    return densityData;
  }
}

module.exports = ZeroCrossCalculator;
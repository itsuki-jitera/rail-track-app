/**
 * キヤデータ(O010形式)パーサー
 * レール摩耗測定データから計画線を生成
 */

/**
 * O010形式のCSVファイルをパース
 * @param {Buffer|string} data - CSVデータ
 * @returns {Object} パース結果
 */
function parseKiyaO010(data) {
  try {
    let csvText = data;
    if (Buffer.isBuffer(data)) {
      csvText = data.toString('utf-8');
    }

    // BOMを除去
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim());

    const result = {
      header: null,
      leftRailData: [],
      rightRailData: [],
      metadata: {},
      success: true
    };

    // データポイントの一時格納
    const dataByKP = new Map();

    for (const line of lines) {
      // 矢印を除去してからパース
      const cleanLine = line.replace('→', '');
      const values = cleanLine.split(',').map(v => v.trim());

      // ヘッダー行の解析（1行目）
      if (!result.header && values.length >= 5) {
        const dateStr = values[0];
        if (dateStr && dateStr.includes('/')) {
          result.header = {
            date: dateStr,
            measurementNo: values[1],
            sectionNo: values[2],
            startKP: parseFloat(values[3]) || 0,
            endKP: parseFloat(values[5]) || 0
          };
          result.metadata = {
            measurementDate: dateStr,
            sectionInfo: `${values[1]}-${values[2]}`
          };
          continue;
        }
      }

      // データ行の解析
      if (values.length >= 10) {
        const recordType = parseInt(values[0]);

        // レコードタイプ13: 左レール、14: 右レール
        if (recordType === 13 || recordType === 14) {
          const kpValue = parseFloat(values[8]);
          const position = values[9]; // K: 継目, L: 一般部

          // 測定値（7つの値）を取得
          const measurements = [];
          for (let i = 10; i <= 16 && i < values.length; i++) {
            const val = parseFloat(values[i]);
            if (!isNaN(val)) {
              measurements.push(val);
            }
          }

          // 測定値の平均を計算（0以外の値のみ）
          const validMeasurements = measurements.filter(v => v !== 0);
          const avgValue = validMeasurements.length > 0
            ? validMeasurements.reduce((a, b) => a + b, 0) / validMeasurements.length
            : 0;

          const dataPoint = {
            distance: kpValue * 1000, // kmからmに変換
            value: avgValue,
            position: position,
            rawMeasurements: measurements
          };

          // KP値でグループ化
          if (!dataByKP.has(kpValue)) {
            dataByKP.set(kpValue, { left: null, right: null });
          }

          if (recordType === 13) {
            dataByKP.get(kpValue).left = dataPoint;
          } else {
            dataByKP.get(kpValue).right = dataPoint;
          }
        }
      }
    }

    // データを配列に変換
    const sortedKPs = Array.from(dataByKP.keys()).sort((a, b) => a - b);

    for (const kp of sortedKPs) {
      const data = dataByKP.get(kp);
      if (data.left) {
        result.leftRailData.push(data.left);
      }
      if (data.right) {
        result.rightRailData.push(data.right);
      }
    }

    // 統計情報を追加
    result.statistics = {
      leftRail: calculateStatistics(result.leftRailData),
      rightRail: calculateStatistics(result.rightRailData),
      totalPoints: result.leftRailData.length + result.rightRailData.length
    };

    return result;

  } catch (error) {
    console.error('Error parsing Kiya O010 file:', error);
    return {
      success: false,
      error: error.message,
      leftRailData: [],
      rightRailData: []
    };
  }
}

/**
 * 計画線用のデータに変換
 * @param {Object} parsedData - パース済みデータ
 * @param {string} railSide - 'left' or 'right'
 * @returns {Array} 計画線データ
 */
function convertToPlanLineData(parsedData, railSide = 'left') {
  const railData = railSide === 'left' ? parsedData.leftRailData : parsedData.rightRailData;

  if (!railData || railData.length === 0) {
    return [];
  }

  // 移動平均でスムージング（窓サイズ: 5点）
  const windowSize = 5;
  const smoothedData = [];

  for (let i = 0; i < railData.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(railData.length, i + Math.floor(windowSize / 2) + 1);

    let sum = 0;
    let count = 0;

    for (let j = start; j < end; j++) {
      sum += railData[j].value;
      count++;
    }

    smoothedData.push({
      distance: railData[i].distance,
      value: count > 0 ? sum / count : railData[i].value
    });
  }

  return smoothedData;
}

/**
 * 統計情報を計算
 * @param {Array} data - データ配列
 * @returns {Object} 統計情報
 */
function calculateStatistics(data) {
  if (!data || data.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0
    };
  }

  const values = data.map(d => d.value).filter(v => !isNaN(v));

  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const variance = values.reduce((sum, val) =>
    sum + Math.pow(val - mean, 2), 0
  ) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: values.length,
    min,
    max,
    mean,
    stdDev
  };
}

module.exports = {
  parseKiyaO010,
  convertToPlanLineData,
  calculateStatistics
};
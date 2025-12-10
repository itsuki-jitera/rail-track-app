/**
 * O010*.csv (旧測定データ) ファイルパーサー
 *
 * ファイル形式:
 * - 1行目: ヘッダー情報（日付、コース、範囲等）
 * - 2行目以降: 測定データ（タイプ13/14、位置、複数測定値）
 *
 * データ例:
 * 2006/11/02, 0102,01,+074.000,03,+000.000,4,0,9540D
 * 13,03,06,61677152,229,B,2,2,+073.570,K,+006.0, +006.0, +004.0, +003.0, +004.0, +001.0, +001.0, 146309, 142243
 * 14,03,06,61677152,229,B,2,2,+073.570,K,+015.9, +016.0, +013.8, +013.1, +013.3, +009.9, +019.0, 146309, 142243
 */

import iconv from 'iconv-lite';

/**
 * O010*.csvファイルを解析
 * @param {Buffer} buffer - CSVファイルのバッファ
 * @returns {Object} 解析結果
 */
export function parseO010CSV(buffer) {
  try {
    // Shift-JISとしてデコード（旧データのため）
    const content = iconv.decode(buffer, 'Shift_JIS');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('ファイルが空です');
    }

    // ヘッダー行を解析
    const header = parseHeaderLine(lines[0]);

    // 測定データを解析
    const measurements = [];
    for (let i = 1; i < lines.length; i++) {
      const measurement = parseMeasurementLine(lines[i], i + 1);
      if (measurement) {
        measurements.push(measurement);
      }
    }

    return {
      success: true,
      data: {
        header,
        measurements,
        totalRecords: measurements.length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ヘッダー行を解析
 * @param {string} line - ヘッダー行
 * @returns {Object} ヘッダー情報
 */
function parseHeaderLine(line) {
  const parts = line.split(',').map(p => p.trim());

  return {
    measurementDate: parts[0] || null,      // 測定日
    course: parts[1] || null,                // コース
    section: parts[2] || null,               // セクション
    startKilometer: parseFloatSafe(parts[3]), // 開始キロ程
    endSection: parts[4] || null,
    endKilometer: parseFloatSafe(parts[5]),  // 終了キロ程
    rawHeader: line
  };
}

/**
 * 測定データ行を解析
 * @param {string} line - 測定データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object|null} 測定データ
 */
function parseMeasurementLine(line, lineNumber) {
  const parts = line.split(',').map(p => p.trim());

  if (parts.length < 10) {
    console.warn(`Line ${lineNumber}: 不正なデータ形式（カラム数不足）`);
    return null;
  }

  const measurementType = parts[0]; // 13 or 14

  // タイプ13: 基本測定値
  // タイプ14: 追加測定値
  if (measurementType !== '13' && measurementType !== '14') {
    console.warn(`Line ${lineNumber}: 不明な測定タイプ: ${measurementType}`);
    return null;
  }

  return {
    type: measurementType,
    lineNumber,
    field1: parts[1],
    field2: parts[2],
    trackId: parts[3],
    lineCode: parts[4],
    trackType: parts[5],
    field6: parts[6],
    field7: parts[7],
    kilometer: parseFloatSafe(parts[8]), // キロ程
    marker: parts[9],
    // 測定値（10列目以降）
    measurements: extractMeasurements(parts.slice(10)),
    rawLine: line
  };
}

/**
 * 測定値を抽出
 * @param {Array<string>} values - 測定値の配列
 * @returns {Object} 測定値オブジェクト
 */
function extractMeasurements(values) {
  const measurements = {
    values: [],
    parsed: {}
  };

  // 数値データを抽出
  values.forEach((val, index) => {
    const num = parseFloatSafe(val);
    measurements.values.push(num);

    // 測定項目を推測（仮の命名）
    // 実際の仕様書が必要
    if (index < 7) {
      const fieldNames = [
        'elevation_left',    // 高低（左）
        'elevation_right',   // 高低（右）
        'level_left',        // 水準（左）
        'level_right',       // 水準（右）
        'alignment_left',    // 通り（左）
        'alignment_right',   // 通り（右）
        'gauge'              // 軌間
      ];
      if (fieldNames[index]) {
        measurements.parsed[fieldNames[index]] = num;
      }
    }
  });

  return measurements;
}

/**
 * 安全にfloat値をパース
 * @param {string} value - 数値文字列
 * @returns {number|null}
 */
function parseFloatSafe(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const cleaned = value.replace(/^\+/, ''); // 先頭の+を削除
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * O010*.csvファイルを標準フォーマットに変換
 * @param {Object} o010Data - parseO010CSV の結果
 * @returns {Array} 標準フォーマットのデータ配列
 */
export function convertToStandardFormat(o010Data) {
  if (!o010Data.success || !o010Data.data.measurements) {
    return [];
  }

  const standardData = [];

  // タイプ13とタイプ14をグループ化してマージ
  const grouped = groupMeasurementsByPosition(o010Data.data.measurements);

  grouped.forEach(group => {
    const dataPoint = {
      distance: group.kilometer * 1000, // kmをmに変換
      measurements: {}
    };

    // タイプ13のデータ
    if (group.type13) {
      Object.assign(dataPoint.measurements, group.type13.measurements.parsed);
    }

    // タイプ14のデータ（存在する場合）
    if (group.type14) {
      // タイプ14の測定値をマージ（必要に応じて）
      Object.keys(group.type14.measurements.parsed).forEach(key => {
        dataPoint.measurements[`${key}_type14`] = group.type14.measurements.parsed[key];
      });
    }

    standardData.push(dataPoint);
  });

  return standardData;
}

/**
 * 測定データを位置でグループ化
 * @param {Array} measurements - 測定データ配列
 * @returns {Array} グループ化されたデータ
 */
function groupMeasurementsByPosition(measurements) {
  const grouped = {};

  measurements.forEach(m => {
    const key = m.kilometer;
    if (!grouped[key]) {
      grouped[key] = {
        kilometer: m.kilometer
      };
    }

    if (m.type === '13') {
      grouped[key].type13 = m;
    } else if (m.type === '14') {
      grouped[key].type14 = m;
    }
  });

  return Object.values(grouped);
}

/**
 * O010*.csvファイルかチェック
 * @param {Buffer} buffer - ファイルバッファ
 * @returns {boolean}
 */
export function isValidO010CSV(buffer) {
  try {
    const content = iconv.decode(buffer, 'Shift_JIS');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      return false;
    }

    // 2行目が測定データ（13 or 14で始まる）かチェック
    const secondLine = lines[1].trim();
    return secondLine.startsWith('13,') || secondLine.startsWith('14,');
  } catch {
    return false;
  }
}

export default {
  parseO010CSV,
  convertToStandardFormat,
  isValidO010CSV
};

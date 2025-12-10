/**
 * O010データを標準形式に変換
 * Convert O010 data to standard format
 */

/**
 * O010解析結果を複数測定項目データ形式に変換
 * @param {Object} o010Result - O010パーサーの結果
 * @returns {Array} 標準形式のデータ配列
 */
function convertO010ToStandard(o010Result) {
  if (!o010Result || !o010Result.success || !o010Result.data) {
    return [];
  }

  // measurementsプロパティを使用
  const { measurements } = o010Result.data;

  if (!Array.isArray(measurements) || measurements.length === 0) {
    return [];
  }

  // O010データを標準形式に変換
  // O010形式では各行が測定点を表す
  return measurements.map(record => {
    // O010パーサーのmeasurements.parsedから実際の測定値を取得
    const parsedMeasurements = record.measurements?.parsed || {};

    // O010レコード形式に基づいてマッピング
    const measurementData = {
      // O010パーサーで定義されたフィールド名を使用
      versine_left: parsedMeasurements.elevation_left || null,      // 左高低
      versine_right: parsedMeasurements.elevation_right || null,    // 右高低
      lateral_left: parsedMeasurements.alignment_left || null,      // 左通り
      lateral_right: parsedMeasurements.alignment_right || null,    // 右通り
      gauge: parsedMeasurements.gauge || null,                      // 軌間
      cross_level: parsedMeasurements.level_left || null,          // 水準（左）
      twist: parsedMeasurements.level_right || null,               // ねじれ/水準（右）

      // 生の測定値配列からの追加項目（必要に応じて）
      pitch: record.measurements?.values?.[7] || null,              // ピッチ
      longitudinal_level: record.measurements?.values?.[8] || null, // 長波高低
      alignment: record.measurements?.values?.[9] || null           // 長波通り
    };

    // nullではない測定値のみを含むオブジェクトを作成
    const validMeasurements = {};
    for (const [key, value] of Object.entries(measurementData)) {
      if (value !== null && value !== undefined) {
        // 数値に変換（文字列の場合）
        validMeasurements[key] = typeof value === 'string' ? parseFloat(value) : value;
      }
    }

    return {
      distance: (record.kilometer || 0) * 1000,  // kmをmに変換
      position: {
        kilometer: record.kilometer || null,
        meter: null,
        latitude: null,
        longitude: null
      },
      measurements: validMeasurements,
      metadata: {
        type: record.type,
        lineNumber: record.lineNumber,
        trackId: record.trackId,
        lineCode: record.lineCode,
        trackType: record.trackType,
        marker: record.marker
      }
    };
  });
}

module.exports = {
  convertO010ToStandard
};
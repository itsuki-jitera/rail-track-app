/**
 * Excelエクスポート機能の実装
 * VBシステムのExcel出力を再実装
 */

import XLSX from 'xlsx';

/**
 * 軌道データをExcelファイルにエクスポート
 * @param {Array} data - 軌道データ配列
 * @param {Object} options - エクスポートオプション
 * @returns {Buffer} Excelファイルのバッファ
 */
export function exportToExcel(data, options = {}) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  // ワークブックを作成
  const workbook = XLSX.utils.book_new();

  // ========== シート1: 軌道データ ==========
  const dataSheet = createDataSheet(data, options);
  XLSX.utils.book_append_sheet(workbook, dataSheet, '軌道データ');

  // ========== シート2: 統計情報 ==========
  if (options.statistics) {
    const statsSheet = createStatisticsSheet(options.statistics, options);
    XLSX.utils.book_append_sheet(workbook, statsSheet, '統計情報');
  }

  // ========== シート3: ピーク情報 ==========
  if (options.peaks && options.peaks.length > 0) {
    const peaksSheet = createPeaksSheet(options.peaks, options);
    XLSX.utils.book_append_sheet(workbook, peaksSheet, 'ピーク情報');
  }

  // ========== シート4: MTT値 ==========
  if (options.mttResults) {
    const mttSheet = createMTTSheet(options.mttResults, options);
    XLSX.utils.book_append_sheet(workbook, mttSheet, 'MTT値');
  }

  // Excelファイルとして書き出し
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return buffer;
}

/**
 * データシートを作成
 * @param {Array} data - 軌道データ
 * @param {Object} options - オプション
 * @returns {Object} ワークシート
 */
function createDataSheet(data, options) {
  // ヘッダー行を作成
  const headers = ['距離 (m)', '軌道狂い量 (mm)'];

  if (data[0].cant !== undefined) {
    headers.push('カント (mm)');
  }
  if (data[0].slack !== undefined) {
    headers.push('スラック (mm)');
  }
  if (data[0].bcValue !== undefined) {
    headers.push('BC値 (mm)');
  }
  if (data[0].cdValue !== undefined) {
    headers.push('CD値 (mm)');
  }

  // データ行を作成
  const rows = data.map(point => {
    const row = [point.distance, point.irregularity];

    if (point.cant !== undefined) row.push(point.cant);
    if (point.slack !== undefined) row.push(point.slack);
    if (point.bcValue !== undefined) row.push(point.bcValue);
    if (point.cdValue !== undefined) row.push(point.cdValue);

    return row;
  });

  // ヘッダーとデータを結合
  const wsData = [headers, ...rows];

  // ワークシートを作成
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 列幅を設定
  const colWidths = headers.map(() => ({ wch: 15 }));
  ws['!cols'] = colWidths;

  return ws;
}

/**
 * 統計情報シートを作成
 * @param {Object} statistics - 統計情報
 * @param {Object} options - オプション
 * @returns {Object} ワークシート
 */
function createStatisticsSheet(statistics, options) {
  const wsData = [
    ['軌道データ統計情報'],
    [],
    ['項目', '値', '単位'],
    ['最小値', statistics.min, 'mm'],
    ['最大値', statistics.max, 'mm'],
    ['平均値', statistics.avg, 'mm'],
    ['標準偏差', statistics.stdDev, 'mm'],
    [],
    ['データ点数', options.dataPoints || 0, 'points'],
    ['測定日', options.measurementDate || new Date().toISOString().split('T')[0], ''],
    ['線路名', options.lineName || '未指定', ''],
    ['区間', options.section || '未指定', '']
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // スタイル設定（タイトル行を太字に）
  ws['A1'].s = { font: { bold: true, sz: 14 } };

  // 列幅
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }];

  return ws;
}

/**
 * ピーク情報シートを作成
 * @param {Array} peaks - ピーク配列
 * @param {Object} options - オプション
 * @returns {Object} ワークシート
 */
function createPeaksSheet(peaks, options) {
  const headers = ['インデックス', '距離 (m)', '値 (mm)', 'タイプ', '突出度 (mm)'];

  const rows = peaks.map(peak => [
    peak.index,
    peak.distance,
    peak.value,
    peak.type === 'maximum' ? '極大値' : '極小値',
    peak.prominence || '-'
  ]);

  const wsData = [
    ['ピーク検出結果'],
    [],
    headers,
    ...rows,
    [],
    ['検出ピーク数', peaks.length, '個']
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['A1'].s = { font: { bold: true, sz: 14 } };
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];

  return ws;
}

/**
 * MTT値シートを作成
 * @param {Object} mttResults - MTT計算結果
 * @param {Object} options - オプション
 * @returns {Object} ワークシート
 */
function createMTTSheet(mttResults, options) {
  if (!mttResults.success) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['MTT値計算結果'],
      [],
      ['エラー', mttResults.error || '計算に失敗しました']
    ]);
    return ws;
  }

  // データ行
  const headers = ['距離 (m)', '測定値 (mm)', 'カント (mm)', 'スラック (mm)',
                    'カント補正 (mm)', 'スラック補正 (mm)', 'BC値 (mm)', 'CD値 (mm)'];

  const rows = mttResults.results.map(result => [
    result.distance,
    result.measured,
    result.cant,
    result.slack,
    result.cantCorrection,
    result.slackCorrection,
    result.bcValue,
    result.cdValue
  ]);

  // 統計情報
  const statsRows = [
    [],
    ['BC値統計'],
    ['最小値', mttResults.statistics.bc.min, 'mm'],
    ['最大値', mttResults.statistics.bc.max, 'mm'],
    ['平均値', mttResults.statistics.bc.avg, 'mm'],
    ['標準偏差', mttResults.statistics.bc.stdDev, 'mm'],
    [],
    ['CD値統計'],
    ['最小値', mttResults.statistics.cd.min, 'mm'],
    ['最大値', mttResults.statistics.cd.max, 'mm'],
    ['平均値', mttResults.statistics.cd.avg, 'mm'],
    ['標準偏差', mttResults.statistics.cd.stdDev, 'mm'],
    [],
    ['計算パラメータ'],
    ['BC補正係数', mttResults.parameters.bcCoefficient],
    ['CD補正係数', mttResults.parameters.cdCoefficient],
    ['カント補正係数', mttResults.parameters.cantCorrectionCoeff],
    ['スラック補正係数', mttResults.parameters.slackCorrectionCoeff]
  ];

  const wsData = [
    ['MTT値計算結果'],
    [],
    headers,
    ...rows,
    ...statsRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['A1'].s = { font: { bold: true, sz: 14 } };
  ws['!cols'] = headers.map(() => ({ wch: 15 }));

  return ws;
}

/**
 * CSV形式でエクスポート
 * @param {Array} data - 軌道データ配列
 * @param {Object} options - オプション
 * @returns {string} CSV文字列
 */
export function exportToCSV(data, options = {}) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  // ヘッダー行
  let csv = '距離 (m), 軌道狂い量 (mm)';

  if (data[0].cant !== undefined) {
    csv += ', カント (mm)';
  }
  if (data[0].slack !== undefined) {
    csv += ', スラック (mm)';
  }
  if (data[0].bcValue !== undefined) {
    csv += ', BC値 (mm)';
  }
  if (data[0].cdValue !== undefined) {
    csv += ', CD値 (mm)';
  }

  csv += '\n';

  // データ行
  data.forEach(point => {
    csv += `${point.distance}, ${point.irregularity}`;

    if (point.cant !== undefined) csv += `, ${point.cant}`;
    if (point.slack !== undefined) csv += `, ${point.slack}`;
    if (point.bcValue !== undefined) csv += `, ${point.bcValue}`;
    if (point.cdValue !== undefined) csv += `, ${point.cdValue}`;

    csv += '\n';
  });

  return csv;
}

/**
 * JSON形式でエクスポート
 * @param {Object} exportData - エクスポートデータ
 * @returns {string} JSON文字列
 */
export function exportToJSON(exportData) {
  return JSON.stringify(exportData, null, 2);
}

/**
 * エクスポート形式に応じて適切な関数を呼び出す
 * @param {Object} exportData - エクスポートデータ
 * @param {string} format - フォーマット ('excel', 'csv', 'json')
 * @returns {Buffer|string} エクスポート結果
 */
export function exportData(exportData, format = 'excel') {
  switch (format.toLowerCase()) {
    case 'excel':
    case 'xlsx':
      return exportToExcel(exportData.data, exportData.options || {});

    case 'csv':
      return exportToCSV(exportData.data, exportData.options || {});

    case 'json':
      return exportToJSON(exportData);

    default:
      throw new Error(`未対応のフォーマット: ${format}`);
  }
}

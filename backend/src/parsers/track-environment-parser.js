/**
 * 軌道環境データパーサー
 * Track Environment Data Parser
 *
 * LABOCS形式(.TBL/.DDB)の軌道環境データを解析
 *
 * サポートするデータ項目:
 * - EM: 駅名データ
 * - JS: こう配データ（縦断線形）
 * - HS: 曲線データ（平面線形）
 * - KR: 構造物・路盤データ
 * - RT/RU: レール継目データ（左/右）
 * - DS: 道床データ
 * - BK: 分岐器データ
 * - EJ: EJデータ
 * - IJ: IJデータ
 */

const iconv = require('iconv-lite');

/**
 * ファイル名から情報を抽出
 * 例: TKD014KR.TBL
 * @param {string} filename - ファイル名
 * @returns {Object} - ファイル情報
 */
function parseFilename(filename) {
  const name = filename.replace(/\.(TBL|DDB)$/i, '');

  return {
    lineName: name.substring(0, 2),        // 線名
    lineType: name.substring(2, 3),        // 線別 (D:下り, R:上り)
    section: name.substring(3, 4),         // 区間別
    updateYear: name.substring(4, 5),      // 更新年
    updateMonth: name.substring(5, 6),     // 更新月
    dataType: name.substring(6, 8),        // データ項目
    filename: filename
  };
}

/**
 * データ項目の名称を取得
 * @param {string} dataType - データ項目コード
 * @returns {string} - データ項目名
 */
function getDataTypeName(dataType) {
  const dataTypes = {
    'EM': '駅名データ',
    'JS': 'こう配データ（縦断線形）',
    'HS': '曲線データ（平面線形）',
    'KR': '構造物・路盤データ',
    'RL': 'レールデータ（左）',
    'RR': 'レールデータ（右）',
    'RT': 'レール継目データ（左）',
    'RU': 'レール継目データ（右）',
    'LR': 'ロングレールデータ',
    'GL': 'ガードレールデータ（左）',
    'GR': 'ガードレールデータ（右）',
    'MT': 'まくらぎ・締結装置データ',
    'DS': '道床データ',
    'BK': '分岐器データ',
    'EJ': 'EJデータ',
    'IJ': 'IJデータ'
  };

  return dataTypes[dataType] || '不明なデータ型';
}

/**
 * TBLファイルを解析
 * @param {Buffer} buffer - TBLファイルのバッファ
 * @param {string} dataType - データ項目コード
 * @returns {Object} - 解析結果
 */
function parseTBL(buffer, dataType) {
  try {
    // Shift-JISでデコード
    const content = iconv.decode(buffer, 'Shift_JIS');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    const parser = getParserForType(dataType);
    const records = lines.map((line, index) => {
      try {
        return parser(line, index + 1);
      } catch (error) {
        console.warn(`Line ${index + 1} parse warning:`, error.message);
        return null;
      }
    }).filter(record => record !== null);

    return {
      success: true,
      dataType,
      dataTypeName: getDataTypeName(dataType),
      recordCount: records.length,
      records
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * データ型に応じたパーサーを取得
 * @param {string} dataType - データ項目コード
 * @returns {Function} - パーサー関数
 */
function getParserForType(dataType) {
  const parsers = {
    'EM': parseStationData,
    'JS': parseGradientData,
    'HS': parseCurveData,
    'KR': parseStructureData,
    'RT': parseJointData,
    'RU': parseJointData,
    'DS': parseBallastData,
    'BK': parseTurnoutData,
    'EJ': parseEJData,
    'IJ': parseIJData
  };

  return parsers[dataType] || parseGenericData;
}

/**
 * 駅名データ解析 (LABOCS 51. 地点型一般データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseStationData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'station',
    kilometer: parseFloat(fields[1]) / 1000 || 0, // メートル→km
    value: parseFloat(fields[2]) || 1.0,
    stationName: fields[3] || ''
  };
}

/**
 * こう配データ解析 (LABOCS 1. こう配データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseGradientData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'gradient',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    profileType: parseInt(fields[4]) || 1, // 1:勾配, 2:レベル
    curveRadius: parseInt(fields[5]) || 0, // 縦曲線半径(m)
    gradient: parseFloat(fields[6]) || 0.0 // 千分率
  };
}

/**
 * 曲線データ解析 (LABOCS 112. 曲線データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseCurveData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'curve',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    btcKm: parseFloat(fields[5]) / 1000 || 0, // BTC (Begin of Transition Curve)
    bccKm: parseFloat(fields[7]) / 1000 || 0, // BCC (Begin of Circular Curve)
    eccKm: parseFloat(fields[9]) / 1000 || 0, // ECC (End of Circular Curve)
    etcKm: parseFloat(fields[11]) / 1000 || 0, // ETC (End of Transition Curve)
    direction: fields[12] || '', // 左/右
    radius: parseInt(fields[13]) || 0,
    curveLength: parseInt(fields[14]) || 0,
    circularLength: parseInt(fields[15]) || 0,
    cant: parseInt(fields[16]) || 0,
    slack: parseInt(fields[17]) || 0,
    transitionStart: parseInt(fields[18]) || 0,
    transitionStartType: fields[19] || '',
    transitionEnd: parseInt(fields[20]) || 0,
    transitionEndType: fields[21] || ''
  };
}

/**
 * 構造物データ解析 (LABOCS 101. 区間型西日本データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseStructureData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'structure',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    value: parseFloat(fields[4]) || 0,
    text1: fields[5] || '',
    text2: fields[6] || '',
    text3: fields[7] || '',
    length: parseInt(fields[8]) || 0,
    structureType: fields[9] || '', // 橋梁(PC)、トンネル等
    structureName: fields[10] || '',
    note1: fields[11] || '',
    note2: fields[12] || ''
  };
}

/**
 * レール継目データ解析 (LABOCS 115. レール継目データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseJointData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'joint',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    value: parseFloat(fields[4]) || 1.0,
    jointType: fields[5] || '',
    jointNumber: fields[6] || '',
    kilometer: fields[7] || '',
    length: parseInt(fields[8]) || 0,
    number: fields[9] || '',
    bothSide: fields[10] || '', // 両側/片側
    method: fields[11] || '', // 支え継ぎ/かけ継ぎ
    category: fields[12] || '', // 溶接継目等
    kind: fields[13] || '', // フラッシュバット等
    weldDate: fields[14] || '',
    fastening: fields[15] || ''
  };
}

/**
 * 道床データ解析 (LABOCS 101. 区間型西日本データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseBallastData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'ballast',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    value: parseFloat(fields[4]) || 0,
    text1: fields[5] || '',
    text2: fields[6] || '',
    text3: fields[7] || '',
    length: parseInt(fields[8]) || 0,
    ballastType: fields[9] || '', // 砕石(良好)等
    thickness: fields[10] || '',  // 道床厚(mm)
    crossSection: fields[11] || '', // 断面形状
    surplus: fields[12] || '',      // 余盛
    shoulderWidth: fields[13] || '', // 道床肩幅
    specialMethod: fields[14] || '', // 特殊工法
    replacementMethod: fields[15] || '', // 交換工法
    replacementYear: fields[16] || '',
    note1: fields[17] || '',
    note2: fields[18] || ''
  };
}

/**
 * 分岐器データ解析 (LABOCS 101. 区間型西日本データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseTurnoutData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'turnout',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    value: parseFloat(fields[4]) || 1.0,
    text1: fields[5] || '',
    text2: fields[6] || '',
    text3: fields[7] || '',
    length: parseInt(fields[8]) || 0,
    turnoutNumber: fields[9] || '',
    number: fields[10] || '', // 番数
    shape: fields[11] || '',  // 形状
    special: fields[12] || '', // 特定分岐器
    railWeight: fields[13] || '',
    weightCategory: fields[14] || '',
    propertyType: fields[15] || '',
    drawingNumber: fields[16] || '',
    point: fields[17] || '',
    crossing: fields[18] || '',
    leftGuard: fields[19] || '',
    rightGuard: fields[20] || '',
    leftRight: fields[21] || '', // 左/右
    newUsed: fields[22] || '', // 新/再
    distributionRate: fields[23] || '',
    installDate: fields[24] || '',
    baseRadius: fields[25] || '',
    switchingDevice: fields[26] || '',
    snowMelting: fields[27] || '',
    snowMeltingType: fields[28] || '',
    pGuard: fields[29] || '',
    faceToBack: fields[30] || '',
    speedBase: fields[31] || '',
    speedBranch: fields[32] || '',
    annualTonnageBase: fields[33] || '',
    annualTonnageBranch: fields[34] || '',
    note1: fields[35] || '',
    note2: fields[36] || ''
  };
}

/**
 * EJデータ解析 (LABOCS 101. 区間型西日本データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseEJData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'ej',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    value: parseFloat(fields[4]) || 1.0,
    text1: fields[5] || '',
    text2: fields[6] || '',
    text3: fields[7] || '',
    length: parseInt(fields[8]) || 0,
    railWeight: fields[9] || '',
    newUsed: fields[10] || '',
    ejType: fields[11] || '',
    currentRadius: fields[12] || '',
    expansionRadius: fields[13] || '',
    ejDirection: fields[14] || '',
    weldStart: fields[15] || '',
    weldEnd: fields[16] || '',
    sleeper: fields[17] || '',
    installDate: fields[18] || '',
    drawingNumber: fields[19] || '',
    note1: fields[20] || '',
    note2: fields[21] || ''
  };
}

/**
 * IJデータ解析 (LABOCS 101. 区間型西日本データ)
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseIJData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'ij',
    from: parseFloat(fields[1]) / 1000 || 0,
    to: parseFloat(fields[3]) / 1000 || 0,
    value: parseFloat(fields[4]) || 1.0,
    text1: fields[5] || '',
    text2: fields[6] || '',
    text3: fields[7] || '',
    length: parseInt(fields[8]) || 0,
    manufacturingMethod: fields[9] || '',
    currentRadius: fields[10] || '',
    ijType: fields[11] || '',
    heatTreatment: fields[12] || '',
    weldStart: fields[13] || '',
    weldEnd: fields[14] || '',
    installDate: fields[15] || '',
    note1: fields[16] || '',
    note2: fields[17] || ''
  };
}

/**
 * 汎用データ解析
 * @param {string} line - データ行
 * @param {number} lineNumber - 行番号
 * @returns {Object} - 解析結果
 */
function parseGenericData(line) {
  const fields = line.split(',').map(f => f.trim());

  return {
    type: 'generic',
    fields: fields,
    fieldCount: fields.length
  };
}

/**
 * 軌道環境データファイルを解析
 * @param {Buffer} buffer - ファイルバッファ
 * @param {string} filename - ファイル名
 * @returns {Object} - 解析結果
 */
export function parseTrackEnvironmentData(buffer, filename) {
  const fileInfo = parseFilename(filename);
  const result = parseTBL(buffer, fileInfo.dataType);

  return {
    ...result,
    fileInfo,
    parsedAt: new Date().toISOString()
  };
}

/**
 * ファイル名をバリデーション
 * @param {string} filename - ファイル名
 * @returns {boolean} - 有効かどうか
 */
export function isValidTrackEnvironmentFile(filename) {
  const pattern = /^[A-Z]{2}[DR][0-9][0-9A-Z][0-9A-Z][A-Z]{2}\.(TBL|DDB)$/i;
  return pattern.test(filename);
}

/**
 * サポートされているデータ型のリストを取得
 * @returns {Array} - データ型リスト
 */
export function getSupportedDataTypes() {
  return [
    { code: 'EM', name: '駅名データ', required: false },
    { code: 'JS', name: 'こう配データ（縦断線形）', required: true },
    { code: 'HS', name: '曲線データ（平面線形）', required: true },
    { code: 'KR', name: '構造物・路盤データ', required: true },
    { code: 'RL', name: 'レールデータ（左）', required: false },
    { code: 'RR', name: 'レールデータ（右）', required: false },
    { code: 'RT', name: 'レール継目データ（左）', required: true },
    { code: 'RU', name: 'レール継目データ（右）', required: true },
    { code: 'LR', name: 'ロングレールデータ', required: false },
    { code: 'GL', name: 'ガードレールデータ（左）', required: false },
    { code: 'GR', name: 'ガードレールデータ（右）', required: false },
    { code: 'MT', name: 'まくらぎ・締結装置データ', required: false },
    { code: 'DS', name: '道床データ', required: true },
    { code: 'BK', name: '分岐器データ', required: true },
    { code: 'EJ', name: 'EJデータ', required: true },
    { code: 'IJ', name: 'IJデータ', required: true }
  ];
}

export default {
  parseTrackEnvironmentData,
  isValidTrackEnvironmentFile,
  getSupportedDataTypes,
  parseFilename,
  getDataTypeName
};

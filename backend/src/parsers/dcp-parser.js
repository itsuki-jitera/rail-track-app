/**
 * DCPフォーマットパーサー
 * 全項目一括データファイル（バイナリ形式）
 *
 * ファイル構造:
 * - ヘッダー部: 可変長（テキスト形式）
 * - データ部: バイナリ形式
 *   - 各項目が連続して格納
 *   - 項目ごとにデータ型が異なる（Float32 or Uint8）
 *
 * 含まれる測定項目:
 * - 通り右 10m弦 (5C)
 * - 通り左 10m弦 (6C)
 * - 高低右 10m弦 (1C)
 * - 高低左 10m弦 (2C)
 * - 偏心矢右 (3C)
 * - 偏心矢左 (4C)
 * - 軌間 (GC)
 * - 水準 (SC)
 * - 勾配 (BC)
 * - ATS検知 (AC)
 * - 1km検知 (PC)
 * - 継目検知左 (RC)
 */

const { EncodingDetector } = require('../utils/encoding-detector');

class DCPParser {
  constructor() {
    // データ項目定義（順序重要）
    this.ITEM_DEFINITIONS = [
      { key: 'alignment10mRight', code: '5C', name: '通り右 10m弦', type: 'float', size: 4 },
      { key: 'alignment10mLeft', code: '6C', name: '通り左 10m弦', type: 'float', size: 4 },
      { key: 'level10mRight', code: '1C', name: '高低右 10m弦', type: 'float', size: 4 },
      { key: 'level10mLeft', code: '2C', name: '高低左 10m弦', type: 'float', size: 4 },
      { key: 'eccentricRight', code: '3C', name: '偏心矢右', type: 'float', size: 4 },
      { key: 'eccentricLeft', code: '4C', name: '偏心矢左', type: 'float', size: 4 },
      { key: 'gauge', code: 'GC', name: '軌間', type: 'float', size: 4 },
      { key: 'crossLevel', code: 'SC', name: '水準', type: 'float', size: 4 },
      { key: 'slope', code: 'BC', name: '勾配', type: 'float', size: 4 },
      { key: 'atsMarker', code: 'AC', name: 'ATS検知', type: 'uint8', size: 1 },
      { key: 'kmMarker', code: 'PC', name: '1km検知', type: 'uint8', size: 1 },
      { key: 'jointMarkerLeft', code: 'RC', name: '継目検知左', type: 'uint8', size: 1 }
    ];

    this.HEADER_END_MARKER = '\x1A'; // Ctrl+Z (ヘッダー終端マーカー)
  }

  /**
   * DCPファイルをパースする
   * @param {Buffer} buffer - DCPファイルのバッファ
   * @returns {DCPData} パース結果
   */
  parse(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer');
    }

    // ヘッダー部とデータ部を分離
    const headerEndIndex = this.findHeaderEnd(buffer);

    if (headerEndIndex === -1) {
      throw new Error('Header end marker not found');
    }

    const headerBuffer = buffer.slice(0, headerEndIndex);
    const dataBuffer = buffer.slice(headerEndIndex + 1);

    // ヘッダー解析
    const header = this.parseHeader(headerBuffer);

    // データ部解析
    const items = this.parseData(dataBuffer, header.dataPoints);

    return {
      header,
      items
    };
  }

  /**
   * ヘッダー終端位置を検索
   * @param {Buffer} buffer - ファイルバッファ
   * @returns {number} ヘッダー終端のインデックス（見つからない場合は-1）
   */
  findHeaderEnd(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x1A) { // Ctrl+Z
        return i;
      }
    }
    return -1;
  }

  /**
   * ヘッダー部を解析
   * @param {Buffer} headerBuffer - ヘッダーバッファ
   * @returns {DCPFileHeader} ヘッダー情報
   */
  parseHeader(headerBuffer) {
    // エンコーディング検出
    const detector = new EncodingDetector();
    const encoding = detector.detect(headerBuffer);
    const content = headerBuffer.toString(encoding === 'shift_jis' ? 'utf8' : encoding);

    // 行ごとに分割
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    const header = {
      fileId: '',
      lineCode: '',
      direction: '',
      measurementDate: null,
      startKm: 0,
      endKm: 0,
      dataPoints: 0,
      trainType: '',
      samplingInterval: 0.25
    };

    // キー=値 形式のヘッダーをパース
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();

      if (!key || !value) continue;

      const trimmedKey = key.trim();

      switch (trimmedKey) {
        case 'FILE_ID':
        case 'ファイルID':
          header.fileId = value;
          // ファイルIDから路線コード、上下区分を抽出
          if (value.length >= 3) {
            header.lineCode = value.substring(0, 2);
            header.direction = value.substring(2, 3);
          }
          break;

        case 'LINE_CODE':
        case '路線コード':
          header.lineCode = value;
          break;

        case 'DIRECTION':
        case '上下区分':
          header.direction = value;
          break;

        case 'MEASUREMENT_DATE':
        case '測定日':
          header.measurementDate = this.parseDateString(value);
          break;

        case 'START_KM':
        case '開始キロ程':
          header.startKm = parseFloat(value);
          break;

        case 'END_KM':
        case '終了キロ程':
          header.endKm = parseFloat(value);
          break;

        case 'DATA_POINTS':
        case 'データ点数':
          header.dataPoints = parseInt(value, 10);
          break;

        case 'TRAIN_TYPE':
        case '車両種別':
          header.trainType = value;
          break;

        case 'SAMPLING_INTERVAL':
        case 'サンプリング間隔':
          header.samplingInterval = parseFloat(value);
          break;
      }
    }

    return header;
  }

  /**
   * データ部を解析
   * @param {Buffer} dataBuffer - データバッファ
   * @param {number} dataPoints - データ点数
   * @returns {Object.<string, Float32Array|Uint8Array>} 項目別データ
   */
  parseData(dataBuffer, dataPoints) {
    const items = {};
    let offset = 0;

    // 各項目を順番に読み込む
    for (const itemDef of this.ITEM_DEFINITIONS) {
      const dataSize = dataPoints * itemDef.size;

      if (offset + dataSize > dataBuffer.length) {
        console.warn(`Insufficient data for ${itemDef.name} (${itemDef.key}), skipping`);
        break;
      }

      if (itemDef.type === 'float') {
        // Float32配列
        const data = new Float32Array(dataPoints);
        for (let i = 0; i < dataPoints; i++) {
          data[i] = dataBuffer.readFloatLE(offset + i * 4);
        }
        items[itemDef.key] = data;
      } else if (itemDef.type === 'uint8') {
        // Uint8配列（マーカー類）
        const data = new Uint8Array(dataPoints);
        for (let i = 0; i < dataPoints; i++) {
          data[i] = dataBuffer.readUInt8(offset + i);
        }
        items[itemDef.key] = data;
      }

      offset += dataSize;
    }

    return items;
  }

  /**
   * 日付文字列をパース
   * @param {string} dateStr - 日付文字列
   * @returns {Date|null} 日付オブジェクト
   */
  parseDateString(dateStr) {
    if (!dateStr) return null;

    try {
      // YYYY/MM/DD または YYYY-MM-DD 形式
      if (dateStr.includes('/') || dateStr.includes('-')) {
        const parts = dateStr.split(/[/-]/);
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
      }

      // YYYYMMDD 形式
      if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        return new Date(year, month, day);
      }

      return new Date(dateStr);
    } catch (error) {
      console.error('Date parse error:', error);
      return null;
    }
  }

  /**
   * DCPデータから指定項目を抽出
   * @param {DCPData} dcpData - DCPデータ
   * @param {string} itemKey - 項目キー (alignment10mRight, level10mLeft, etc.)
   * @returns {MeasurementData[]} 測定データ配列
   */
  extractItem(dcpData, itemKey) {
    const { header, items } = dcpData;

    if (!items[itemKey]) {
      throw new Error(`Item "${itemKey}" not found in DCP data`);
    }

    const data = items[itemKey];
    const result = [];

    for (let i = 0; i < data.length; i++) {
      const distance = header.startKm + i * header.samplingInterval;
      result.push({
        distance: parseFloat(distance.toFixed(2)),
        value: parseFloat(data[i].toFixed(3))
      });
    }

    return result;
  }

  /**
   * DCPデータから複数項目を統合
   * @param {DCPData} dcpData - DCPデータ
   * @param {string[]} itemKeys - 項目キー配列
   * @returns {MultiMeasurementData[]} 統合測定データ配列
   */
  extractMultipleItems(dcpData, itemKeys) {
    const { header, items } = dcpData;
    const result = [];

    const dataPoints = header.dataPoints;

    for (let i = 0; i < dataPoints; i++) {
      const distance = header.startKm + i * header.samplingInterval;
      const measurements = {};

      for (const itemKey of itemKeys) {
        if (items[itemKey]) {
          measurements[itemKey] = parseFloat(items[itemKey][i].toFixed(3));
        }
      }

      result.push({
        distance: parseFloat(distance.toFixed(2)),
        measurements
      });
    }

    return result;
  }

  /**
   * 項目定義を取得
   * @param {string} itemKey - 項目キー
   * @returns {Object|null} 項目定義
   */
  getItemDefinition(itemKey) {
    return this.ITEM_DEFINITIONS.find(item => item.key === itemKey) || null;
  }

  /**
   * 全項目定義を取得
   * @returns {Array} 項目定義配列
   */
  getAllItemDefinitions() {
    return [...this.ITEM_DEFINITIONS];
  }

  /**
   * データ項目コードから項目キーを取得
   * @param {string} code - データ項目コード (1C, 2C, 5C, etc.)
   * @returns {string|null} 項目キー
   */
  getItemKeyByCode(code) {
    const itemDef = this.ITEM_DEFINITIONS.find(item => item.code === code);
    return itemDef ? itemDef.key : null;
  }
}

module.exports = { DCPParser };

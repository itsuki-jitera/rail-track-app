/**
 * RSQフォーマットパーサー
 * 旧形式の検測データファイル（1ファイル構成、バイナリ形式）
 *
 * ファイル構造:
 * - ヘッダー: 2048 byte
 * - データ: 4 byte × データ点数（Float32）
 */

const { EncodingDetector } = require('../utils/encoding-detector');

class RSQParser {
  constructor() {
    this.HEADER_SIZE = 2048;
    this.DATA_SIZE_PER_POINT = 4; // Float32
  }

  /**
   * RSQファイルをパースする
   * @param {Buffer} buffer - RSQファイルのバッファ
   * @returns {RSQData} パース結果
   */
  parse(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer');
    }

    if (buffer.length < this.HEADER_SIZE) {
      throw new Error(`File too small. Expected at least ${this.HEADER_SIZE} bytes, got ${buffer.length}`);
    }

    // ヘッダー解析
    const header = this.parseHeader(buffer.slice(0, this.HEADER_SIZE));

    // データ部解析
    const dataBuffer = buffer.slice(this.HEADER_SIZE);
    const expectedDataSize = header.dataPoints * this.DATA_SIZE_PER_POINT;

    if (dataBuffer.length < expectedDataSize) {
      throw new Error(
        `Data size mismatch. Expected ${expectedDataSize} bytes for ${header.dataPoints} points, got ${dataBuffer.length} bytes`
      );
    }

    const data = this.parseData(dataBuffer, header.dataPoints);

    return {
      header,
      data
    };
  }

  /**
   * ヘッダー部をパースする（2048 byte）
   * @param {Buffer} headerBuffer - ヘッダーバッファ
   * @returns {RSQHeader} ヘッダー情報
   */
  parseHeader(headerBuffer) {
    // ヘッダーの文字列部分を抽出（Shift-JISの可能性）
    const detector = new EncodingDetector();
    const encoding = detector.detect(headerBuffer);

    // ファイルID（先頭8文字）: 例: "TKD014KC"
    const fileIdBuffer = headerBuffer.slice(0, 8);
    const fileId = this.decodeString(fileIdBuffer, encoding).trim();

    // 路線コード（1-2桁目）
    const lineCode = fileId.substring(0, 2);

    // 上下区分（3桁目）: D=下り, R=上り
    const direction = fileId.substring(2, 3);

    // データ項目（7-8桁目）: 1C, 2C, 5C, 6C, GC, SC, AC, BC, RC, PC
    const dataType = fileId.substring(6, 8);

    // 測定日（オフセット16から8byte、YYYYMMDD形式と仮定）
    const measurementDateStr = this.decodeString(headerBuffer.slice(16, 24), encoding).trim();
    const measurementDate = this.parseDateString(measurementDateStr);

    // データ点数（オフセット32から4byte、32bit整数）
    const dataPoints = headerBuffer.readInt32LE(32);

    // 開始キロ程（オフセット40から4byte、32bit整数、m単位）
    const startKilometer = headerBuffer.readInt32LE(40);

    // 終了キロ程（オフセット44から4byte、32bit整数、m単位）
    const endKilometer = headerBuffer.readInt32LE(44);

    // サンプリング間隔（m）- 通常は0.25m
    const samplingInterval = 0.25;

    return {
      fileId,
      lineCode,
      direction,
      measurementDate,
      startKilometer,
      endKilometer,
      dataType,
      dataPoints,
      samplingInterval
    };
  }

  /**
   * データ部をパースする（4byte Float × データ点数）
   * @param {Buffer} dataBuffer - データバッファ
   * @param {number} dataPoints - データ点数
   * @returns {Float32Array} データ配列
   */
  parseData(dataBuffer, dataPoints) {
    const data = new Float32Array(dataPoints);

    for (let i = 0; i < dataPoints; i++) {
      const offset = i * this.DATA_SIZE_PER_POINT;
      data[i] = dataBuffer.readFloatLE(offset);
    }

    return data;
  }

  /**
   * バッファから文字列をデコード
   * @param {Buffer} buffer - バッファ
   * @param {string} encoding - エンコーディング
   * @returns {string} デコードされた文字列
   */
  decodeString(buffer, encoding) {
    try {
      if (encoding === 'shift_jis') {
        // Shift-JISのデコードは外部ライブラリが必要
        // 簡易実装として、ASCIIとして扱う
        return buffer.toString('ascii');
      }
      return buffer.toString(encoding || 'utf8');
    } catch (error) {
      return buffer.toString('ascii');
    }
  }

  /**
   * 日付文字列をパース（YYYYMMDD形式）
   * @param {string} dateStr - 日付文字列
   * @returns {Date} 日付オブジェクト
   */
  parseDateString(dateStr) {
    if (!dateStr || dateStr.length < 8) {
      return null;
    }

    try {
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 0-indexed
      const day = parseInt(dateStr.substring(6, 8), 10);
      return new Date(year, month, day);
    } catch (error) {
      return null;
    }
  }

  /**
   * RSQデータを距離-値のペアの配列に変換
   * @param {RSQData} rsqData - RSQデータ
   * @returns {Array<{distance: number, value: number}>} 変換後のデータ
   */
  toMeasurementData(rsqData) {
    const { header, data } = rsqData;
    const result = [];

    for (let i = 0; i < data.length; i++) {
      const distance = header.startKilometer + i * header.samplingInterval;
      result.push({
        distance: parseFloat(distance.toFixed(2)),
        value: parseFloat(data[i].toFixed(3))
      });
    }

    return result;
  }

  /**
   * データ項目名を取得
   * @param {string} dataType - データ項目コード (1C, 2C, 5C, 6C, GC, SC, AC, BC, RC, PC)
   * @returns {string} データ項目名
   */
  getDataTypeName(dataType) {
    const dataTypeMap = {
      '1C': '高低右 10m弦',
      '2C': '高低左 10m弦',
      '3C': '偏心矢右',
      '4C': '偏心矢左',
      '5C': '通り右 10m弦',
      '6C': '通り左 10m弦',
      'GC': '軌間',
      'SC': '水準',
      'AC': 'ATS/計数中止',
      'BC': '勾配',
      'RC': '継目検知左',
      'PC': '1km検知'
    };

    return dataTypeMap[dataType] || dataType;
  }
}

module.exports = { RSQParser };

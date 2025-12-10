/**
 * HDR/DATフォーマットパーサー
 * 新形式の検測データファイル（2ファイル構成）
 *
 * ファイル構造:
 * - HDRファイル（ヘッダー）: テキスト形式
 * - DATファイル（データ）: バイナリ形式（4byte × データ点数）
 */

const { EncodingDetector } = require('../utils/encoding-detector');

class HDRDATParser {
  constructor() {
    this.DATA_SIZE_PER_POINT = 4; // Float32
  }

  /**
   * HDRファイルとDATファイルをパースする
   * @param {Buffer} hdrBuffer - HDRファイルのバッファ
   * @param {Buffer} datBuffer - DATファイルのバッファ
   * @returns {HDRDATData} パース結果
   */
  parse(hdrBuffer, datBuffer) {
    if (!Buffer.isBuffer(hdrBuffer) || !Buffer.isBuffer(datBuffer)) {
      throw new Error('Inputs must be Buffers');
    }

    // HDRファイル（ヘッダー）を解析
    const header = this.parseHeader(hdrBuffer);

    // DATファイル（データ）を解析
    const expectedDataSize = header.dataPoints * this.DATA_SIZE_PER_POINT;
    if (datBuffer.length < expectedDataSize) {
      throw new Error(
        `Data size mismatch. Expected ${expectedDataSize} bytes for ${header.dataPoints} points, got ${datBuffer.length} bytes`
      );
    }

    const data = this.parseData(datBuffer, header.dataPoints);

    return {
      header,
      data
    };
  }

  /**
   * HDRファイル（テキスト形式）を解析
   * @param {Buffer} hdrBuffer - HDRファイルのバッファ
   * @returns {HDRHeader} ヘッダー情報
   */
  parseHeader(hdrBuffer) {
    // エンコーディング検出
    const detector = new EncodingDetector();
    const encoding = detector.detect(hdrBuffer);
    const content = hdrBuffer.toString(encoding === 'shift_jis' ? 'utf8' : encoding);

    // 行ごとに分割
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    const header = {
      fileId: '',
      lineCode: '',
      direction: '',
      measurementDate: null,
      dataPoints: 0,
      dataType: '',
      metadata: {}
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
          // ファイルIDから路線コード、上下区分、データ項目を抽出
          if (value.length >= 8) {
            header.lineCode = value.substring(0, 2);
            header.direction = value.substring(2, 3);
            header.dataType = value.substring(6, 8);
          }
          break;

        case 'MEASUREMENT_DATE':
        case '測定日':
          header.measurementDate = this.parseDateString(value);
          break;

        case 'DATA_POINTS':
        case 'データ点数':
          header.dataPoints = parseInt(value, 10);
          break;

        case 'START_KM':
        case '開始キロ程':
          header.metadata.startKilometer = parseFloat(value);
          break;

        case 'END_KM':
        case '終了キロ程':
          header.metadata.endKilometer = parseFloat(value);
          break;

        case 'SAMPLING_INTERVAL':
        case 'サンプリング間隔':
          header.metadata.samplingInterval = parseFloat(value);
          break;

        case 'LINE_NAME':
        case '路線名':
          header.metadata.lineName = value;
          break;

        case 'DATA_TYPE':
        case 'データ項目':
          header.dataType = value;
          break;

        default:
          // その他のメタデータ
          header.metadata[trimmedKey] = value;
          break;
      }
    }

    return header;
  }

  /**
   * DATファイル（バイナリ形式）を解析
   * @param {Buffer} datBuffer - DATファイルのバッファ
   * @param {number} dataPoints - データ点数
   * @returns {Float32Array} データ配列
   */
  parseData(datBuffer, dataPoints) {
    const data = new Float32Array(dataPoints);

    for (let i = 0; i < dataPoints; i++) {
      const offset = i * this.DATA_SIZE_PER_POINT;
      data[i] = datBuffer.readFloatLE(offset);
    }

    return data;
  }

  /**
   * 日付文字列をパース
   * 対応形式: YYYY/MM/DD, YYYY-MM-DD, YYYYMMDD
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
          const month = parseInt(parts[1], 10) - 1; // 0-indexed
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

      // ISO形式
      return new Date(dateStr);
    } catch (error) {
      console.error('Date parse error:', error);
      return null;
    }
  }

  /**
   * HDR/DATデータを距離-値のペアの配列に変換
   * @param {HDRDATData} hdrDatData - HDR/DATデータ
   * @returns {Array<{distance: number, value: number}>} 変換後のデータ
   */
  toMeasurementData(hdrDatData) {
    const { header, data } = hdrDatData;
    const result = [];

    const startKm = header.metadata.startKilometer || 0;
    const samplingInterval = header.metadata.samplingInterval || 0.25;

    for (let i = 0; i < data.length; i++) {
      const distance = startKm + i * samplingInterval;
      result.push({
        distance: parseFloat(distance.toFixed(2)),
        value: parseFloat(data[i].toFixed(3))
      });
    }

    return result;
  }

  /**
   * ファイルIDからファイルタイプを取得
   * @param {string} fileId - ファイルID
   * @returns {string} ファイルタイプ
   */
  getFileType(fileId) {
    if (fileId.length < 8) return 'unknown';

    const dataType = fileId.substring(6, 8);
    return this.getDataTypeName(dataType);
  }

  /**
   * データ項目名を取得
   * @param {string} dataType - データ項目コード
   * @returns {string} データ項目名
   */
  getDataTypeName(dataType) {
    const dataTypeMap = {
      '11': '高低右 10m弦 基準補正',
      '12': '高低右 20m弦 基準補正',
      '14': '高低右 40m弦 基準補正',
      '1F': '高低右 復元 3m-25m',
      '1K': '高低右 10m弦 基準線',
      '1M': '高低右 20m弦 基準線',
      '1Q': '高低右 40m弦 基準線',
      '21': '高低左 10m弦 基準補正',
      '22': '高低左 20m弦 基準補正',
      '24': '高低左 40m弦 基準補正',
      '2F': '高低左 復元 3m-25m',
      '2K': '高低左 10m弦 基準線',
      '2M': '高低左 20m弦 基準線',
      '2Q': '高低左 40m弦 基準線',
      '51': '通り右 10m弦 基準補正',
      '52': '通り右 20m弦 基準補正',
      '54': '通り右 40m弦 基準補正',
      '5F': '通り右 復元波形',
      '5K': '通り右 10m弦 基準線',
      '5M': '通り右 20m弦 基準線',
      '5Q': '通り右 40m弦 基準線',
      '61': '通り左 10m弦 基準補正',
      '62': '通り左 20m弦 基準補正',
      '64': '通り左 40m弦 基準補正',
      '6F': '通り左 復元波形',
      '6K': '通り左 10m弦 基準線',
      '6M': '通り左 20m弦 基準線',
      '6Q': '通り左 40m弦 基準線'
    };

    return dataTypeMap[dataType] || dataType;
  }
}

module.exports = { HDRDATParser };

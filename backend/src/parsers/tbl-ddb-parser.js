/**
 * TBL/DDBフォーマットパーサー
 * LABOCS表形式データファイル（2ファイル構成）
 *
 * ファイル構造:
 * - DDBファイル（テーブル定義）: テキスト形式
 *   - テーブル名、レコード数、フィールド定義
 * - TBLファイル（データ）: テキスト形式
 *   - カンマ区切りのデータレコード
 *
 * 用途:
 * - 駅名データ (EM)
 * - こう配データ (JS)
 * - 曲線データ (HS)
 * - 構造物データ (KR)
 * - レールデータ (RL, RR)
 * - レール継目データ (RT, RU)
 * - 道床データ (DS)
 * - 分岐器データ (BK)
 * - EJデータ (EJ)
 * - IJデータ (IJ)
 */

const { EncodingDetector } = require('../utils/encoding-detector');

class TBLDDBParser {
  constructor() {
    // データ型マッピング
    this.DATA_TYPE_MAP = {
      '文字': 'string',
      '整数': 'integer',
      '実数': 'float'
    };

    // テーブル種別マッピング
    this.TABLE_TYPE_MAP = {
      'EM': '駅名',
      'JS': 'こう配',
      'HS': '曲線',
      'KR': '構造物',
      'RL': 'レール(左)',
      'RR': 'レール(右)',
      'RT': 'レール継目(左)',
      'RU': 'レール継目(右)',
      'DS': '道床',
      'BK': '分岐器',
      'EJ': 'EJ',
      'IJ': 'IJ'
    };
  }

  /**
   * DDBファイルとTBLファイルをパースする
   * @param {Buffer} ddbBuffer - DDBファイルのバッファ
   * @param {Buffer} tblBuffer - TBLファイルのバッファ
   * @returns {TBLData} パース結果
   */
  parse(ddbBuffer, tblBuffer) {
    if (!Buffer.isBuffer(ddbBuffer) || !Buffer.isBuffer(tblBuffer)) {
      throw new Error('Inputs must be Buffers');
    }

    // DDBファイル（テーブル定義）を解析
    const header = this.parseTableDefinition(ddbBuffer);

    // TBLファイル（データ）を解析
    const records = this.parseTableData(tblBuffer, header);

    return {
      header,
      records
    };
  }

  /**
   * DDBファイル（テーブル定義）を解析
   * @param {Buffer} ddbBuffer - DDBファイルのバッファ
   * @returns {TBLHeader} テーブルヘッダー情報
   */
  parseTableDefinition(ddbBuffer) {
    // エンコーディング検出
    const detector = new EncodingDetector();
    const encoding = detector.detect(ddbBuffer);
    const content = ddbBuffer.toString(encoding === 'shift_jis' ? 'utf8' : encoding);

    // 行ごとに分割
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    const header = {
      tableName: '',
      tableType: '',
      recordCount: 0,
      fields: []
    };

    let section = 'header';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // セクション判定
      if (trimmedLine.startsWith('[TABLE]')) {
        section = 'table';
        continue;
      } else if (trimmedLine.startsWith('[FIELDS]')) {
        section = 'fields';
        continue;
      }

      // ヘッダーセクション
      if (section === 'table') {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();

        if (!key || !value) continue;

        const trimmedKey = key.trim();

        switch (trimmedKey) {
          case 'NAME':
          case 'テーブル名':
            header.tableName = value;
            break;

          case 'TYPE':
          case '種別':
            header.tableType = value;
            break;

          case 'RECORD_COUNT':
          case 'レコード数':
            header.recordCount = parseInt(value, 10);
            break;
        }
      }

      // フィールドセクション
      if (section === 'fields') {
        // フィールド定義: "フィールド名,データ型,桁数"
        const parts = trimmedLine.split(',').map(p => p.trim());

        if (parts.length >= 3) {
          const field = {
            name: parts[0],
            type: this.DATA_TYPE_MAP[parts[1]] || parts[1],
            length: parseInt(parts[2], 10)
          };

          header.fields.push(field);
        }
      }
    }

    return header;
  }

  /**
   * TBLファイル（データ）を解析
   * @param {Buffer} tblBuffer - TBLファイルのバッファ
   * @param {TBLHeader} header - テーブルヘッダー情報
   * @returns {TBLRecord[]} レコード配列
   */
  parseTableData(tblBuffer, header) {
    // エンコーディング検出
    const detector = new EncodingDetector();
    const encoding = detector.detect(tblBuffer);
    const content = tblBuffer.toString(encoding === 'shift_jis' ? 'utf8' : encoding);

    // 行ごとに分割
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    const records = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // コメント行をスキップ
      if (line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      const record = this.parseRecord(line, header, i + 1);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  /**
   * 1レコードをパースする
   * @param {string} line - データ行
   * @param {TBLHeader} header - テーブルヘッダー情報
   * @param {number} lineNumber - 行番号（エラーメッセージ用）
   * @returns {TBLRecord|null} パースされたレコード
   */
  parseRecord(line, header, lineNumber) {
    try {
      // カンマで分割
      const parts = line.split(',').map(p => p.trim());

      if (parts.length < 2) {
        console.warn(`Line ${lineNumber}: Insufficient columns, skipping`);
        return null;
      }

      // 最初の2列は必ず「開始キロ程」「終了キロ程」
      const from = parseFloat(parts[0]);
      const to = parseFloat(parts[1]);

      if (isNaN(from) || isNaN(to)) {
        console.warn(`Line ${lineNumber}: Invalid kilometer values, skipping`);
        return null;
      }

      // 残りのフィールドをパース
      const data = {};

      for (let i = 0; i < header.fields.length && i + 2 < parts.length; i++) {
        const field = header.fields[i];
        const value = parts[i + 2];

        data[field.name] = this.parseFieldValue(value, field.type);
      }

      return {
        from,
        to,
        data
      };
    } catch (error) {
      console.error(`Line ${lineNumber}: Parse error -`, error);
      return null;
    }
  }

  /**
   * フィールド値を型に応じてパース
   * @param {string} value - 値文字列
   * @param {string} type - データ型
   * @returns {string|number} パース後の値
   */
  parseFieldValue(value, type) {
    if (!value || value === '') return null;

    switch (type) {
      case 'integer':
        const intValue = parseInt(value, 10);
        return isNaN(intValue) ? null : intValue;

      case 'float':
        const floatValue = parseFloat(value);
        return isNaN(floatValue) ? null : floatValue;

      case 'string':
      default:
        return value;
    }
  }

  /**
   * 指定キロ程のレコードを検索
   * @param {TBLData} tblData - TBLデータ
   * @param {number} kilometer - 検索するキロ程（m単位）
   * @returns {TBLRecord[]} 該当するレコード配列
   */
  findRecordsAtKilometer(tblData, kilometer) {
    const { records } = tblData;

    return records.filter(record => {
      return kilometer >= record.from && kilometer <= record.to;
    });
  }

  /**
   * 指定範囲内のレコードを検索
   * @param {TBLData} tblData - TBLデータ
   * @param {number} startKm - 開始キロ程（m単位）
   * @param {number} endKm - 終了キロ程（m単位）
   * @returns {TBLRecord[]} 範囲内のレコード配列
   */
  findRecordsInRange(tblData, startKm, endKm) {
    const { records } = tblData;

    return records.filter(record => {
      // レコード範囲と検索範囲が重なっているかチェック
      return !(record.to < startKm || record.from > endKm);
    });
  }

  /**
   * テーブル種別名を取得
   * @param {string} tableType - テーブル種別コード
   * @returns {string} テーブル種別名
   */
  getTableTypeName(tableType) {
    return this.TABLE_TYPE_MAP[tableType] || tableType;
  }

  /**
   * TBLデータをCSV文字列に変換
   * @param {TBLData} tblData - TBLデータ
   * @returns {string} CSV文字列
   */
  toCSV(tblData) {
    const { header, records } = tblData;
    const lines = [];

    // ヘッダー行
    const headerRow = ['開始キロ程', '終了キロ程'];
    for (const field of header.fields) {
      headerRow.push(field.name);
    }
    lines.push(headerRow.join(','));

    // データ行
    for (const record of records) {
      const row = [record.from.toString(), record.to.toString()];

      for (const field of header.fields) {
        const value = record.data[field.name];
        row.push(value !== null && value !== undefined ? value.toString() : '');
      }

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * 駅名データ(EM)を特化パース
   * @param {TBLData} tblData - TBLデータ
   * @returns {StationData[]} 駅名データ配列
   */
  parseStationData(tblData) {
    return tblData.records.map(record => ({
      kilometer: record.from,
      stationName: record.data['駅名'] || record.data['name'] || ''
    }));
  }

  /**
   * こう配データ(JS)を特化パース
   * @param {TBLData} tblData - TBLデータ
   * @returns {SlopeData[]} こう配データ配列
   */
  parseSlopeData(tblData) {
    return tblData.records.map(record => ({
      from: record.from,
      to: record.to,
      gradient: record.data['勾配'] || record.data['gradient'] || 0,
      curveRadius: record.data['縦曲線半径'] || record.data['radius'] || 0
    }));
  }

  /**
   * 曲線データ(HS)を特化パース
   * @param {TBLData} tblData - TBLデータ
   * @returns {CurveData[]} 曲線データ配列
   */
  parseCurveData(tblData) {
    return tblData.records.map(record => ({
      from: record.from,
      to: record.to,
      btc: record.data['BTC'] || 0,
      bcc: record.data['BCC'] || 0,
      ecc: record.data['ECC'] || 0,
      etc: record.data['ETC'] || 0,
      direction: record.data['方向'] || record.data['direction'] || '',
      radius: record.data['半径'] || record.data['radius'] || 0,
      cant: record.data['カント'] || record.data['cant'] || 0,
      slack: record.data['スラック'] || record.data['slack'] || 0
    }));
  }

  /**
   * 構造物データ(KR)を特化パース
   * @param {TBLData} tblData - TBLデータ
   * @returns {StructureData[]} 構造物データ配列
   */
  parseStructureData(tblData) {
    return tblData.records.map(record => ({
      from: record.from,
      to: record.to,
      structureType: record.data['種別'] || record.data['type'] || '',
      structureName: record.data['名称'] || record.data['name'] || ''
    }));
  }
}

module.exports = { TBLDDBParser };

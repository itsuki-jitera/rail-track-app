/**
 * Oracle→LABOCS変換機能
 * Oracle形式のCSV/テキストファイルからLABOCS表形式（TBL/DDB）に変換
 *
 * 対象データ:
 * - EM: 駅名
 * - JS: こう配
 * - HS: 曲線
 * - KR: 構造物
 * - RL/RR: レール（左/右）
 * - RT/RU: レール継目（左/右）
 * - DS: 道床
 * - BK: 分岐器
 * - EJ: EJ
 * - IJ: IJ
 */

class OracleToLabocsConverter {
  constructor() {
    // テーブル定義テンプレート
    this.TABLE_DEFINITIONS = {
      'EM': {
        tableName: '駅名',
        tableType: 'EM',
        fields: [
          { name: '駅名', type: '文字', length: 50 }
        ]
      },
      'JS': {
        tableName: 'こう配',
        tableType: 'JS',
        fields: [
          { name: '勾配', type: '実数', length: 10 },
          { name: '縦曲線半径', type: '実数', length: 10 }
        ]
      },
      'HS': {
        tableName: '曲線',
        tableType: 'HS',
        fields: [
          { name: 'BTC', type: '実数', length: 10 },
          { name: 'BCC', type: '実数', length: 10 },
          { name: 'ECC', type: '実数', length: 10 },
          { name: 'ETC', type: '実数', length: 10 },
          { name: '方向', type: '文字', length: 10 },
          { name: '半径', type: '実数', length: 10 },
          { name: 'カント', type: '実数', length: 10 },
          { name: 'スラック', type: '実数', length: 10 }
        ]
      },
      'KR': {
        tableName: '構造物',
        tableType: 'KR',
        fields: [
          { name: '種別', type: '文字', length: 20 },
          { name: '名称', type: '文字', length: 100 }
        ]
      },
      'RL': {
        tableName: 'レール(左)',
        tableType: 'RL',
        fields: [
          { name: 'レール種別', type: '文字', length: 20 },
          { name: '製造年月', type: '文字', length: 20 },
          { name: 'メーカー', type: '文字', length: 50 }
        ]
      },
      'RR': {
        tableName: 'レール(右)',
        tableType: 'RR',
        fields: [
          { name: 'レール種別', type: '文字', length: 20 },
          { name: '製造年月', type: '文字', length: 20 },
          { name: 'メーカー', type: '文字', length: 50 }
        ]
      },
      'RT': {
        tableName: 'レール継目(左)',
        tableType: 'RT',
        fields: [
          { name: '継目種別', type: '文字', length: 20 }
        ]
      },
      'RU': {
        tableName: 'レール継目(右)',
        tableType: 'RU',
        fields: [
          { name: '継目種別', type: '文字', length: 20 }
        ]
      },
      'DS': {
        tableName: '道床',
        tableType: 'DS',
        fields: [
          { name: '道床種別', type: '文字', length: 20 },
          { name: 'まくらぎ種別', type: '文字', length: 20 }
        ]
      },
      'BK': {
        tableName: '分岐器',
        tableType: 'BK',
        fields: [
          { name: '分岐器番号', type: '文字', length: 20 },
          { name: '種別', type: '文字', length: 20 },
          { name: 'リード長', type: '実数', length: 10 }
        ]
      },
      'EJ': {
        tableName: 'EJ',
        tableType: 'EJ',
        fields: [
          { name: 'EJ種別', type: '文字', length: 20 }
        ]
      },
      'IJ': {
        tableName: 'IJ',
        tableType: 'IJ',
        fields: [
          { name: 'IJ種別', type: '文字', length: 20 }
        ]
      }
    };
  }

  /**
   * OracleデータをLABOCS形式に変換
   * @param {Array<Object>} oracleData - Oracleデータ（オブジェクト配列）
   * @param {string} tableType - テーブル種別 (EM, JS, HS, KR, etc.)
   * @returns {{ddbBuffer: Buffer, tblBuffer: Buffer}} DDBとTBLのバッファ
   */
  convert(oracleData, tableType) {
    if (!this.TABLE_DEFINITIONS[tableType]) {
      throw new Error(`Unsupported table type: ${tableType}`);
    }

    const tableDef = this.TABLE_DEFINITIONS[tableType];

    // DDBファイル（テーブル定義）を生成
    const ddbBuffer = this.generateDDB(tableDef, oracleData.length);

    // TBLファイル（データ）を生成
    const tblBuffer = this.generateTBL(tableDef, oracleData);

    return { ddbBuffer, tblBuffer };
  }

  /**
   * DDBファイル（テーブル定義）を生成
   * @param {Object} tableDef - テーブル定義
   * @param {number} recordCount - レコード数
   * @returns {Buffer} DDBバッファ
   */
  generateDDB(tableDef, recordCount) {
    const lines = [];

    // [TABLE]セクション
    lines.push('[TABLE]');
    lines.push(`NAME=${tableDef.tableName}`);
    lines.push(`TYPE=${tableDef.tableType}`);
    lines.push(`RECORD_COUNT=${recordCount}`);
    lines.push('');

    // [FIELDS]セクション
    lines.push('[FIELDS]');
    for (const field of tableDef.fields) {
      lines.push(`${field.name},${field.type},${field.length}`);
    }

    const content = lines.join('\r\n');
    return Buffer.from(content, 'utf8');
  }

  /**
   * TBLファイル（データ）を生成
   * @param {Object} tableDef - テーブル定義
   * @param {Array<Object>} data - データ配列
   * @returns {Buffer} TBLバッファ
   */
  generateTBL(tableDef, data) {
    const lines = [];

    for (const record of data) {
      const row = [];

      // 開始キロ程、終了キロ程
      row.push(record.from !== undefined ? record.from.toString() : '0');
      row.push(record.to !== undefined ? record.to.toString() : '0');

      // フィールド値
      for (const field of tableDef.fields) {
        const value = record[field.name] || record[field.name.toLowerCase()] || '';
        row.push(value.toString());
      }

      lines.push(row.join(','));
    }

    const content = lines.join('\r\n');
    return Buffer.from(content, 'utf8');
  }

  /**
   * CSVファイルからOracleデータオブジェクト配列に変換
   * @param {Buffer} csvBuffer - CSVファイルバッファ
   * @param {string} tableType - テーブル種別
   * @returns {Array<Object>} Oracleデータ配列
   */
  parseCSV(csvBuffer, tableType) {
    const content = csvBuffer.toString('utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      return [];
    }

    const tableDef = this.TABLE_DEFINITIONS[tableType];
    if (!tableDef) {
      throw new Error(`Unsupported table type: ${tableType}`);
    }

    // ヘッダー行を解析
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim());

    // データ行を解析
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(',').map(v => v.trim());

      const record = {};

      for (let j = 0; j < headers.length && j < values.length; j++) {
        const header = headers[j];
        const value = values[j];

        // 数値型の変換
        if (header === 'from' || header === 'to' || header === '開始キロ程' || header === '終了キロ程') {
          record[header] = parseFloat(value) || 0;
        } else {
          record[header] = value;
        }
      }

      data.push(record);
    }

    return data;
  }

  /**
   * CSV→LABOCS一括変換
   * @param {Buffer} csvBuffer - CSVファイルバッファ
   * @param {string} tableType - テーブル種別
   * @returns {{ddbBuffer: Buffer, tblBuffer: Buffer}} DDBとTBLのバッファ
   */
  convertFromCSV(csvBuffer, tableType) {
    const oracleData = this.parseCSV(csvBuffer, tableType);
    return this.convert(oracleData, tableType);
  }

  /**
   * ファイル名を生成
   * @param {string} tableType - テーブル種別
   * @param {string} lineCode - 路線コード
   * @param {string} direction - 上下区分
   * @returns {{ddbFileName: string, tblFileName: string}} ファイル名
   */
  generateFileNames(tableType, lineCode, direction) {
    const baseFileName = `${lineCode}${direction}_${tableType}`;

    return {
      ddbFileName: `${baseFileName}.DDB`,
      tblFileName: `${baseFileName}.TBL`
    };
  }

  /**
   * サポートされているテーブル種別を取得
   * @returns {string[]} テーブル種別配列
   */
  getSupportedTableTypes() {
    return Object.keys(this.TABLE_DEFINITIONS);
  }

  /**
   * テーブル定義を取得
   * @param {string} tableType - テーブル種別
   * @returns {Object|null} テーブル定義
   */
  getTableDefinition(tableType) {
    return this.TABLE_DEFINITIONS[tableType] || null;
  }

  /**
   * バッチ変換: 複数のCSVファイルを一括でLABOCS形式に変換
   * @param {Array<{buffer: Buffer, tableType: string, lineCode: string, direction: string}>} csvFiles - CSVファイル情報配列
   * @returns {Array<{ddbFileName: string, ddbBuffer: Buffer, tblFileName: string, tblBuffer: Buffer}>} 変換結果配列
   */
  batchConvert(csvFiles) {
    const results = [];

    for (const csvFile of csvFiles) {
      const { buffer, tableType, lineCode, direction } = csvFile;

      const { ddbBuffer, tblBuffer } = this.convertFromCSV(buffer, tableType);
      const { ddbFileName, tblFileName } = this.generateFileNames(tableType, lineCode, direction);

      results.push({
        ddbFileName,
        ddbBuffer,
        tblFileName,
        tblBuffer
      });
    }

    return results;
  }
}

module.exports = { OracleToLabocsConverter };

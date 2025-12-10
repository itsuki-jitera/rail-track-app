/**
 * DCP→RSQ変換機能
 * DCPファイル（全項目一括）からRSQファイル（項目別）に分割
 *
 * 変換内容:
 * - DCPファイルから各測定項目を抽出
 * - 各項目をRSQフォーマット（ヘッダー2048byte + データ）に変換
 * - ファイル名規則に従って出力
 */

class DCPToRSQConverter {
  constructor() {
    this.HEADER_SIZE = 2048;

    // DCP項目コードとRSQ項目コードのマッピング
    this.ITEM_CODE_MAP = {
      'alignment10mRight': '5C',  // 通り右 10m弦
      'alignment10mLeft': '6C',   // 通り左 10m弦
      'level10mRight': '1C',      // 高低右 10m弦
      'level10mLeft': '2C',       // 高低左 10m弦
      'eccentricRight': '3C',     // 偏心矢右
      'eccentricLeft': '4C',      // 偏心矢左
      'gauge': 'GC',              // 軌間
      'crossLevel': 'SC',         // 水準
      'atsMarker': 'AC',          // ATS検知
      'slope': 'BC',              // 勾配
      'jointMarkerLeft': 'RC',    // 継目検知左
      'kmMarker': 'PC'            // 1km検知
    };
  }

  /**
   * DCPデータから複数のRSQバッファを生成
   * @param {DCPData} dcpData - DCPデータ
   * @param {string[]} itemKeys - 抽出する項目キー配列（省略時は全項目）
   * @returns {Map<string, Buffer>} 項目コード→RSQバッファのマップ
   */
  convertToRSQ(dcpData, itemKeys = null) {
    const { header, items } = dcpData;

    // 抽出対象の項目を決定
    const targetKeys = itemKeys || Object.keys(items);

    const rsqBuffers = new Map();

    for (const itemKey of targetKeys) {
      if (!items[itemKey]) {
        console.warn(`Item "${itemKey}" not found in DCP data, skipping`);
        continue;
      }

      const itemCode = this.ITEM_CODE_MAP[itemKey];
      if (!itemCode) {
        console.warn(`No item code mapping for "${itemKey}", skipping`);
        continue;
      }

      // RSQバッファを生成
      const rsqBuffer = this.createRSQBuffer(header, items[itemKey], itemCode);
      rsqBuffers.set(itemCode, rsqBuffer);
    }

    return rsqBuffers;
  }

  /**
   * 単一項目のRSQバッファを生成
   * @param {DCPFileHeader} header - DCPヘッダー
   * @param {Float32Array|Uint8Array} data - 項目データ
   * @param {string} itemCode - 項目コード (1C, 2C, 5C, etc.)
   * @returns {Buffer} RSQバッファ
   */
  createRSQBuffer(header, data, itemCode) {
    const dataPoints = data.length;

    // ヘッダー部を作成（2048 byte）
    const headerBuffer = Buffer.alloc(this.HEADER_SIZE);

    // ファイルID（8文字）
    const fileId = this.generateFileId(header.lineCode, header.direction, itemCode);
    headerBuffer.write(fileId, 0, 8, 'ascii');

    // 測定日（オフセット16、8文字、YYYYMMDD形式）
    if (header.measurementDate) {
      const dateStr = this.formatDate(header.measurementDate);
      headerBuffer.write(dateStr, 16, 8, 'ascii');
    }

    // データ点数（オフセット32、4byte、32bit整数）
    headerBuffer.writeInt32LE(dataPoints, 32);

    // 開始キロ程（オフセット40、4byte、32bit整数、m単位）
    headerBuffer.writeInt32LE(Math.floor(header.startKm), 40);

    // 終了キロ程（オフセット44、4byte、32bit整数、m単位）
    headerBuffer.writeInt32LE(Math.floor(header.endKm), 44);

    // データ部を作成（4byte Float × データ点数）
    const dataSize = dataPoints * 4;
    const dataBuffer = Buffer.alloc(dataSize);

    for (let i = 0; i < dataPoints; i++) {
      // Uint8Arrayの場合はFloat32に変換
      const value = data[i];
      dataBuffer.writeFloatLE(value, i * 4);
    }

    // ヘッダーとデータを結合
    return Buffer.concat([headerBuffer, dataBuffer]);
  }

  /**
   * ファイルIDを生成
   * @param {string} lineCode - 路線コード（2文字）
   * @param {string} direction - 上下区分（D:下り, R:上り）
   * @param {string} itemCode - 項目コード（2文字）
   * @returns {string} ファイルID（8文字）
   */
  generateFileId(lineCode, direction, itemCode) {
    // 形式: LLDFFICC
    // LL: 路線コード
    // D: 上下区分
    // FF: 固定値（通常"01"）
    // I: 固定値（通常"4"）
    // CC: 項目コード

    const paddedLineCode = (lineCode || 'TK').padEnd(2, ' ').substring(0, 2);
    const directionChar = direction || 'D';
    const fixedPart = '014';
    const itemCodePart = itemCode.padEnd(2, ' ').substring(0, 2);

    return `${paddedLineCode}${directionChar}${fixedPart}${itemCodePart}`;
  }

  /**
   * 日付をYYYYMMDD形式にフォーマット
   * @param {Date} date - 日付オブジェクト
   * @returns {string} YYYYMMDD形式の文字列
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * RSQファイル名を生成
   * @param {string} lineCode - 路線コード
   * @param {string} direction - 上下区分
   * @param {string} itemCode - 項目コード
   * @param {Date} measurementDate - 測定日
   * @returns {string} ファイル名（拡張子なし）
   */
  generateFileName(lineCode, direction, itemCode, measurementDate) {
    const fileId = this.generateFileId(lineCode, direction, itemCode);
    let fileName = fileId;

    if (measurementDate) {
      const dateStr = this.formatDate(measurementDate);
      fileName = `${fileId}_${dateStr}`;
    }

    return fileName;
  }

  /**
   * DCP→RSQ変換結果をファイル情報として取得
   * @param {DCPData} dcpData - DCPデータ
   * @param {string[]} itemKeys - 抽出する項目キー配列（省略時は全項目）
   * @returns {Array<{fileName: string, buffer: Buffer, itemCode: string}>} ファイル情報配列
   */
  convertToRSQFiles(dcpData, itemKeys = null) {
    const { header } = dcpData;
    const rsqBuffers = this.convertToRSQ(dcpData, itemKeys);

    const files = [];

    for (const [itemCode, buffer] of rsqBuffers) {
      const fileName = this.generateFileName(
        header.lineCode,
        header.direction,
        itemCode,
        header.measurementDate
      );

      files.push({
        fileName: `${fileName}.RSQ`,
        buffer,
        itemCode
      });
    }

    return files;
  }

  /**
   * 項目キーから項目コードを取得
   * @param {string} itemKey - 項目キー
   * @returns {string|null} 項目コード
   */
  getItemCode(itemKey) {
    return this.ITEM_CODE_MAP[itemKey] || null;
  }

  /**
   * 項目コードから項目キーを取得
   * @param {string} itemCode - 項目コード
   * @returns {string|null} 項目キー
   */
  getItemKey(itemCode) {
    for (const [key, code] of Object.entries(this.ITEM_CODE_MAP)) {
      if (code === itemCode) {
        return key;
      }
    }
    return null;
  }

  /**
   * サポートされている全項目コードを取得
   * @returns {string[]} 項目コード配列
   */
  getSupportedItemCodes() {
    return Object.values(this.ITEM_CODE_MAP);
  }

  /**
   * バッチ変換: 複数のDCPファイルを一括でRSQ形式に変換
   * @param {DCPData[]} dcpDataList - DCPデータ配列
   * @param {string[]} itemKeys - 抽出する項目キー配列（省略時は全項目）
   * @returns {Array<{fileName: string, buffer: Buffer, itemCode: string}>} ファイル情報配列
   */
  batchConvert(dcpDataList, itemKeys = null) {
    const allFiles = [];

    for (const dcpData of dcpDataList) {
      const files = this.convertToRSQFiles(dcpData, itemKeys);
      allFiles.push(...files);
    }

    return allFiles;
  }
}

module.exports = { DCPToRSQConverter };

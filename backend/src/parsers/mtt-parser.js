/**
 * MTT (Measured Track data Type) ファイルパーサー
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - MTTファイルはレール毎の測定データを保持
 * - ヘッダー部とデータ部から構成
 * - バイナリ形式でデータを格納
 */

const fs = require('fs').promises;
const path = require('path');

class MTTParser {
  /**
   * MTTファイルヘッダー構造
   */
  static HEADER_STRUCTURE = {
    signature: { offset: 0, size: 4, type: 'string' },     // 'MTT\0'
    version: { offset: 4, size: 2, type: 'uint16' },       // バージョン
    dataType: { offset: 6, size: 2, type: 'uint16' },      // データタイプ
    railSide: { offset: 8, size: 1, type: 'uint8' },       // レール位置 (0:左, 1:右)
    dataCount: { offset: 9, size: 4, type: 'uint32' },     // データ数
    dataInterval: { offset: 13, size: 4, type: 'float' },   // データ間隔 (m)
    startPosition: { offset: 17, size: 8, type: 'double' }, // 開始位置 (m)
    measurementDate: { offset: 25, size: 8, type: 'int64' }, // 測定日時 (Unix timestamp)
    vehicleType: { offset: 33, size: 16, type: 'string' },  // 測定車両タイプ
    lineSection: { offset: 49, size: 32, type: 'string' },  // 線区
    reserved: { offset: 81, size: 47, type: 'bytes' },      // 予約領域
    headerSize: 128  // ヘッダーサイズ
  };

  /**
   * データタイプ定数
   */
  static DATA_TYPES = {
    LEVEL: 0x0001,        // 高低
    ALIGNMENT: 0x0002,    // 通り
    GAUGE: 0x0004,        // 軌間
    CANT: 0x0008,         // カント
    TWIST: 0x0010,        // 水準
    VERSINE: 0x0020,      // 正矢
    RESTORED: 0x0100,     // 復元波形
    PLAN_LINE: 0x0200,    // 計画線
    MOVEMENT: 0x0400      // 移動量
  };

  /**
   * MTTファイルを読み込む
   *
   * @param {string} filePath - MTTファイルパス
   * @returns {Promise<Object>} パース結果
   */
  static async readFile(filePath) {
    try {
      console.log(`MTTファイル読み込み開始: ${filePath}`);

      // ファイルの存在確認
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error('指定されたパスはファイルではありません');
      }

      // バイナリデータの読み込み
      const buffer = await fs.readFile(filePath);

      // ヘッダーの解析
      const header = this.parseHeader(buffer);

      // データ部の解析
      const data = this.parseData(buffer, header);

      // 検証
      this.validateData(header, data);

      console.log(`MTTファイル読み込み完了: ${data.length}点`);

      return {
        header,
        data,
        metadata: this.extractMetadata(header),
        statistics: this.calculateStatistics(data)
      };
    } catch (error) {
      console.error('MTTファイル読み込みエラー:', error);
      throw new Error(`MTTファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * ヘッダー部の解析
   */
  static parseHeader(buffer) {
    const header = {};

    // シグネチャの確認
    const signature = buffer.toString('ascii', 0, 3);
    if (signature !== 'MTT') {
      throw new Error(`無効なファイル形式: ${signature}`);
    }

    // ヘッダー情報の読み取り
    header.signature = signature;
    header.version = buffer.readUInt16LE(4);
    header.dataType = buffer.readUInt16LE(6);
    header.railSide = buffer.readUInt8(8);
    header.dataCount = buffer.readUInt32LE(9);
    header.dataInterval = buffer.readFloatLE(13);
    header.startPosition = buffer.readDoubleLE(17);

    // 日時の変換
    const timestamp = buffer.readBigInt64LE(25);
    header.measurementDate = new Date(Number(timestamp) * 1000);

    // 文字列の読み取り
    header.vehicleType = this.readString(buffer, 33, 16);
    header.lineSection = this.readString(buffer, 49, 32);

    // データタイプの解釈
    header.dataTypeNames = this.getDataTypeNames(header.dataType);
    header.railSideName = header.railSide === 0 ? 'left' : 'right';

    return header;
  }

  /**
   * データ部の解析
   */
  static parseData(buffer, header) {
    const { headerSize } = this.HEADER_STRUCTURE;
    const { dataCount, dataType } = header;

    const data = [];
    let offset = headerSize;

    // データタイプに応じた読み取り
    for (let i = 0; i < dataCount; i++) {
      const point = {
        index: i,
        position: header.startPosition + i * header.dataInterval,
        values: {}
      };

      // 各データタイプの値を読み取り
      if (dataType & this.DATA_TYPES.LEVEL) {
        point.values.level = buffer.readFloatLE(offset);
        offset += 4;
      }
      if (dataType & this.DATA_TYPES.ALIGNMENT) {
        point.values.alignment = buffer.readFloatLE(offset);
        offset += 4;
      }
      if (dataType & this.DATA_TYPES.GAUGE) {
        point.values.gauge = buffer.readFloatLE(offset);
        offset += 4;
      }
      if (dataType & this.DATA_TYPES.CANT) {
        point.values.cant = buffer.readFloatLE(offset);
        offset += 4;
      }
      if (dataType & this.DATA_TYPES.TWIST) {
        point.values.twist = buffer.readFloatLE(offset);
        offset += 4;
      }
      if (dataType & this.DATA_TYPES.VERSINE) {
        point.values.versine = buffer.readFloatLE(offset);
        offset += 4;
      }

      // 品質情報（オプション）
      if (offset < buffer.length) {
        point.quality = buffer.readUInt8(offset);
        offset += 1;
      }

      data.push(point);
    }

    return data;
  }

  /**
   * MTTファイルを書き込む
   *
   * @param {string} filePath - 出力ファイルパス
   * @param {Object} data - 出力データ
   * @param {Object} options - オプション
   */
  static async writeFile(filePath, data, options = {}) {
    try {
      console.log(`MTTファイル書き込み開始: ${filePath}`);

      // デフォルトオプション
      const {
        dataType = this.DATA_TYPES.LEVEL | this.DATA_TYPES.ALIGNMENT,
        railSide = 0,
        dataInterval = 0.25,
        startPosition = 0,
        vehicleType = 'LABOX',
        lineSection = '',
        version = 1
      } = options;

      // ヘッダーの作成
      const header = {
        signature: 'MTT',
        version,
        dataType,
        railSide,
        dataCount: data.length,
        dataInterval,
        startPosition,
        measurementDate: new Date(),
        vehicleType,
        lineSection
      };

      // バッファサイズの計算
      const dataSize = this.calculateDataSize(header, data);
      const totalSize = this.HEADER_STRUCTURE.headerSize + dataSize;
      const buffer = Buffer.alloc(totalSize);

      // ヘッダーの書き込み
      this.writeHeader(buffer, header);

      // データの書き込み
      this.writeData(buffer, header, data);

      // ファイルに書き込み
      await fs.writeFile(filePath, buffer);

      console.log(`MTTファイル書き込み完了: ${data.length}点`);

      return {
        success: true,
        bytesWritten: totalSize,
        dataPoints: data.length
      };
    } catch (error) {
      console.error('MTTファイル書き込みエラー:', error);
      throw new Error(`MTTファイルの書き込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * ヘッダーの書き込み
   */
  static writeHeader(buffer, header) {
    // シグネチャ
    buffer.write('MTT\0', 0, 4, 'ascii');

    // 数値フィールド
    buffer.writeUInt16LE(header.version, 4);
    buffer.writeUInt16LE(header.dataType, 6);
    buffer.writeUInt8(header.railSide, 8);
    buffer.writeUInt32LE(header.dataCount, 9);
    buffer.writeFloatLE(header.dataInterval, 13);
    buffer.writeDoubleLE(header.startPosition, 17);

    // 日時
    const timestamp = Math.floor(header.measurementDate.getTime() / 1000);
    buffer.writeBigInt64LE(BigInt(timestamp), 25);

    // 文字列
    this.writeString(buffer, header.vehicleType, 33, 16);
    this.writeString(buffer, header.lineSection, 49, 32);

    // 予約領域をゼロで初期化
    buffer.fill(0, 81, 128);
  }

  /**
   * データの書き込み
   */
  static writeData(buffer, header, data) {
    let offset = this.HEADER_STRUCTURE.headerSize;

    for (const point of data) {
      // 各データタイプの値を書き込み
      if (header.dataType & this.DATA_TYPES.LEVEL) {
        buffer.writeFloatLE(point.level || 0, offset);
        offset += 4;
      }
      if (header.dataType & this.DATA_TYPES.ALIGNMENT) {
        buffer.writeFloatLE(point.alignment || 0, offset);
        offset += 4;
      }
      if (header.dataType & this.DATA_TYPES.GAUGE) {
        buffer.writeFloatLE(point.gauge || 0, offset);
        offset += 4;
      }
      if (header.dataType & this.DATA_TYPES.CANT) {
        buffer.writeFloatLE(point.cant || 0, offset);
        offset += 4;
      }
      if (header.dataType & this.DATA_TYPES.TWIST) {
        buffer.writeFloatLE(point.twist || 0, offset);
        offset += 4;
      }
      if (header.dataType & this.DATA_TYPES.VERSINE) {
        buffer.writeFloatLE(point.versine || 0, offset);
        offset += 4;
      }

      // 品質情報
      if (point.quality !== undefined) {
        buffer.writeUInt8(point.quality, offset);
        offset += 1;
      }
    }
  }

  /**
   * CSV形式に変換
   */
  static async convertToCSV(mttFilePath, csvFilePath) {
    try {
      const { header, data } = await this.readFile(mttFilePath);

      // CSVヘッダー行の作成
      const csvHeaders = ['position'];
      const dataTypes = header.dataTypeNames;
      dataTypes.forEach(type => {
        csvHeaders.push(type.toLowerCase());
      });
      if (data[0] && data[0].quality !== undefined) {
        csvHeaders.push('quality');
      }

      // CSVデータの作成
      let csvContent = csvHeaders.join(',') + '\n';

      for (const point of data) {
        const row = [point.position.toFixed(3)];

        dataTypes.forEach(type => {
          const key = type.toLowerCase();
          const value = point.values[key];
          row.push(value !== undefined ? value.toFixed(3) : '');
        });

        if (point.quality !== undefined) {
          row.push(point.quality);
        }

        csvContent += row.join(',') + '\n';
      }

      // ファイルに書き込み
      await fs.writeFile(csvFilePath, csvContent, 'utf8');

      console.log(`CSV変換完了: ${csvFilePath}`);

      return {
        success: true,
        rowCount: data.length,
        columnCount: csvHeaders.length
      };
    } catch (error) {
      console.error('CSV変換エラー:', error);
      throw new Error(`CSV変換に失敗しました: ${error.message}`);
    }
  }

  /**
   * JSON形式に変換
   */
  static async convertToJSON(mttFilePath, jsonFilePath, options = {}) {
    try {
      const { pretty = true, includeStatistics = true } = options;

      const result = await this.readFile(mttFilePath);

      // JSON用データの準備
      const jsonData = {
        header: result.header,
        metadata: result.metadata,
        data: result.data
      };

      if (includeStatistics) {
        jsonData.statistics = result.statistics;
      }

      // JSON文字列の生成
      const jsonString = pretty
        ? JSON.stringify(jsonData, null, 2)
        : JSON.stringify(jsonData);

      // ファイルに書き込み
      await fs.writeFile(jsonFilePath, jsonString, 'utf8');

      console.log(`JSON変換完了: ${jsonFilePath}`);

      return {
        success: true,
        fileSize: jsonString.length,
        dataPoints: result.data.length
      };
    } catch (error) {
      console.error('JSON変換エラー:', error);
      throw new Error(`JSON変換に失敗しました: ${error.message}`);
    }
  }

  /**
   * ユーティリティ関数
   */

  static readString(buffer, offset, length) {
    const bytes = buffer.slice(offset, offset + length);
    const nullIndex = bytes.indexOf(0);
    const end = nullIndex >= 0 ? nullIndex : length;
    return bytes.toString('utf8', 0, end).trim();
  }

  static writeString(buffer, str, offset, maxLength) {
    const bytes = Buffer.from(str, 'utf8');
    const length = Math.min(bytes.length, maxLength - 1);
    bytes.copy(buffer, offset, 0, length);
    buffer.writeUInt8(0, offset + length); // null terminator
  }

  static getDataTypeNames(dataType) {
    const names = [];

    if (dataType & this.DATA_TYPES.LEVEL) names.push('LEVEL');
    if (dataType & this.DATA_TYPES.ALIGNMENT) names.push('ALIGNMENT');
    if (dataType & this.DATA_TYPES.GAUGE) names.push('GAUGE');
    if (dataType & this.DATA_TYPES.CANT) names.push('CANT');
    if (dataType & this.DATA_TYPES.TWIST) names.push('TWIST');
    if (dataType & this.DATA_TYPES.VERSINE) names.push('VERSINE');
    if (dataType & this.DATA_TYPES.RESTORED) names.push('RESTORED');
    if (dataType & this.DATA_TYPES.PLAN_LINE) names.push('PLAN_LINE');
    if (dataType & this.DATA_TYPES.MOVEMENT) names.push('MOVEMENT');

    return names;
  }

  static calculateDataSize(header, data) {
    const bitsCount = this.countBits(header.dataType);
    const floatSize = 4;
    const qualitySize = 1;

    // 各データ点のサイズ
    const pointSize = bitsCount * floatSize + (data[0]?.quality !== undefined ? qualitySize : 0);

    return header.dataCount * pointSize;
  }

  static countBits(n) {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }

  static validateData(header, data) {
    if (data.length !== header.dataCount) {
      throw new Error(`データ数が一致しません: ヘッダー=${header.dataCount}, 実際=${data.length}`);
    }

    // データの整合性チェック
    for (let i = 0; i < data.length; i++) {
      const expectedPosition = header.startPosition + i * header.dataInterval;
      const actualPosition = data[i].position;

      if (Math.abs(expectedPosition - actualPosition) > 0.001) {
        console.warn(`位置の不整合: インデックス=${i}, 期待=${expectedPosition}, 実際=${actualPosition}`);
      }
    }
  }

  static extractMetadata(header) {
    return {
      fileType: 'MTT',
      version: header.version,
      createdAt: header.measurementDate,
      vehicleType: header.vehicleType,
      lineSection: header.lineSection,
      railSide: header.railSideName,
      dataTypes: header.dataTypeNames,
      dataCount: header.dataCount,
      dataInterval: header.dataInterval,
      totalLength: header.dataCount * header.dataInterval,
      startPosition: header.startPosition,
      endPosition: header.startPosition + (header.dataCount - 1) * header.dataInterval
    };
  }

  static calculateStatistics(data) {
    if (!data || data.length === 0) {
      return null;
    }

    const stats = {};

    // 各データタイプの統計を計算
    const dataTypes = Object.keys(data[0].values || {});

    for (const type of dataTypes) {
      const values = data.map(d => d.values[type]).filter(v => v !== undefined && !isNaN(v));

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);

        stats[type] = {
          count: values.length,
          mean: mean,
          stdDev: stdDev,
          min: min,
          max: max,
          range: max - min,
          rms: Math.sqrt(values.reduce((sum, val) => sum + val * val, 0) / values.length)
        };
      }
    }

    return stats;
  }
}

module.exports = MTTParser;
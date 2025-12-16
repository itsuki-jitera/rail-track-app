/**
 * ラボックス（LABOX）データパーサー
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - LBXファイル: ラボックス軌道測定データ（バイナリ形式）
 * - LDTファイル: ラボックステキストデータ
 * - 軌道測定車両から出力される標準的なデータ形式
 */

const fs = require('fs').promises;
const path = require('path');
const iconv = require('iconv-lite');

class LaboxParser {
  /**
   * LBXファイルヘッダー構造
   */
  static LBX_HEADER = {
    signature: { offset: 0, size: 8, type: 'string' },      // 'LABOX\0\0\0'
    version: { offset: 8, size: 2, type: 'uint16' },        // バージョン
    measurementDate: { offset: 10, size: 8, type: 'int64' }, // 測定日時
    trainSpeed: { offset: 18, size: 4, type: 'float' },     // 測定速度 (km/h)
    startKilometer: { offset: 22, size: 8, type: 'double' }, // 開始キロ程 (km)
    endKilometer: { offset: 30, size: 8, type: 'double' },   // 終了キロ程 (km)
    dataInterval: { offset: 38, size: 4, type: 'float' },    // データ間隔 (m)
    dataCount: { offset: 42, size: 4, type: 'uint32' },      // データ数
    channelCount: { offset: 46, size: 2, type: 'uint16' },   // チャンネル数
    railType: { offset: 48, size: 2, type: 'uint16' },       // レール種別
    lineSection: { offset: 50, size: 64, type: 'string' },   // 線区名
    direction: { offset: 114, size: 2, type: 'uint16' },     // 方向 (0:下り, 1:上り)
    reserved: { offset: 116, size: 140, type: 'bytes' },     // 予約領域
    headerSize: 256  // ヘッダーサイズ
  };

  /**
   * チャンネル定義
   */
  static CHANNELS = {
    LEFT_LEVEL: 0,      // 左レール高低
    RIGHT_LEVEL: 1,     // 右レール高低
    LEFT_ALIGNMENT: 2,  // 左レール通り
    RIGHT_ALIGNMENT: 3, // 右レール通り
    GAUGE: 4,           // 軌間
    CANT: 5,            // カント
    TWIST: 6,           // 水準
    LEFT_VERSINE: 7,    // 左正矢
    RIGHT_VERSINE: 8,   // 右正矢
    KILOMETER: 9        // キロ程
  };

  /**
   * LBXファイルを読み込む
   *
   * @param {string} filePath - LBXファイルパス
   * @param {Object} options - 読み込みオプション
   * @returns {Promise<Object>} パース結果
   */
  static async readLBX(filePath, options = {}) {
    const {
      channels = null,     // 読み込むチャンネル（nullで全て）
      startKm = null,      // 開始キロ程
      endKm = null,        // 終了キロ程
      verbose = true
    } = options;

    try {
      if (verbose) {
        console.log(`LBXファイル読み込み開始: ${filePath}`);
      }

      // ファイル読み込み
      const buffer = await fs.readFile(filePath);

      // ヘッダー解析
      const header = this.parseLBXHeader(buffer);

      if (verbose) {
        console.log(`測定日: ${header.measurementDate}`);
        console.log(`線区: ${header.lineSection}`);
        console.log(`キロ程: ${header.startKilometer}km - ${header.endKilometer}km`);
        console.log(`データ点数: ${header.dataCount}`);
      }

      // データ部の解析
      const data = this.parseLBXData(buffer, header, { channels, startKm, endKm });

      // 統計情報の計算
      const statistics = this.calculateStatistics(data);

      if (verbose) {
        console.log(`LBXファイル読み込み完了: ${data.length}点`);
      }

      return {
        header,
        data,
        statistics,
        metadata: {
          fileName: path.basename(filePath),
          fileSize: buffer.length,
          loadedChannels: channels || 'all'
        }
      };
    } catch (error) {
      console.error('LBXファイル読み込みエラー:', error);
      throw new Error(`LBXファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * LBXヘッダーの解析
   */
  static parseLBXHeader(buffer) {
    const header = {};

    // シグネチャ確認
    const signature = buffer.toString('ascii', 0, 5);
    if (!signature.startsWith('LABOX')) {
      // 代替フォーマットの可能性をチェック
      const altSignature = buffer.toString('ascii', 0, 4);
      if (altSignature !== 'LBX\0' && altSignature !== 'LAB\0') {
        throw new Error(`無効なファイル形式: ${signature}`);
      }
    }

    // ヘッダー情報の読み取り
    header.signature = signature;
    header.version = buffer.readUInt16LE(8);
    header.measurementDate = new Date(Number(buffer.readBigInt64LE(10)) * 1000);
    header.trainSpeed = buffer.readFloatLE(18);
    header.startKilometer = buffer.readDoubleLE(22);
    header.endKilometer = buffer.readDoubleLE(30);
    header.dataInterval = buffer.readFloatLE(38);
    header.dataCount = buffer.readUInt32LE(42);
    header.channelCount = buffer.readUInt16LE(46);
    header.railType = buffer.readUInt16LE(48);

    // 文字列の読み取り（Shift-JIS対応）
    const lineSectionBytes = buffer.slice(50, 114);
    header.lineSection = this.decodeString(lineSectionBytes);

    header.direction = buffer.readUInt16LE(114);
    header.directionName = header.direction === 0 ? 'down' : 'up';

    return header;
  }

  /**
   * LBXデータ部の解析
   */
  static parseLBXData(buffer, header, options = {}) {
    const { channels, startKm, endKm } = options;
    const { headerSize } = this.LBX_HEADER;
    const { dataCount, channelCount, dataInterval, startKilometer } = header;

    const data = [];
    let offset = headerSize;

    // チャンネルマスクの作成
    const channelMask = this.createChannelMask(channels, channelCount);

    for (let i = 0; i < dataCount; i++) {
      const kilometer = startKilometer + (i * dataInterval / 1000);

      // キロ程フィルタ
      if (startKm !== null && kilometer < startKm) {
        offset += channelCount * 4;  // スキップ
        continue;
      }
      if (endKm !== null && kilometer > endKm) {
        break;
      }

      const point = {
        index: i,
        position: i * dataInterval,
        kilometer: kilometer
      };

      // 各チャンネルのデータを読み取り
      for (let ch = 0; ch < channelCount; ch++) {
        if (channelMask[ch]) {
          const value = buffer.readFloatLE(offset + ch * 4);
          const channelName = this.getChannelName(ch);
          if (channelName) {
            point[channelName] = value;
          }
        }
      }

      data.push(point);
      offset += channelCount * 4;
    }

    return data;
  }

  /**
   * LDTファイルを読み込む（テキスト形式）
   *
   * @param {string} filePath - LDTファイルパス
   * @param {Object} options - 読み込みオプション
   * @returns {Promise<Object>} パース結果
   */
  static async readLDT(filePath, options = {}) {
    const {
      encoding = 'shift_jis',
      delimiter = '\t',
      verbose = true
    } = options;

    try {
      if (verbose) {
        console.log(`LDTファイル読み込み開始: ${filePath}`);
      }

      // ファイル読み込み
      const buffer = await fs.readFile(filePath);
      const text = iconv.decode(buffer, encoding);
      const lines = text.split(/\r?\n/).filter(line => line.trim());

      // ヘッダー行の解析
      const header = this.parseLDTHeader(lines);

      // データ行の解析
      const data = this.parseLDTData(lines, header, delimiter);

      // 統計情報
      const statistics = this.calculateStatistics(data);

      if (verbose) {
        console.log(`LDTファイル読み込み完了: ${data.length}点`);
      }

      return {
        header,
        data,
        statistics,
        metadata: {
          fileName: path.basename(filePath),
          lineCount: lines.length,
          encoding
        }
      };
    } catch (error) {
      console.error('LDTファイル読み込みエラー:', error);
      throw new Error(`LDTファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * LDTヘッダーの解析
   */
  static parseLDTHeader(lines) {
    const header = {
      columns: [],
      dataStartLine: 0
    };

    // ヘッダー情報を探す
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];

      // 測定日の検出
      if (line.includes('測定日') || line.includes('DATE')) {
        const match = line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (match) {
          header.measurementDate = new Date(match[1], match[2] - 1, match[3]);
        }
      }

      // 線区名の検出
      if (line.includes('線区') || line.includes('LINE')) {
        header.lineSection = line.split(/[:：]/)[1]?.trim();
      }

      // カラムヘッダーの検出
      if (line.includes('キロ程') || line.includes('KM') ||
          line.includes('高低') || line.includes('通り')) {
        header.columns = line.split(/\t|,/).map(col => col.trim());
        header.dataStartLine = i + 1;
        break;
      }
    }

    return header;
  }

  /**
   * LDTデータの解析
   */
  static parseLDTData(lines, header, delimiter) {
    const data = [];
    const { dataStartLine, columns } = header;

    // カラムインデックスの特定
    const columnMap = this.identifyColumns(columns);

    for (let i = dataStartLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map(v => v.trim());

      const point = {};

      // 各カラムの値を取得
      for (const [key, index] of Object.entries(columnMap)) {
        if (index >= 0 && index < values.length) {
          const value = parseFloat(values[index]);
          if (!isNaN(value)) {
            point[key] = value;
          }
        }
      }

      if (Object.keys(point).length > 0) {
        data.push(point);
      }
    }

    return data;
  }

  /**
   * カラム名の識別
   */
  static identifyColumns(columns) {
    const columnMap = {
      kilometer: -1,
      position: -1,
      leftLevel: -1,
      rightLevel: -1,
      leftAlignment: -1,
      rightAlignment: -1,
      gauge: -1,
      cant: -1,
      twist: -1
    };

    columns.forEach((col, index) => {
      const normalized = col.toLowerCase();

      if (normalized.includes('キロ') || normalized.includes('km')) {
        columnMap.kilometer = index;
      } else if (normalized.includes('位置') || normalized.includes('position')) {
        columnMap.position = index;
      } else if (normalized.includes('左') && normalized.includes('高')) {
        columnMap.leftLevel = index;
      } else if (normalized.includes('右') && normalized.includes('高')) {
        columnMap.rightLevel = index;
      } else if (normalized.includes('左') && normalized.includes('通')) {
        columnMap.leftAlignment = index;
      } else if (normalized.includes('右') && normalized.includes('通')) {
        columnMap.rightAlignment = index;
      } else if (normalized.includes('軌間') || normalized.includes('gauge')) {
        columnMap.gauge = index;
      } else if (normalized.includes('カント') || normalized.includes('cant')) {
        columnMap.cant = index;
      } else if (normalized.includes('水準') || normalized.includes('twist')) {
        columnMap.twist = index;
      }
    });

    return columnMap;
  }

  /**
   * チャンネルマスクの作成
   */
  static createChannelMask(channels, channelCount) {
    const mask = new Array(channelCount).fill(true);

    if (channels && Array.isArray(channels)) {
      mask.fill(false);
      channels.forEach(ch => {
        if (typeof ch === 'number' && ch < channelCount) {
          mask[ch] = true;
        } else if (typeof ch === 'string') {
          const chIndex = this.getChannelIndex(ch);
          if (chIndex >= 0 && chIndex < channelCount) {
            mask[chIndex] = true;
          }
        }
      });
    }

    return mask;
  }

  /**
   * チャンネル名の取得
   */
  static getChannelName(index) {
    const names = [
      'leftLevel',
      'rightLevel',
      'leftAlignment',
      'rightAlignment',
      'gauge',
      'cant',
      'twist',
      'leftVersine',
      'rightVersine',
      'kilometer'
    ];

    return names[index] || `channel_${index}`;
  }

  /**
   * チャンネルインデックスの取得
   */
  static getChannelIndex(name) {
    const map = {
      'leftLevel': 0,
      'rightLevel': 1,
      'leftAlignment': 2,
      'rightAlignment': 3,
      'gauge': 4,
      'cant': 5,
      'twist': 6,
      'leftVersine': 7,
      'rightVersine': 8,
      'kilometer': 9
    };

    return map[name] || -1;
  }

  /**
   * 文字列のデコード（Shift-JIS対応）
   */
  static decodeString(buffer) {
    // null終端を探す
    let end = buffer.indexOf(0);
    if (end === -1) end = buffer.length;

    const bytes = buffer.slice(0, end);

    try {
      // まずUTF-8を試す
      const utf8 = bytes.toString('utf8');
      if (!utf8.includes('�')) {
        return utf8.trim();
      }
    } catch (e) {
      // UTF-8失敗
    }

    try {
      // Shift-JISでデコード
      return iconv.decode(bytes, 'shift_jis').trim();
    } catch (e) {
      // Shift-JISも失敗した場合はASCIIとして扱う
      return bytes.toString('ascii').replace(/[^\x20-\x7E]/g, '').trim();
    }
  }

  /**
   * 統計情報の計算
   */
  static calculateStatistics(data) {
    if (!data || data.length === 0) {
      return null;
    }

    const stats = {};

    // データタイプの特定
    const dataTypes = new Set();
    data.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'index' && key !== 'position' && key !== 'kilometer') {
          dataTypes.add(key);
        }
      });
    });

    // 各データタイプの統計
    dataTypes.forEach(type => {
      const values = data
        .map(d => d[type])
        .filter(v => v !== undefined && !isNaN(v));

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;

        stats[type] = {
          count: values.length,
          mean: mean,
          stdDev: Math.sqrt(variance),
          min: Math.min(...values),
          max: Math.max(...values),
          rms: Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length)
        };
      }
    });

    // 全体情報
    stats.totalPoints = data.length;
    stats.dataTypes = Array.from(dataTypes);

    if (data.length > 0) {
      const firstPoint = data[0];
      const lastPoint = data[data.length - 1];

      if (firstPoint.kilometer !== undefined && lastPoint.kilometer !== undefined) {
        stats.kilometerRange = {
          start: firstPoint.kilometer,
          end: lastPoint.kilometer,
          length: lastPoint.kilometer - firstPoint.kilometer
        };
      }

      if (firstPoint.position !== undefined && lastPoint.position !== undefined) {
        stats.positionRange = {
          start: firstPoint.position,
          end: lastPoint.position,
          length: lastPoint.position - firstPoint.position
        };
      }
    }

    return stats;
  }

  /**
   * データの変換（エクスポート用）
   */
  static convertToStandardFormat(data, options = {}) {
    const {
      includeKilometer = true,
      includePosition = true,
      dataTypes = null  // nullで全て
    } = options;

    return data.map((point, index) => {
      const converted = {};

      if (includePosition) {
        converted.position = point.position || index * 0.25;
      }

      if (includeKilometer) {
        converted.kilometer = point.kilometer;
      }

      // 指定されたデータタイプのみ含める
      if (dataTypes) {
        dataTypes.forEach(type => {
          if (point[type] !== undefined) {
            converted[type] = point[type];
          }
        });
      } else {
        // 全てのデータを含める
        Object.keys(point).forEach(key => {
          if (key !== 'index') {
            converted[key] = point[key];
          }
        });
      }

      return converted;
    });
  }

  /**
   * CSV形式でエクスポート
   */
  static async exportToCSV(data, outputPath, options = {}) {
    const {
      delimiter = ',',
      encoding = 'utf8',
      headers = true
    } = options;

    const standardData = this.convertToStandardFormat(data, options);

    if (standardData.length === 0) {
      throw new Error('エクスポートするデータがありません');
    }

    // ヘッダー行
    let csvContent = '';
    if (headers) {
      const headerRow = Object.keys(standardData[0]);
      csvContent = headerRow.join(delimiter) + '\n';
    }

    // データ行
    standardData.forEach(row => {
      const values = Object.values(row).map(v =>
        v !== undefined && v !== null ? v.toString() : ''
      );
      csvContent += values.join(delimiter) + '\n';
    });

    // ファイルに書き込み
    if (encoding === 'shift_jis') {
      const buffer = iconv.encode(csvContent, 'shift_jis');
      await fs.writeFile(outputPath, buffer);
    } else {
      await fs.writeFile(outputPath, csvContent, encoding);
    }

    return {
      success: true,
      rowCount: standardData.length,
      fileSize: csvContent.length
    };
  }
}

module.exports = LaboxParser;
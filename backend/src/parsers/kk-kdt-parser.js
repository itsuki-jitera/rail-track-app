/**
 * KK.KDT（キロ程データ）ファイルパーサー
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - KK.KDTファイル: キロ程データファイル
 * - WB区間の特殊キロ程処理に使用
 * - ラボックス元データのキロ程情報を保持
 */

const fs = require('fs').promises;
const path = require('path');

class KKKDTParser {
  /**
   * KK.KDTファイルフォーマット定義
   */
  static FILE_FORMAT = {
    // ヘッダー部
    header: {
      signature: 'KK.KDT',  // ファイル識別子
      version: '1.0',       // フォーマットバージョン
      encoding: 'utf8'      // エンコーディング
    },
    // レコードタイプ
    recordTypes: {
      HEADER: 'H',      // ヘッダーレコード
      DATA: 'D',        // データレコード
      WB_START: 'W',    // WB区間開始
      WB_END: 'E',      // WB区間終了
      COMMENT: '#'      // コメント行
    }
  };

  /**
   * KK.KDTファイルを読み込む
   *
   * @param {string} filePath - KK.KDTファイルパス
   * @param {Object} options - 読み込みオプション
   * @returns {Promise<Object>} パース結果
   */
  static async readFile(filePath, options = {}) {
    const {
      encoding = 'utf8',
      verbose = true
    } = options;

    try {
      if (verbose) {
        console.log(`KK.KDTファイル読み込み開始: ${filePath}`);
      }

      // ファイル読み込み
      const content = await fs.readFile(filePath, encoding);
      const lines = content.split(/\r?\n/).filter(line => line.trim());

      // パース処理
      const result = this.parseKDTContent(lines);

      // 検証
      this.validateKDTData(result);

      if (verbose) {
        console.log(`KK.KDTファイル読み込み完了`);
        console.log(`データ点数: ${result.data.length}`);
        console.log(`WB区間数: ${result.wbSections.length}`);
      }

      return result;
    } catch (error) {
      console.error('KK.KDTファイル読み込みエラー:', error);
      throw new Error(`KK.KDTファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * KDTファイル内容のパース
   */
  static parseKDTContent(lines) {
    const result = {
      header: {},
      data: [],
      wbSections: [],
      comments: []
    };

    let currentWBSection = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      if (!line.trim()) continue;

      const recordType = line.charAt(0);
      const content = line.substring(1).trim();

      switch (recordType) {
        case this.FILE_FORMAT.recordTypes.HEADER:
          this.parseHeaderRecord(content, result.header);
          break;

        case this.FILE_FORMAT.recordTypes.DATA:
          const dataPoint = this.parseDataRecord(content);
          if (dataPoint) {
            result.data.push(dataPoint);
          }
          break;

        case this.FILE_FORMAT.recordTypes.WB_START:
          currentWBSection = this.parseWBStartRecord(content);
          currentWBSection.startLine = lineNumber;
          break;

        case this.FILE_FORMAT.recordTypes.WB_END:
          if (currentWBSection) {
            const endInfo = this.parseWBEndRecord(content);
            currentWBSection.end = endInfo.end;
            currentWBSection.endKilometer = endInfo.kilometer;
            currentWBSection.endLine = lineNumber;
            result.wbSections.push(currentWBSection);
            currentWBSection = null;
          }
          break;

        case this.FILE_FORMAT.recordTypes.COMMENT:
          result.comments.push({
            line: lineNumber,
            text: content
          });
          break;

        default:
          // 通常のデータ行として扱う
          const defaultData = this.parseDefaultFormat(line);
          if (defaultData) {
            result.data.push(defaultData);
          }
      }
    }

    // 未完了のWB区間がある場合の処理
    if (currentWBSection) {
      console.warn('未完了のWB区間があります:', currentWBSection);
      result.wbSections.push(currentWBSection);
    }

    return result;
  }

  /**
   * ヘッダーレコードのパース
   */
  static parseHeaderRecord(content, header) {
    const parts = content.split(',');

    if (parts.length >= 2) {
      const [key, value] = parts.map(p => p.trim());

      switch (key.toUpperCase()) {
        case 'VERSION':
          header.version = value;
          break;
        case 'DATE':
          header.measurementDate = new Date(value);
          break;
        case 'LINE':
          header.lineSection = value;
          break;
        case 'DIRECTION':
          header.direction = value.toLowerCase() === 'up' ? 'up' : 'down';
          break;
        case 'INTERVAL':
          header.dataInterval = parseFloat(value);
          break;
        default:
          header[key.toLowerCase()] = value;
      }
    }
  }

  /**
   * データレコードのパース
   */
  static parseDataRecord(content) {
    const parts = content.split(',').map(p => p.trim());

    if (parts.length >= 2) {
      const position = parseFloat(parts[0]);
      const kilometer = parseFloat(parts[1]);

      if (!isNaN(position) && !isNaN(kilometer)) {
        const data = {
          position,
          kilometer
        };

        // 追加データがある場合
        if (parts.length > 2) {
          data.notes = parts.slice(2).join(',');
        }

        return data;
      }
    }

    return null;
  }

  /**
   * WB区間開始レコードのパース
   */
  static parseWBStartRecord(content) {
    const parts = content.split(',').map(p => p.trim());

    const wbSection = {
      type: 'WB',
      start: parseFloat(parts[0]) || 0,
      startKilometer: parseFloat(parts[1]) || 0
    };

    if (parts.length > 2) {
      wbSection.description = parts[2];
    }

    if (parts.length > 3) {
      wbSection.type = parts[3] || 'WB';
    }

    return wbSection;
  }

  /**
   * WB区間終了レコードのパース
   */
  static parseWBEndRecord(content) {
    const parts = content.split(',').map(p => p.trim());

    return {
      end: parseFloat(parts[0]) || 0,
      kilometer: parseFloat(parts[1]) || 0
    };
  }

  /**
   * デフォルトフォーマットのパース（互換性用）
   */
  static parseDefaultFormat(line) {
    // タブ区切りまたはスペース区切りのフォーマットに対応
    const parts = line.split(/[\t\s]+/).map(p => p.trim());

    if (parts.length >= 2) {
      const position = parseFloat(parts[0]);
      const kilometer = parseFloat(parts[1]);

      if (!isNaN(position) && !isNaN(kilometer)) {
        return {
          position,
          kilometer,
          source: 'default'
        };
      }
    }

    // カンマ区切りも試す
    const csvParts = line.split(',').map(p => p.trim());
    if (csvParts.length >= 2) {
      const position = parseFloat(csvParts[0]);
      const kilometer = parseFloat(csvParts[1]);

      if (!isNaN(position) && !isNaN(kilometer)) {
        return {
          position,
          kilometer,
          source: 'csv'
        };
      }
    }

    return null;
  }

  /**
   * KK.KDTファイルを書き込む
   *
   * @param {string} filePath - 出力ファイルパス
   * @param {Object} data - 出力データ
   * @param {Object} options - 書き込みオプション
   * @returns {Promise<Object>} 書き込み結果
   */
  static async writeFile(filePath, data, options = {}) {
    const {
      encoding = 'utf8',
      includeHeader = true,
      includeComments = true,
      verbose = true
    } = options;

    try {
      if (verbose) {
        console.log(`KK.KDTファイル書き込み開始: ${filePath}`);
      }

      // ファイル内容の生成
      const content = this.generateKDTContent(data, {
        includeHeader,
        includeComments
      });

      // ファイルに書き込み
      await fs.writeFile(filePath, content, encoding);

      if (verbose) {
        console.log(`KK.KDTファイル書き込み完了`);
        console.log(`データ点数: ${data.data?.length || 0}`);
        console.log(`WB区間数: ${data.wbSections?.length || 0}`);
      }

      return {
        success: true,
        bytesWritten: Buffer.byteLength(content, encoding),
        dataPoints: data.data?.length || 0,
        wbSections: data.wbSections?.length || 0
      };
    } catch (error) {
      console.error('KK.KDTファイル書き込みエラー:', error);
      throw new Error(`KK.KDTファイルの書き込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * KDTファイル内容の生成
   */
  static generateKDTContent(data, options) {
    const lines = [];
    const { recordTypes } = this.FILE_FORMAT;

    // ヘッダー部
    if (options.includeHeader && data.header) {
      lines.push(`${recordTypes.HEADER}VERSION,${data.header.version || '1.0'}`);
      if (data.header.measurementDate) {
        lines.push(`${recordTypes.HEADER}DATE,${data.header.measurementDate.toISOString()}`);
      }
      if (data.header.lineSection) {
        lines.push(`${recordTypes.HEADER}LINE,${data.header.lineSection}`);
      }
      if (data.header.direction) {
        lines.push(`${recordTypes.HEADER}DIRECTION,${data.header.direction}`);
      }
      if (data.header.dataInterval) {
        lines.push(`${recordTypes.HEADER}INTERVAL,${data.header.dataInterval}`);
      }
      lines.push('');  // 空行
    }

    // コメント
    if (options.includeComments) {
      lines.push(`${recordTypes.COMMENT} KK.KDT File Generated by Rail Track System`);
      lines.push(`${recordTypes.COMMENT} Date: ${new Date().toISOString()}`);
      lines.push('');
    }

    // データとWB区間を位置順に出力
    const sortedData = data.data ? [...data.data].sort((a, b) => a.position - b.position) : [];
    const wbSections = data.wbSections || [];

    let dataIndex = 0;
    let wbIndex = 0;

    while (dataIndex < sortedData.length || wbIndex < wbSections.length) {
      // WB区間開始をチェック
      if (wbIndex < wbSections.length) {
        const wb = wbSections[wbIndex];

        // WB区間開始位置に到達した場合
        if (dataIndex >= sortedData.length || sortedData[dataIndex].position >= wb.start) {
          lines.push(`${recordTypes.WB_START}${wb.start},${wb.startKilometer},${wb.description || ''},${wb.type || 'WB'}`);

          // WB区間内のデータを出力
          while (dataIndex < sortedData.length && sortedData[dataIndex].position < wb.end) {
            const point = sortedData[dataIndex];
            lines.push(`${recordTypes.DATA}${point.position},${point.kilometer}${point.notes ? ',' + point.notes : ''}`);
            dataIndex++;
          }

          // WB区間終了
          lines.push(`${recordTypes.WB_END}${wb.end},${wb.endKilometer || wb.startKilometer}`);
          wbIndex++;
        }
      }

      // 通常データの出力
      if (dataIndex < sortedData.length) {
        const nextWB = wbIndex < wbSections.length ? wbSections[wbIndex] : null;

        if (!nextWB || sortedData[dataIndex].position < nextWB.start) {
          const point = sortedData[dataIndex];
          lines.push(`${recordTypes.DATA}${point.position},${point.kilometer}${point.notes ? ',' + point.notes : ''}`);
          dataIndex++;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * データの検証
   */
  static validateKDTData(data) {
    const errors = [];
    const warnings = [];

    // データの存在確認
    if (!data.data || data.data.length === 0) {
      warnings.push('データポイントが存在しません');
    }

    // WB区間の検証
    if (data.wbSections && data.wbSections.length > 0) {
      for (let i = 0; i < data.wbSections.length; i++) {
        const wb = data.wbSections[i];

        // 開始・終了位置の確認
        if (wb.start >= wb.end) {
          errors.push(`WB区間${i + 1}: 開始位置が終了位置より後になっています`);
        }

        // 重複チェック
        for (let j = i + 1; j < data.wbSections.length; j++) {
          const other = data.wbSections[j];
          if (wb.start < other.end && wb.end > other.start) {
            warnings.push(`WB区間${i + 1}と${j + 1}が重複しています`);
          }
        }
      }
    }

    // データの連続性チェック
    if (data.data && data.data.length > 1) {
      const sorted = [...data.data].sort((a, b) => a.position - b.position);

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        // 位置の重複
        if (prev.position === curr.position) {
          warnings.push(`位置 ${curr.position} にデータが重複しています`);
        }

        // キロ程の逆転
        if (prev.kilometer > curr.kilometer) {
          warnings.push(`位置 ${prev.position}-${curr.position} でキロ程が逆転しています`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`データ検証エラー: ${errors.join(', ')}`);
    }

    if (warnings.length > 0) {
      console.warn('データ検証警告:', warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * キロ程の補間計算
   */
  static interpolateKilometer(position, data, wbSections = []) {
    // WB区間内かチェック
    for (const wb of wbSections) {
      if (position >= wb.start && position <= wb.end) {
        // WB区間内は元のラボックスキロ程を使用
        if (wb.originalKilometer && wb.originalKilometer.length > 0) {
          const index = Math.floor((position - wb.start) / 0.25);
          if (index < wb.originalKilometer.length) {
            return wb.originalKilometer[index];
          }
        }
      }
    }

    // 通常区間は線形補間
    const sorted = [...data].sort((a, b) => a.position - b.position);

    // 最も近い2点を探す
    let lower = null;
    let upper = null;

    for (const point of sorted) {
      if (point.position <= position) {
        lower = point;
      }
      if (point.position >= position && !upper) {
        upper = point;
        break;
      }
    }

    // 補間計算
    if (lower && upper && lower !== upper) {
      const ratio = (position - lower.position) / (upper.position - lower.position);
      return lower.kilometer + ratio * (upper.kilometer - lower.kilometer);
    }

    // 補間できない場合
    if (lower) return lower.kilometer;
    if (upper) return upper.kilometer;

    return null;
  }

  /**
   * CSV形式に変換
   */
  static async convertToCSV(kdtData, outputPath, options = {}) {
    const {
      includeWBMarkers = true,
      delimiter = ','
    } = options;

    const lines = ['Position,Kilometer,Type,Notes'];

    // データとWB区間を統合
    const allPoints = [];

    // 通常データ
    if (kdtData.data) {
      kdtData.data.forEach(point => {
        allPoints.push({
          position: point.position,
          kilometer: point.kilometer,
          type: 'DATA',
          notes: point.notes || ''
        });
      });
    }

    // WB区間マーカー
    if (includeWBMarkers && kdtData.wbSections) {
      kdtData.wbSections.forEach(wb => {
        allPoints.push({
          position: wb.start,
          kilometer: wb.startKilometer,
          type: 'WB_START',
          notes: wb.description || ''
        });
        allPoints.push({
          position: wb.end,
          kilometer: wb.endKilometer || wb.startKilometer,
          type: 'WB_END',
          notes: wb.description || ''
        });
      });
    }

    // ソート
    allPoints.sort((a, b) => a.position - b.position);

    // CSV行の生成
    allPoints.forEach(point => {
      const row = [
        point.position,
        point.kilometer,
        point.type,
        point.notes
      ].join(delimiter);
      lines.push(row);
    });

    const csvContent = lines.join('\n');
    await fs.writeFile(outputPath, csvContent, 'utf8');

    return {
      success: true,
      rowCount: allPoints.length,
      fileSize: csvContent.length
    };
  }
}

module.exports = KKKDTParser;
/**
 * PNTフォーマットパーサー
 * キロ程対照表（テキスト形式、CSV）
 *
 * ファイル構造:
 * - テキスト形式（Shift-JISまたはUTF-8）
 * - カンマ区切り（CSV）
 * - 列: キロ程, 地点番号, 地点種別, 説明
 */

const { EncodingDetector } = require('../utils/encoding-detector');

class PNTParser {
  constructor() {
    // PNT固有の設定
    this.POINT_TYPE_MAP = {
      'DD': 'データデポ',
      'WB': 'WB区間',
      'ST': '駅',
      'BR': '橋梁',
      'TN': 'トンネル',
      'SW': '分岐器'
    };
  }

  /**
   * PNTファイルをパースする
   * @param {Buffer} buffer - PNTファイルのバッファ
   * @returns {PNTData} パース結果
   */
  parse(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer');
    }

    // エンコーディング検出
    const detector = new EncodingDetector();
    const encoding = detector.detect(buffer);
    const content = buffer.toString(encoding === 'shift_jis' ? 'utf8' : encoding);

    // 行ごとに分割
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      throw new Error('Empty PNT file');
    }

    // 最初の行からファイル情報を取得（オプション）
    let lineCode = '';
    let direction = '';
    let startLine = 0;

    // ヘッダー行の検出（# で始まる行）
    if (lines[0].startsWith('#')) {
      const headerLine = lines[0].substring(1).trim();
      const headerParts = headerLine.split(',');

      if (headerParts.length >= 2) {
        lineCode = headerParts[0].trim();
        direction = headerParts[1].trim();
      }

      startLine = 1;
    }

    // データ行をパース
    const points = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();

      // コメント行やヘッダー行をスキップ
      if (line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      const record = this.parseLine(line, i + 1);
      if (record) {
        points.push(record);
      }
    }

    return {
      lineCode,
      direction,
      points
    };
  }

  /**
   * 1行をパースする
   * @param {string} line - CSV行
   * @param {number} lineNumber - 行番号（エラーメッセージ用）
   * @returns {PNTRecord|null} パースされたレコード
   */
  parseLine(line, lineNumber) {
    try {
      // カンマで分割
      const parts = line.split(',').map(p => p.trim());

      if (parts.length < 2) {
        console.warn(`Line ${lineNumber}: Insufficient columns (${parts.length}), skipping`);
        return null;
      }

      // キロ程（m単位の整数、または小数）
      const kilometerStr = parts[0];
      const kilometer = this.parseKilometer(kilometerStr);

      if (kilometer === null) {
        console.warn(`Line ${lineNumber}: Invalid kilometer value "${kilometerStr}", skipping`);
        return null;
      }

      // 地点番号（整数）
      const pointNumber = parts.length > 1 ? parseInt(parts[1], 10) : 0;

      // 地点種別（DD, WB, ST, BR, TN, SWなど）
      const pointType = parts.length > 2 ? parts[2] : '';

      // 説明
      const description = parts.length > 3 ? parts.slice(3).join(',') : '';

      return {
        kilometer,
        pointNumber,
        pointType,
        pointTypeName: this.POINT_TYPE_MAP[pointType] || pointType,
        description
      };
    } catch (error) {
      console.error(`Line ${lineNumber}: Parse error -`, error);
      return null;
    }
  }

  /**
   * キロ程文字列をパース
   * 対応形式:
   * - 整数: "1000" → 1000m
   * - 小数: "1000.5" → 1000.5m
   * - キロ+メートル: "1K000" → 1000m
   * - キロ+メートル+cm: "1K000+50" → 1000.5m
   * @param {string} kilometerStr - キロ程文字列
   * @returns {number|null} キロ程（m単位）
   */
  parseKilometer(kilometerStr) {
    if (!kilometerStr) return null;

    try {
      // "1K000+50" 形式（キロ+メートル+cm）
      if (kilometerStr.includes('K')) {
        const parts = kilometerStr.split('K');
        if (parts.length !== 2) return null;

        const km = parseInt(parts[0], 10);
        let meters = 0;
        let cm = 0;

        if (parts[1].includes('+')) {
          const meterParts = parts[1].split('+');
          meters = parseInt(meterParts[0], 10);
          cm = parseInt(meterParts[1], 10);
        } else {
          meters = parseInt(parts[1], 10);
        }

        return km * 1000 + meters + cm / 100;
      }

      // 通常の数値形式
      const value = parseFloat(kilometerStr);
      return isNaN(value) ? null : value;
    } catch (error) {
      return null;
    }
  }

  /**
   * 指定キロ程の地点情報を検索
   * @param {PNTData} pntData - PNTデータ
   * @param {number} kilometer - 検索するキロ程（m単位）
   * @param {number} tolerance - 許容誤差（m単位）デフォルト: 1m
   * @returns {PNTRecord|null} 見つかった地点情報
   */
  findPointAtKilometer(pntData, kilometer, tolerance = 1.0) {
    const { points } = pntData;

    for (const point of points) {
      if (Math.abs(point.kilometer - kilometer) <= tolerance) {
        return point;
      }
    }

    return null;
  }

  /**
   * 指定範囲内の地点情報を検索
   * @param {PNTData} pntData - PNTデータ
   * @param {number} startKm - 開始キロ程（m単位）
   * @param {number} endKm - 終了キロ程（m単位）
   * @returns {PNTRecord[]} 範囲内の地点情報配列
   */
  findPointsInRange(pntData, startKm, endKm) {
    const { points } = pntData;

    return points.filter(point => {
      return point.kilometer >= startKm && point.kilometer <= endKm;
    });
  }

  /**
   * 地点種別でフィルタリング
   * @param {PNTData} pntData - PNTデータ
   * @param {string} pointType - 地点種別（DD, WB, ST, BR, TN, SW）
   * @returns {PNTRecord[]} フィルタリングされた地点情報配列
   */
  filterByPointType(pntData, pointType) {
    const { points } = pntData;

    return points.filter(point => point.pointType === pointType);
  }

  /**
   * PNTデータをCSV文字列に変換
   * @param {PNTData} pntData - PNTデータ
   * @returns {string} CSV文字列
   */
  toCSV(pntData) {
    const lines = [];

    // ヘッダー行
    if (pntData.lineCode || pntData.direction) {
      lines.push(`#${pntData.lineCode},${pntData.direction}`);
    }

    // データ行
    for (const point of pntData.points) {
      const parts = [
        point.kilometer.toString(),
        point.pointNumber.toString(),
        point.pointType,
        point.description
      ];
      lines.push(parts.join(','));
    }

    return lines.join('\n');
  }

  /**
   * PNTデータをキロ程順にソート
   * @param {PNTData} pntData - PNTデータ
   * @returns {PNTData} ソート済みPNTデータ
   */
  sortByKilometer(pntData) {
    const sorted = { ...pntData };
    sorted.points = [...pntData.points].sort((a, b) => a.kilometer - b.kilometer);
    return sorted;
  }
}

module.exports = { PNTParser };

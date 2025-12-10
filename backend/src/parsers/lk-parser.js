/**
 * LKファイルパーサー
 * キヤデータの線区管理ファイル（LK*.csv）を解析
 */

export class LKParser {
  constructor() {
    this.sections = [];
    this.managementValues = [];
    this.managementSections = [];
  }

  /**
   * LKファイルのテキストを解析
   * @param {string} text - LKファイルの内容
   * @returns {Object} パース結果
   */
  parse(text) {
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // 空行をスキップ
      if (!trimmed) continue;

      // コメント行をスキップ
      if (trimmed.startsWith('#')) continue;

      // LKマーカー（区間定義）
      if (trimmed.startsWith('LK')) {
        this.sections.push(this.parseSection(trimmed));
      }
      // Lマーカー（管理値）
      else if (trimmed.startsWith('L') && trimmed.match(/^L\d+,/)) {
        this.managementValues.push(this.parseManagementValue(trimmed));
      }
      // Kマーカー（管理区間）
      else if (trimmed.startsWith('K') && trimmed.match(/^K\d+,/)) {
        this.managementSections.push(this.parseManagementSection(trimmed));
      }
      // EOD
      else if (trimmed === 'EOD') {
        break;
      }
    }

    return {
      sections: this.sections,
      managementValues: this.managementValues,
      managementSections: this.managementSections
    };
  }

  /**
   * LK行（区間定義）の解析
   * LK01,岩国線(下),三田尻～徳山駅出
   * @param {string} line - LK行
   * @returns {Object} 区間情報
   */
  parseSection(line) {
    const parts = line.split(',');

    return {
      marker: parts[0]?.trim() || '',
      routeName: parts[1]?.trim() || '',
      sectionName: parts[2]?.trim() || ''
    };
  }

  /**
   * L行（管理値）の解析
   * L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200,...
   * @param {string} line - L行
   * @returns {Object} 管理値情報
   */
  parseManagementValue(line) {
    const parts = line.split(',').map(p => p.trim());

    return {
      marker: parts[0] || '',
      startKm: parseFloat(parts[1]) || 0,
      endKm: parseFloat(parts[2]) || 0,
      lineCode: parts[3] || '',
      routeCode: parts[4] || '',
      construction: parts[5] || '',
      type: parts[6] || '',

      // 直線部管理値（mm）
      standard10m: this.parseValue(parts[7]),
      straightness10m: this.parseValue(parts[8]),
      gauge: this.parseValue(parts[9]),
      elevation: this.parseValue(parts[10]),
      levelPlus: this.parseValue(parts[11]),
      levelMinus: this.parseValue(parts[12]),
      trackUpDown: this.parseValue(parts[13]),
      trackLeftRight: this.parseValue(parts[14]),

      // 2組目の管理値（予備）
      standard10m2: this.parseValue(parts[15]),
      straightness10m2: this.parseValue(parts[16]),
      gauge2: this.parseValue(parts[17]),
      elevation2: this.parseValue(parts[18]),
      levelPlus2: this.parseValue(parts[19]),
      levelMinus2: this.parseValue(parts[20]),
      trackUpDown2: this.parseValue(parts[21]),
      trackLeftRight2: this.parseValue(parts[22]),

      // 曲線部管理値
      curveStandard: this.parseValue(parts[23]),
      straightness: this.parseValue(parts[24]),
      irregularity: this.parseValue(parts[25]),
      sharpness: this.parseValue(parts[26]),
      curveUpDown: this.parseValue(parts[27]),
      curveLeftRight: this.parseValue(parts[28])
    };
  }

  /**
   * K行（管理区間）の解析
   * K01,000.000,001.268,229,1,616,77027,7,0
   * @param {string} line - K行
   * @returns {Object} 管理区間情報
   */
  parseManagementSection(line) {
    const parts = line.split(',').map(p => p.trim());

    return {
      marker: parts[0] || '',
      startKm: parseFloat(parts[1]) || 0,
      endKm: parseFloat(parts[2]) || 0,
      lineCode: parts[3] || '',
      division: parts[4] || '',
      workArea: parts[5] || '',
      workNumber: parts[6] || '',
      flag1: parts[7] || '',
      flag2: parts[8] || ''
    };
  }

  /**
   * 値のパース（9999は無効値として扱う）
   * @param {string} value - 値の文字列
   * @returns {number|null} パース結果
   */
  parseValue(value) {
    if (!value) return null;

    const num = parseInt(value);

    // 9999は無効値
    if (num === 9999 || isNaN(num)) {
      return null;
    }

    return num;
  }
}

/**
 * LKファイルをパースする便利関数
 * @param {string} text - LKファイルの内容
 * @returns {Object} パース結果
 */
export function parseLK(text) {
  const parser = new LKParser();
  return parser.parse(text);
}

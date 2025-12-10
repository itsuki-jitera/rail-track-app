/**
 * 曲線諸元データパーサー (VB6 KCDW互換)
 *
 * CSV形式の曲線諸元データを解析し、構造化データに変換
 *
 * CSVフォーマット:
 * 開始KP,終了KP,曲線種別,半径,カント,方向,ラベル
 * 0.000,3.000,straight,,,直線区間1
 * 3.000,5.000,transition,,,緩和曲線1
 * 5.000,9.000,circular,600,80,right,R600円曲線
 */

class CurveSpecParser {
  /**
   * CSV文字列を曲線諸元データに変換
   * @param {string} csvContent - CSV文字列
   * @returns {Object} 変換結果
   */
  static parseCurveSpecCSV(csvContent) {
    try {
      const lines = csvContent.trim().split('\n');
      const curveSpecs = [];
      const errors = [];

      // ヘッダー行をスキップ（存在する場合）
      const startIndex = this.hasHeader(lines[0]) ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const curveSpec = this.parseCurveSpecLine(line, i + 1);
          if (curveSpec) {
            curveSpecs.push(curveSpec);
          }
        } catch (error) {
          errors.push({
            line: i + 1,
            content: line,
            error: error.message
          });
        }
      }

      return {
        success: errors.length === 0,
        curveSpecs,
        errors,
        summary: {
          totalCurves: curveSpecs.length,
          straightCount: curveSpecs.filter(c => c.curveType === 'straight').length,
          transitionCount: curveSpecs.filter(c => c.curveType === 'transition').length,
          circularCount: curveSpecs.filter(c => c.curveType === 'circular').length,
          totalLength: curveSpecs.reduce((sum, c) => sum + (c.endKP - c.startKP), 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        curveSpecs: [],
        errors: [{ error: error.message }],
        summary: null
      };
    }
  }

  /**
   * 1行の曲線諸元データを解析
   * @param {string} line - CSV行
   * @param {number} lineNumber - 行番号
   * @returns {Object} 曲線諸元オブジェクト
   */
  static parseCurveSpecLine(line, lineNumber) {
    const parts = line.split(',').map(p => p.trim());

    if (parts.length < 3) {
      throw new Error(`不正なフォーマット: 最低3列必要 (開始KP,終了KP,曲線種別)`);
    }

    const startKP = this.parseFloat(parts[0], '開始KP');
    const endKP = this.parseFloat(parts[1], '終了KP');
    const curveType = this.parseCurveType(parts[2]);
    const radius = parts[3] ? this.parseFloat(parts[3], '半径', true) : null;
    const cant = parts[4] ? this.parseFloat(parts[4], 'カント', true) : null;
    const direction = parts[5] ? this.parseDirection(parts[5]) : null;
    const label = parts[6] || '';

    // バリデーション
    if (startKP >= endKP) {
      throw new Error(`開始KP (${startKP}) は終了KP (${endKP}) より小さくなければなりません`);
    }

    if (curveType === 'circular' && !radius) {
      throw new Error(`円曲線には半径の指定が必要です`);
    }

    return {
      startKP,
      endKP,
      curveType,
      radius,
      cant,
      direction,
      label,
      length: endKP - startKP
    };
  }

  /**
   * 浮動小数点数をパース
   */
  static parseFloat(value, fieldName, allowNull = false) {
    if (!value && allowNull) return null;

    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName}が不正な数値です: "${value}"`);
    }
    return num;
  }

  /**
   * 曲線種別をパース
   */
  static parseCurveType(value) {
    const normalized = value.toLowerCase().trim();

    const typeMap = {
      'straight': 'straight',
      '直線': 'straight',
      'st': 'straight',
      'transition': 'transition',
      '緩和': 'transition',
      '緩和曲線': 'transition',
      'tr': 'transition',
      'circular': 'circular',
      '円曲線': 'circular',
      'cr': 'circular',
      'curve': 'circular'
    };

    const curveType = typeMap[normalized];
    if (!curveType) {
      throw new Error(`不正な曲線種別: "${value}" (straight/transition/circular のいずれかを指定してください)`);
    }

    return curveType;
  }

  /**
   * 方向をパース
   */
  static parseDirection(value) {
    const normalized = value.toLowerCase().trim();

    const directionMap = {
      'left': 'left',
      '左': 'left',
      'l': 'left',
      'right': 'right',
      '右': 'right',
      'r': 'right'
    };

    return directionMap[normalized] || null;
  }

  /**
   * ヘッダー行かどうかを判定
   */
  static hasHeader(line) {
    const lowerLine = line.toLowerCase();
    return lowerLine.includes('kp') ||
           lowerLine.includes('キロ程') ||
           lowerLine.includes('曲線種別') ||
           lowerLine.includes('curve');
  }

  /**
   * 曲線諸元データをCSV形式に変換
   */
  static toCurveSpecCSV(curveSpecs, includeHeader = true) {
    const lines = [];

    if (includeHeader) {
      lines.push('開始KP,終了KP,曲線種別,半径,カント,方向,ラベル');
    }

    for (const spec of curveSpecs) {
      const row = [
        spec.startKP.toFixed(3),
        spec.endKP.toFixed(3),
        spec.curveType,
        spec.radius || '',
        spec.cant || '',
        spec.direction || '',
        spec.label || ''
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * キロ程範囲から曲線諸元を検索
   */
  static findCurvesInRange(curveSpecs, startKP, endKP) {
    return curveSpecs.filter(spec => {
      return !(spec.endKP <= startKP || spec.startKP >= endKP);
    });
  }

  /**
   * 曲線諸元の連続性をチェック
   */
  static validateContinuity(curveSpecs) {
    const errors = [];
    const sorted = [...curveSpecs].sort((a, b) => a.startKP - b.startKP);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // ギャップのチェック
      if (current.endKP < next.startKP) {
        errors.push({
          type: 'gap',
          message: `${current.endKP.toFixed(3)}km - ${next.startKP.toFixed(3)}km に曲線諸元が定義されていません`,
          kp: current.endKP
        });
      }

      // 重複のチェック
      if (current.endKP > next.startKP) {
        errors.push({
          type: 'overlap',
          message: `${next.startKP.toFixed(3)}km - ${current.endKP.toFixed(3)}km で曲線諸元が重複しています`,
          kp: next.startKP
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = CurveSpecParser;

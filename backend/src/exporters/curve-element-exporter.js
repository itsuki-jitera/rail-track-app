/**
 * 曲線諸元ファイルエクスポーター (.KS.TXT形式)
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P36に基づく実装
 * - 平面曲線諸元データの入出力
 * - 縦曲線諸元データの入出力
 */

const fs = require('fs').promises;
const path = require('path');

class CurveElementExporter {
  constructor() {
    this.version = '1.0.0';
  }

  /**
   * 曲線諸元をエクスポート
   * @param {Object} curveData - 曲線諸元データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 出力ファイルパス
   */
  async exportCurveElements(curveData, workSection) {
    const content = this.generateKSContent(curveData, workSection);
    const fileName = this.generateKSFileName(workSection);
    const outputDir = workSection.outputDir || './output';
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * .KS.TXT形式のコンテンツを生成
   * @param {Object} curveData - 曲線データ
   * @param {Object} workSection - 作業区間
   * @returns {string} KSファイル内容
   */
  generateKSContent(curveData, workSection) {
    const lines = [];

    // ファイルヘッダー
    lines.push('*************************************************************');
    lines.push('*  曲線諸元データファイル                                  *');
    lines.push('*  Rail Track Alignment System Ver 1.0                     *');
    lines.push('*************************************************************');
    lines.push('');

    // 作業区間情報
    lines.push('[WORK_INFORMATION]');
    lines.push(`路線名: ${workSection.lineName || ''}`);
    lines.push(`線名: ${workSection.trackName || ''}`);
    lines.push(`方向: ${workSection.direction === 'up' ? '上り' : '下り'}`);
    lines.push(`作業範囲: ${this.formatKilometer(workSection.startKm)} - ${this.formatKilometer(workSection.endKm)}`);
    lines.push(`作業日: ${workSection.workDate || new Date().toISOString().split('T')[0]}`);
    lines.push(`作成日時: ${new Date().toISOString()}`);
    lines.push('');

    // 平面曲線諸元
    lines.push('[HORIZONTAL_CURVES]');
    lines.push('# 平面曲線諸元（通り）');
    lines.push('# No, 開始キロ程(m), 終了キロ程(m), 半径(m), 方向, カント(mm), 緩和曲線長(m), 種別, 設計速度(km/h), 備考');
    lines.push('');

    if (curveData.horizontalCurves && curveData.horizontalCurves.length > 0) {
      curveData.horizontalCurves.forEach((curve, index) => {
        const no = (index + 1).toString().padStart(3, '0');
        const startKm = curve.startKm.toFixed(3);
        const endKm = curve.endKm.toFixed(3);
        const radius = curve.radius.toFixed(1);
        const direction = curve.direction === 'right' ? 'R' : 'L';
        const cant = (curve.cant || 0).toFixed(0);
        const transitionLength = (curve.transitionLength || 0).toFixed(1);
        const type = this.formatCurveType(curve.type);
        const speed = (curve.speed || 0).toFixed(0);
        const notes = curve.notes || '';

        lines.push(`${no}, ${startKm}, ${endKm}, ${radius}, ${direction}, ${cant}, ${transitionLength}, ${type}, ${speed}, ${notes}`);
      });
    } else {
      lines.push('# データなし');
    }
    lines.push('');

    // 縦曲線諸元
    lines.push('[VERTICAL_CURVES]');
    lines.push('# 縦曲線諸元（高低）');
    lines.push('# No, 開始キロ程(m), 終了キロ程(m), 半径(m), 種別, 開始勾配(‰), 終了勾配(‰), 備考');
    lines.push('');

    if (curveData.verticalCurves && curveData.verticalCurves.length > 0) {
      curveData.verticalCurves.forEach((curve, index) => {
        const no = (index + 1).toString().padStart(3, '0');
        const startKm = curve.startKm.toFixed(3);
        const endKm = curve.endKm.toFixed(3);
        const radius = curve.radius.toFixed(1);
        const type = curve.type === 'convex' ? 'CONVEX' : 'CONCAVE';
        const startGradient = (curve.startGradient || 0).toFixed(1);
        const endGradient = (curve.endGradient || 0).toFixed(1);
        const notes = curve.notes || '';

        lines.push(`${no}, ${startKm}, ${endKm}, ${radius}, ${type}, ${startGradient}, ${endGradient}, ${notes}`);
      });
    } else {
      lines.push('# データなし');
    }
    lines.push('');

    // 勾配区間
    lines.push('[GRADIENT_SECTIONS]');
    lines.push('# 勾配区間');
    lines.push('# No, 開始キロ程(m), 終了キロ程(m), 勾配(‰), 備考');
    lines.push('');

    if (curveData.gradientSections && curveData.gradientSections.length > 0) {
      curveData.gradientSections.forEach((section, index) => {
        const no = (index + 1).toString().padStart(3, '0');
        const startKm = section.startKm.toFixed(3);
        const endKm = section.endKm.toFixed(3);
        const gradient = section.gradient.toFixed(1);
        const notes = section.notes || '';

        lines.push(`${no}, ${startKm}, ${endKm}, ${gradient}, ${notes}`);
      });
    } else {
      lines.push('# データなし');
    }
    lines.push('');

    // 統計情報
    lines.push('[STATISTICS]');
    lines.push('# 統計情報');

    const hCurves = curveData.horizontalCurves || [];
    const vCurves = curveData.verticalCurves || [];
    const gSections = curveData.gradientSections || [];

    lines.push(`平面曲線数: ${hCurves.length}`);
    lines.push(`  右カーブ: ${hCurves.filter(c => c.direction === 'right').length}`);
    lines.push(`  左カーブ: ${hCurves.filter(c => c.direction === 'left').length}`);

    if (hCurves.length > 0) {
      const minRadius = Math.min(...hCurves.map(c => c.radius));
      const maxRadius = Math.max(...hCurves.map(c => c.radius));
      const avgRadius = hCurves.reduce((sum, c) => sum + c.radius, 0) / hCurves.length;

      lines.push(`  最小半径: ${minRadius.toFixed(1)}m`);
      lines.push(`  最大半径: ${maxRadius.toFixed(1)}m`);
      lines.push(`  平均半径: ${avgRadius.toFixed(1)}m`);

      const maxCant = Math.max(...hCurves.map(c => c.cant || 0));
      lines.push(`  最大カント: ${maxCant}mm`);
    }

    lines.push('');
    lines.push(`縦曲線数: ${vCurves.length}`);
    lines.push(`  凸型: ${vCurves.filter(c => c.type === 'convex').length}`);
    lines.push(`  凹型: ${vCurves.filter(c => c.type === 'concave').length}`);

    if (vCurves.length > 0) {
      const minRadius = Math.min(...vCurves.map(c => c.radius));
      const maxRadius = Math.max(...vCurves.map(c => c.radius));
      const avgRadius = vCurves.reduce((sum, c) => sum + c.radius, 0) / vCurves.length;

      lines.push(`  最小半径: ${minRadius.toFixed(1)}m`);
      lines.push(`  最大半径: ${maxRadius.toFixed(1)}m`);
      lines.push(`  平均半径: ${avgRadius.toFixed(1)}m`);
    }

    lines.push('');
    lines.push(`勾配区間数: ${gSections.length}`);

    if (gSections.length > 0) {
      const maxGradient = Math.max(...gSections.map(s => Math.abs(s.gradient)));
      lines.push(`  最大勾配: ${maxGradient.toFixed(1)}‰`);

      const totalLength = gSections.reduce((sum, s) => sum + (s.endKm - s.startKm), 0);
      const avgGradient = gSections.reduce((sum, s) =>
        sum + Math.abs(s.gradient) * (s.endKm - s.startKm), 0) / totalLength;
      lines.push(`  平均勾配: ${avgGradient.toFixed(1)}‰`);
    }

    lines.push('');
    lines.push('[END_OF_FILE]');

    return lines.join('\n');
  }

  /**
   * 曲線諸元をインポート
   * @param {string} filePath - KSファイルパス
   * @returns {Promise<Object>} 曲線諸元データ
   */
  async importCurveElements(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return this.parseKSContent(content);
  }

  /**
   * KSファイル内容をパース
   * @param {string} content - ファイル内容
   * @returns {Object} 曲線諸元データ
   */
  parseKSContent(content) {
    const lines = content.split('\n');
    const curveData = {
      horizontalCurves: [],
      verticalCurves: [],
      gradientSections: [],
      workSection: {}
    };

    let currentSection = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // コメントまたは空行をスキップ
      if (trimmedLine.startsWith('#') || trimmedLine === '' || trimmedLine.startsWith('*')) {
        continue;
      }

      // セクション検出
      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        currentSection = trimmedLine.slice(1, -1);
        continue;
      }

      // セクション別処理
      switch (currentSection) {
        case 'WORK_INFORMATION':
          this.parseWorkInformation(trimmedLine, curveData.workSection);
          break;

        case 'HORIZONTAL_CURVES':
          this.parseHorizontalCurve(trimmedLine, curveData.horizontalCurves);
          break;

        case 'VERTICAL_CURVES':
          this.parseVerticalCurve(trimmedLine, curveData.verticalCurves);
          break;

        case 'GRADIENT_SECTIONS':
          this.parseGradientSection(trimmedLine, curveData.gradientSections);
          break;
      }
    }

    return curveData;
  }

  /**
   * 作業情報をパース
   * @param {string} line - 行データ
   * @param {Object} workSection - 作業区間オブジェクト
   */
  parseWorkInformation(line, workSection) {
    const [key, value] = line.split(':').map(s => s.trim());

    switch (key) {
      case '路線名':
        workSection.lineName = value;
        break;
      case '線名':
        workSection.trackName = value;
        break;
      case '方向':
        workSection.direction = value === '上り' ? 'up' : 'down';
        break;
      case '作業日':
        workSection.workDate = value;
        break;
    }
  }

  /**
   * 平面曲線データをパース
   * @param {string} line - 行データ
   * @param {Array} curves - 曲線配列
   */
  parseHorizontalCurve(line, curves) {
    const parts = line.split(',').map(s => s.trim());

    if (parts.length >= 8) {
      curves.push({
        startKm: parseFloat(parts[1]),
        endKm: parseFloat(parts[2]),
        radius: parseFloat(parts[3]),
        direction: parts[4] === 'R' ? 'right' : 'left',
        cant: parseFloat(parts[5]) || 0,
        transitionLength: parseFloat(parts[6]) || 0,
        type: this.parseCurveType(parts[7]),
        speed: parseFloat(parts[8]) || 0,
        notes: parts[9] || ''
      });
    }
  }

  /**
   * 縦曲線データをパース
   * @param {string} line - 行データ
   * @param {Array} curves - 曲線配列
   */
  parseVerticalCurve(line, curves) {
    const parts = line.split(',').map(s => s.trim());

    if (parts.length >= 6) {
      curves.push({
        startKm: parseFloat(parts[1]),
        endKm: parseFloat(parts[2]),
        radius: parseFloat(parts[3]),
        type: parts[4] === 'CONVEX' ? 'convex' : 'concave',
        startGradient: parseFloat(parts[5]) || 0,
        endGradient: parseFloat(parts[6]) || 0,
        notes: parts[7] || ''
      });
    }
  }

  /**
   * 勾配区間データをパース
   * @param {string} line - 行データ
   * @param {Array} sections - 勾配区間配列
   */
  parseGradientSection(line, sections) {
    const parts = line.split(',').map(s => s.trim());

    if (parts.length >= 4) {
      sections.push({
        startKm: parseFloat(parts[1]),
        endKm: parseFloat(parts[2]),
        gradient: parseFloat(parts[3]),
        notes: parts[4] || ''
      });
    }
  }

  /**
   * 曲線種別をフォーマット
   * @param {string} type - 曲線種別
   * @returns {string} フォーマット済み種別
   */
  formatCurveType(type) {
    const typeMap = {
      'circular': 'CIRCULAR',
      'transition': 'TRANSITION',
      'compound': 'COMPOUND',
      'clothoid': 'CLOTHOID',
      'cubic': 'CUBIC',
      'sine': 'SINE'
    };
    return typeMap[type] || type.toUpperCase();
  }

  /**
   * 曲線種別をパース
   * @param {string} typeStr - 種別文字列
   * @returns {string} 曲線種別
   */
  parseCurveType(typeStr) {
    const typeMap = {
      'CIRCULAR': 'circular',
      'TRANSITION': 'transition',
      'COMPOUND': 'compound',
      'CLOTHOID': 'clothoid',
      'CUBIC': 'cubic',
      'SINE': 'sine'
    };
    return typeMap[typeStr] || typeStr.toLowerCase();
  }

  /**
   * キロ程をフォーマット
   * @param {number} meters - メートル値
   * @returns {string} フォーマット済みキロ程
   */
  formatKilometer(meters) {
    const km = Math.floor(meters / 1000);
    const m = meters % 1000;
    return `${km}k${m.toFixed(3).padStart(7, '0')}m`;
  }

  /**
   * KSファイル名を生成
   * @param {Object} workSection - 作業区間情報
   * @returns {string} ファイル名
   */
  generateKSFileName(workSection) {
    const prefix = workSection.filePrefix || 'CURVE';
    return `${prefix}.KS.TXT`;
  }

  /**
   * 曲線諸元の検証
   * @param {Object} curveData - 曲線諸元データ
   * @returns {Object} 検証結果
   */
  validateCurveElements(curveData) {
    const errors = [];
    const warnings = [];

    // 平面曲線の検証
    if (curveData.horizontalCurves) {
      curveData.horizontalCurves.forEach((curve, index) => {
        // 半径チェック
        if (curve.radius < 100) {
          warnings.push(`平面曲線${index + 1}: 半径が100m未満です (R=${curve.radius}m)`);
        }

        // カントチェック
        if (curve.cant > 200) {
          errors.push(`平面曲線${index + 1}: カントが200mmを超えています (C=${curve.cant}mm)`);
        }

        // 緩和曲線長チェック
        if (curve.transitionLength > 0 && curve.transitionLength < 20) {
          warnings.push(`平面曲線${index + 1}: 緩和曲線長が20m未満です`);
        }
      });
    }

    // 縦曲線の検証
    if (curveData.verticalCurves) {
      curveData.verticalCurves.forEach((curve, index) => {
        // 半径チェック
        if (curve.radius < 2000) {
          warnings.push(`縦曲線${index + 1}: 半径が2000m未満です (R=${curve.radius}m)`);
        }

        // 曲線長チェック
        const length = curve.endKm - curve.startKm;
        if (length < 100) {
          warnings.push(`縦曲線${index + 1}: 曲線長が100m未満です (L=${length}m)`);
        }
      });
    }

    // 勾配区間の検証
    if (curveData.gradientSections) {
      curveData.gradientSections.forEach((section, index) => {
        // 勾配チェック
        if (Math.abs(section.gradient) > 35) {
          warnings.push(`勾配区間${index + 1}: 勾配が35‰を超えています (${section.gradient}‰)`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = CurveElementExporter;
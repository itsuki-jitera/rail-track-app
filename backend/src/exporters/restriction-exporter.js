/**
 * 移動量制限箇所ファイルエクスポーター (.I1.TXT, .I3.TXT形式)
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P36に基づく実装
 * - .I1.TXT: 左右方向の移動量制限箇所
 * - .I3.TXT: 上下方向の移動量制限箇所
 */

const fs = require('fs').promises;
const path = require('path');

class RestrictionExporter {
  constructor() {
    this.version = '1.0.0';
  }

  /**
   * 移動量制限箇所をエクスポート
   * @param {Array} restrictions - 制限箇所データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<Object>} 出力ファイルパス
   */
  async exportRestrictions(restrictions, workSection) {
    const lateralRestrictions = restrictions.filter(r =>
      r.direction === 'left' || r.direction === 'right' || r.direction === 'both'
    );

    const verticalRestrictions = restrictions.filter(r =>
      r.direction === 'vertical'
    );

    const outputDir = workSection.outputDir || './output';

    // 左右方向制限ファイル出力
    const lateralFile = await this.exportLateralRestrictions(
      lateralRestrictions,
      workSection,
      outputDir
    );

    // 上下方向制限ファイル出力
    const verticalFile = await this.exportVerticalRestrictions(
      verticalRestrictions,
      workSection,
      outputDir
    );

    return {
      lateral: lateralFile,
      vertical: verticalFile
    };
  }

  /**
   * 左右方向制限を.I1.TXTとして出力
   * @param {Array} restrictions - 左右方向制限データ
   * @param {Object} workSection - 作業区間情報
   * @param {string} outputDir - 出力ディレクトリ
   * @returns {Promise<string>} 出力ファイルパス
   */
  async exportLateralRestrictions(restrictions, workSection, outputDir) {
    const content = this.generateI1Content(restrictions, workSection);
    const fileName = this.generateI1FileName(workSection);
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * 上下方向制限を.I3.TXTとして出力
   * @param {Array} restrictions - 上下方向制限データ
   * @param {Object} workSection - 作業区間情報
   * @param {string} outputDir - 出力ディレクトリ
   * @returns {Promise<string>} 出力ファイルパス
   */
  async exportVerticalRestrictions(restrictions, workSection, outputDir) {
    const content = this.generateI3Content(restrictions, workSection);
    const fileName = this.generateI3FileName(workSection);
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * .I1.TXT形式のコンテンツを生成（左右方向制限）
   * @param {Array} restrictions - 制限データ
   * @param {Object} workSection - 作業区間
   * @returns {string} I1ファイル内容
   */
  generateI1Content(restrictions, workSection) {
    const lines = [];

    // ヘッダー
    lines.push('*** 左右方向移動量制限箇所 ***');
    lines.push(`路線名: ${workSection.lineName || ''}`);
    lines.push(`線名: ${workSection.trackName || ''}`);
    lines.push(`作業方向: ${workSection.direction === 'up' ? '上り' : '下り'}`);
    lines.push(`作業日: ${workSection.workDate || new Date().toISOString().split('T')[0]}`);
    lines.push(`作成日時: ${new Date().toISOString()}`);
    lines.push('');

    // カラムヘッダー
    lines.push('No.\t開始キロ程\t終了キロ程\t方向\t制限量(mm)\t区分\t備考');
    lines.push('-'.repeat(80));

    // データ行
    restrictions.forEach((restriction, index) => {
      const no = (index + 1).toString().padStart(3, ' ');
      const startKm = this.formatKilometer(restriction.startKm);
      const endKm = this.formatKilometer(restriction.endKm);
      const direction = this.formatDirection(restriction.direction);
      const amount = this.formatAmount(restriction.restrictionAmount);
      const type = restriction.isFixed ? '不動点' : '制限';
      const notes = restriction.notes || '';

      lines.push(`${no}\t${startKm}\t${endKm}\t${direction}\t${amount}\t${type}\t${notes}`);
    });

    // サマリー
    lines.push('-'.repeat(80));
    lines.push(`合計: ${restrictions.length}箇所`);

    const fixedCount = restrictions.filter(r => r.isFixed).length;
    const limitedCount = restrictions.length - fixedCount;

    lines.push(`  不動点: ${fixedCount}箇所`);
    lines.push(`  制限箇所: ${limitedCount}箇所`);

    // 方向別集計
    const leftCount = restrictions.filter(r => r.direction === 'left').length;
    const rightCount = restrictions.filter(r => r.direction === 'right').length;
    const bothCount = restrictions.filter(r => r.direction === 'both').length;

    lines.push('');
    lines.push('【方向別集計】');
    lines.push(`  左のみ: ${leftCount}箇所`);
    lines.push(`  右のみ: ${rightCount}箇所`);
    lines.push(`  両方: ${bothCount}箇所`);

    return lines.join('\n');
  }

  /**
   * .I3.TXT形式のコンテンツを生成（上下方向制限）
   * @param {Array} restrictions - 制限データ
   * @param {Object} workSection - 作業区間
   * @returns {string} I3ファイル内容
   */
  generateI3Content(restrictions, workSection) {
    const lines = [];

    // ヘッダー
    lines.push('*** 上下方向移動量制限箇所 ***');
    lines.push(`路線名: ${workSection.lineName || ''}`);
    lines.push(`線名: ${workSection.trackName || ''}`);
    lines.push(`作業方向: ${workSection.direction === 'up' ? '上り' : '下り'}`);
    lines.push(`作業日: ${workSection.workDate || new Date().toISOString().split('T')[0]}`);
    lines.push(`作成日時: ${new Date().toISOString()}`);
    lines.push('');

    // カラムヘッダー
    lines.push('No.\t開始キロ程\t終了キロ程\t制限量(mm)\t区分\t備考');
    lines.push('-'.repeat(70));

    // データ行
    restrictions.forEach((restriction, index) => {
      const no = (index + 1).toString().padStart(3, ' ');
      const startKm = this.formatKilometer(restriction.startKm);
      const endKm = this.formatKilometer(restriction.endKm);
      const amount = this.formatAmount(restriction.restrictionAmount);
      const type = restriction.isFixed ? '不動点' : '制限';
      const notes = restriction.notes || '';

      lines.push(`${no}\t${startKm}\t${endKm}\t${amount}\t${type}\t${notes}`);
    });

    // サマリー
    lines.push('-'.repeat(70));
    lines.push(`合計: ${restrictions.length}箇所`);

    const fixedCount = restrictions.filter(r => r.isFixed).length;
    const limitedCount = restrictions.length - fixedCount;

    lines.push(`  不動点: ${fixedCount}箇所`);
    lines.push(`  制限箇所: ${limitedCount}箇所`);

    // 制限量別集計
    lines.push('');
    lines.push('【制限量別集計】');

    const ranges = [
      { min: 0, max: 0, label: '不動点（0mm）' },
      { min: 0.1, max: 5, label: '5mm以下' },
      { min: 5.1, max: 10, label: '5-10mm' },
      { min: 10.1, max: 20, label: '10-20mm' },
      { min: 20.1, max: 30, label: '20-30mm' },
      { min: 30.1, max: Infinity, label: '30mm超' }
    ];

    ranges.forEach(range => {
      const count = restrictions.filter(r => {
        const amount = r.restrictionAmount;
        if (range.min === 0 && range.max === 0) {
          return amount === 0 || r.isFixed;
        }
        return amount >= range.min && amount <= range.max;
      }).length;

      if (count > 0) {
        lines.push(`  ${range.label}: ${count}箇所`);
      }
    });

    return lines.join('\n');
  }

  /**
   * 制限データをインポート
   * @param {string} filePath - ファイルパス
   * @param {string} type - 'lateral' または 'vertical'
   * @returns {Promise<Array>} 制限データ配列
   */
  async importRestrictions(filePath, type) {
    const content = await fs.readFile(filePath, 'utf8');

    if (type === 'lateral') {
      return this.parseI1Content(content);
    } else if (type === 'vertical') {
      return this.parseI3Content(content);
    }

    throw new Error(`Unknown restriction type: ${type}`);
  }

  /**
   * I1ファイル内容をパース
   * @param {string} content - ファイル内容
   * @returns {Array} 制限データ
   */
  parseI1Content(content) {
    const lines = content.split('\n');
    const restrictions = [];
    let isDataSection = false;

    for (const line of lines) {
      // データセクション開始を検出
      if (line.includes('No.\t開始キロ程')) {
        isDataSection = true;
        continue;
      }

      // データセクション終了を検出
      if (isDataSection && line.startsWith('-'.repeat(10))) {
        break;
      }

      // データ行をパース
      if (isDataSection && line.trim() && !line.startsWith('-')) {
        const parts = line.split('\t');
        if (parts.length >= 6) {
          restrictions.push({
            startKm: this.parseKilometer(parts[1]),
            endKm: this.parseKilometer(parts[2]),
            direction: this.parseDirection(parts[3]),
            restrictionAmount: parseFloat(parts[4]) || 0,
            isFixed: parts[5].includes('不動点'),
            notes: parts[6] || ''
          });
        }
      }
    }

    return restrictions;
  }

  /**
   * I3ファイル内容をパース
   * @param {string} content - ファイル内容
   * @returns {Array} 制限データ
   */
  parseI3Content(content) {
    const lines = content.split('\n');
    const restrictions = [];
    let isDataSection = false;

    for (const line of lines) {
      // データセクション開始を検出
      if (line.includes('No.\t開始キロ程')) {
        isDataSection = true;
        continue;
      }

      // データセクション終了を検出
      if (isDataSection && line.startsWith('-'.repeat(10))) {
        break;
      }

      // データ行をパース
      if (isDataSection && line.trim() && !line.startsWith('-')) {
        const parts = line.split('\t');
        if (parts.length >= 5) {
          restrictions.push({
            startKm: this.parseKilometer(parts[1]),
            endKm: this.parseKilometer(parts[2]),
            direction: 'vertical',
            restrictionAmount: parseFloat(parts[3]) || 0,
            isFixed: parts[4].includes('不動点'),
            notes: parts[5] || ''
          });
        }
      }
    }

    return restrictions;
  }

  /**
   * キロ程をフォーマット（m → km.m形式）
   * @param {number} meters - メートル値
   * @returns {string} フォーマット済みキロ程
   */
  formatKilometer(meters) {
    const km = Math.floor(meters / 1000);
    const m = meters % 1000;
    return `${km}k${m.toFixed(3).padStart(7, '0')}m`;
  }

  /**
   * キロ程文字列をパース
   * @param {string} kmStr - キロ程文字列
   * @returns {number} メートル値
   */
  parseKilometer(kmStr) {
    const match = kmStr.match(/(\d+)k(\d+(?:\.\d+)?)m/);
    if (match) {
      const km = parseInt(match[1], 10);
      const m = parseFloat(match[2]);
      return km * 1000 + m;
    }
    return 0;
  }

  /**
   * 方向をフォーマット
   * @param {string} direction - 方向
   * @returns {string} フォーマット済み方向
   */
  formatDirection(direction) {
    const directionMap = {
      'left': '左',
      'right': '右',
      'both': '左右',
      'vertical': '上下'
    };
    return directionMap[direction] || direction;
  }

  /**
   * 方向文字列をパース
   * @param {string} dirStr - 方向文字列
   * @returns {string} 方向コード
   */
  parseDirection(dirStr) {
    const directionMap = {
      '左': 'left',
      '右': 'right',
      '左右': 'both',
      '上下': 'vertical'
    };
    return directionMap[dirStr] || dirStr;
  }

  /**
   * 制限量をフォーマット
   * @param {number} amount - 制限量
   * @returns {string} フォーマット済み制限量
   */
  formatAmount(amount) {
    return amount.toFixed(1).padStart(6, ' ');
  }

  /**
   * I1ファイル名を生成
   * @param {Object} workSection - 作業区間情報
   * @returns {string} ファイル名
   */
  generateI1FileName(workSection) {
    const prefix = workSection.filePrefix || 'LATERAL';
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `${prefix}.I1.TXT`;
  }

  /**
   * I3ファイル名を生成
   * @param {Object} workSection - 作業区間情報
   * @returns {string} ファイル名
   */
  generateI3FileName(workSection) {
    const prefix = workSection.filePrefix || 'VERTICAL';
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `${prefix}.I3.TXT`;
  }
}

module.exports = RestrictionExporter;
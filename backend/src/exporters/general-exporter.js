/**
 * 汎用移動量データエクスポーター
 * PDFドキュメント P37の仕様に基づく実装
 * CSV形式での汎用データ出力
 */

const fs = require('fs').promises;
const path = require('path');

class GeneralDataExporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './output/IDOU';
    this.dataInterval = 1; // 固定1m間隔
    this.includeWBSections = options.includeWBSections !== false;
  }

  /**
   * 汎用移動量データをCSV形式で出力
   * @param {Object} data - 統合データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 生成されたファイルパス
   */
  async exportGeneralData(data, workSection) {
    try {
      // 出力ディレクトリの作成
      await this.ensureDirectoryExists(this.outputDir);

      // ファイル名の生成
      const fileName = this.generateFileName(workSection);
      const filePath = path.join(this.outputDir, fileName);

      // CSVデータ生成
      const csvData = this.generateCSVData(data, workSection);

      // ファイル出力
      await fs.writeFile(filePath, csvData, 'utf8');

      console.log(`汎用移動量データを出力しました: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('汎用データ出力エラー:', error);
      throw error;
    }
  }

  /**
   * CSVデータを生成
   */
  generateCSVData(data, workSection) {
    const lines = [];

    // ヘッダー行
    lines.push(this.generateHeader());

    // データ行
    const dataLines = this.generateDataLines(data, workSection);
    lines.push(...dataLines);

    return lines.join('\r\n');
  }

  /**
   * CSVヘッダーを生成
   */
  generateHeader() {
    const headers = [
      '線名',
      '線別',
      'W',
      'キロ程',
      '左右方向移動量',
      '左右方向移動量(MTT補正)',
      '左右方向計画線',
      '10m弦通り整備後予測',
      '上下方向移動量',
      '上下方向移動量(MTT補正)',
      '上下方向計画線',
      '10m弦高低整備後予測',
      '軌間',
      '水準',
      '継目検知',
      'ATS検知',
      '手検測軌道狂い'
    ];

    return headers.join(',');
  }

  /**
   * データ行を生成
   */
  generateDataLines(data, workSection) {
    const lines = [];
    const startPosition = workSection.startPosition || 0;

    for (let i = 0; i < data.movements.length; i += this.dataInterval) {
      const position = startPosition + i;

      // WB区間のチェック
      const wbMarker = this.getWBMarker(position, workSection.wbSections);

      // データ取得
      const movement = data.movements[i] || {};
      const corrected = data.correctedMovements?.[i] || movement;
      const planLine = data.planLine?.[i] || {};
      const prediction = data.predictions?.[i] || {};
      const trackData = data.trackIrregularities?.[i] || {};
      const markers = data.markers?.[i] || {};

      // CSV行生成
      const line = this.formatDataLine({
        lineName: workSection.lineName,
        lineDirection: workSection.lineDirection,
        wbMarker,
        position,
        movement,
        corrected,
        planLine,
        prediction,
        trackData,
        markers
      });

      lines.push(line);
    }

    return lines;
  }

  /**
   * データ行をフォーマット
   */
  formatDataLine(params) {
    const values = [
      // 基本情報
      params.lineName || '',
      this.formatLineDirection(params.lineDirection),
      params.wbMarker,
      params.position,

      // 左右方向移動量
      this.formatNumber(params.movement.lateral, 1),
      this.formatNumber(params.corrected.lateral, 1),
      this.formatNumber(params.planLine.lateral, 1),
      this.formatNumber(params.prediction.lateral10m, 1),

      // 上下方向移動量
      this.formatNumber(params.movement.vertical, 1),
      this.formatNumber(params.corrected.vertical, 1),
      this.formatNumber(params.planLine.vertical, 1),
      this.formatNumber(params.prediction.vertical10m, 1),

      // 軌道狂い
      this.formatNumber(params.trackData.gauge, 1),
      this.formatNumber(params.trackData.level, 1),

      // マーカー
      params.markers.joint ? '1' : '',
      params.markers.ats ? '1' : '',
      params.markers.fieldMeasurement ? '1' : ''
    ];

    return values.join(',');
  }

  /**
   * 線別をフォーマット
   */
  formatLineDirection(direction) {
    const directionMap = {
      'up': '上',
      'down': '下',
      'single': '単'
    };
    return directionMap[direction] || direction || '';
  }

  /**
   * WB区間マーカーを取得
   */
  getWBMarker(position, wbSections) {
    if (!wbSections || !this.includeWBSections) {
      return '';
    }

    for (const section of wbSections) {
      if (position >= section.start && position <= section.end) {
        if (position === section.start) return 'W開始';
        if (position === section.end) return 'W終了';
        return 'W';
      }
    }

    return '';
  }

  /**
   * 数値フォーマット
   */
  formatNumber(value, decimalPlaces = 1) {
    if (value === undefined || value === null) {
      return '';
    }

    // mm単位に変換（mから）
    const mmValue = value * 1000;
    return mmValue.toFixed(decimalPlaces);
  }

  /**
   * ファイル名生成
   */
  generateFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}ID.TXT`;
  }

  /**
   * 作業区間情報ファイルを生成
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 生成されたファイルパス
   */
  async exportWorkSectionInfo(workSection) {
    const fileName = this.generateInfoFileName(workSection);
    const filePath = path.join(this.outputDir, fileName);

    const infoData = this.generateWorkSectionInfo(workSection);
    await fs.writeFile(filePath, infoData, 'utf8');

    return filePath;
  }

  /**
   * 作業区間情報を生成
   */
  generateWorkSectionInfo(workSection) {
    const lines = [];

    lines.push('作業区間情報');
    lines.push('=' .repeat(60));
    lines.push(`線名: ${workSection.lineName}`);
    lines.push(`線別: ${this.formatLineDirection(workSection.lineDirection)}`);
    lines.push(`作業方向: ${workSection.workDirection === 'forward' ? '下り' : '上り'}`);
    lines.push(`作業区間: ${workSection.startPosition}m ～ ${workSection.endPosition}m`);
    lines.push(`MTT機種: ${workSection.mttType}`);
    lines.push(`データ間隔: ${this.dataInterval}m`);

    if (workSection.curveInfo && workSection.curveInfo.length > 0) {
      lines.push('');
      lines.push('曲線諸元');
      lines.push('-'.repeat(50));
      workSection.curveInfo.forEach(curve => {
        lines.push(`${curve.start}m - ${curve.end}m: R${curve.radius} ${curve.direction}`);
      });
    }

    if (workSection.movementRestrictions && workSection.movementRestrictions.length > 0) {
      lines.push('');
      lines.push('移動量制限箇所');
      lines.push('-'.repeat(50));
      workSection.movementRestrictions.forEach(restriction => {
        lines.push(`${restriction.start}m - ${restriction.end}m: ${restriction.type} ${restriction.limit}mm`);
      });
    }

    return lines.join('\r\n');
  }

  /**
   * 情報ファイル名生成
   */
  generateInfoFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}IS.TXT`;
  }

  /**
   * 軌道狂い元データを出力
   * @param {Object} trackData - 軌道狂い元データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 生成されたファイルパス
   */
  async exportOriginalTrackData(trackData, workSection) {
    const fileName = this.generateTrackDataFileName(workSection);
    const filePath = path.join(this.outputDir, fileName);

    const csvData = this.generateTrackDataCSV(trackData, workSection);
    await fs.writeFile(filePath, csvData, 'utf8');

    return filePath;
  }

  /**
   * 軌道狂いデータCSVを生成
   */
  generateTrackDataCSV(trackData, workSection) {
    const lines = [];

    // ヘッダー情報
    lines.push(`線名,${workSection.lineName}`);
    lines.push(`線別,${this.formatLineDirection(workSection.lineDirection)}`);
    lines.push(`測定年月日,${trackData.measurementDate || new Date().toISOString()}`);
    lines.push(`作業方向,${workSection.workDirection === 'forward' ? '下り' : '上り'}`);

    // データヘッダー
    lines.push('');
    lines.push('キロ程,10m弦高低左,10m弦高低右,10m弦通り左,10m弦通り右,水準,軌間,ATS検知');

    // データ行
    const startPosition = workSection.startPosition - 200; // 作業区間前200mから
    const endPosition = workSection.endPosition;

    for (let i = 0; i <= endPosition - startPosition; i += 0.5) {
      const position = startPosition + i;
      const data = trackData[Math.floor(i * 2)] || {};

      const row = [
        position.toFixed(1),
        this.formatNumber(data.elevationLeft, 1),
        this.formatNumber(data.elevationRight, 1),
        this.formatNumber(data.alignmentLeft, 1),
        this.formatNumber(data.alignmentRight, 1),
        this.formatNumber(data.level, 1),
        this.formatNumber(data.gauge, 1),
        data.ats ? '1' : ''
      ];

      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  }

  /**
   * 軌道狂いデータファイル名生成
   */
  generateTrackDataFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}KC.TXT`;
  }

  /**
   * ディレクトリの存在確認と作成
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * バッチ出力
   * 全形式のデータを一括出力
   */
  async exportAllFormats(data, workSection) {
    const results = {};

    // 汎用移動量データ
    results.generalData = await this.exportGeneralData(data, workSection);

    // 作業区間情報
    results.workSectionInfo = await this.exportWorkSectionInfo(workSection);

    // 軌道狂い元データ
    if (data.trackIrregularities) {
      results.originalTrackData = await this.exportOriginalTrackData(
        data.trackIrregularities,
        workSection
      );
    }

    console.log('全形式のデータ出力が完了しました:', results);
    return results;
  }
}

module.exports = GeneralDataExporter;
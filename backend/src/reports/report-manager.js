/**
 * レポート管理モジュール
 * 各種レポート生成機能を統合管理
 *
 * 機能:
 * - 複数フォーマットでのレポート生成（CSV, HTML, PDF）
 * - レポートテンプレート管理
 * - バッチレポート生成
 * - ファイル名生成
 */

const { CSVReportGenerator } = require('./csv-report-generator');
const { HTMLReportGenerator } = require('./html-report-generator');
const fs = require('fs').promises;
const path = require('path');

class ReportManager {
  constructor(outputDirectory = './reports') {
    this.outputDirectory = outputDirectory;
    this.csvGenerator = new CSVReportGenerator();
    this.htmlGenerator = new HTMLReportGenerator();

    // サポートされているフォーマット
    this.supportedFormats = ['csv', 'html'];

    // レポートテンプレート
    this.templates = {
      restoration: 'restoration',
      versine: 'versine',
      movement: 'movement',
      statistics: 'statistics',
      environment: 'environment',
      comprehensive: 'comprehensive',
      comparison: 'comparison'
    };
  }

  /**
   * 出力ディレクトリを初期化
   */
  async initializeOutputDirectory() {
    try {
      await fs.mkdir(this.outputDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }

  /**
   * ファイル名を生成
   * @param {string} template - テンプレート名
   * @param {string} format - フォーマット（csv, html, pdf）
   * @param {Object} metadata - メタデータ
   * @returns {string} ファイル名
   */
  generateFileName(template, format, metadata = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    const parts = [];

    // 路線コード
    if (metadata.lineCode) {
      parts.push(metadata.lineCode);
    }

    // 上下区分
    if (metadata.direction) {
      parts.push(metadata.direction);
    }

    // 測定日
    if (metadata.measurementDate) {
      const dateStr = metadata.measurementDate.replace(/[/:]/g, '');
      parts.push(dateStr);
    }

    // データ項目
    if (metadata.dataType) {
      parts.push(metadata.dataType);
    }

    // テンプレート名
    parts.push(template);

    // タイムスタンプ
    parts.push(timestamp);

    const baseName = parts.join('_');
    return `${baseName}.${format}`;
  }

  /**
   * レポートを生成
   * @param {string} template - テンプレート名
   * @param {string} format - フォーマット
   * @param {Object} data - データ
   * @param {Object} metadata - メタデータ
   * @returns {Buffer} レポートバッファ
   */
  generateReport(template, format, data, metadata = {}) {
    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }

    let content;

    switch (format) {
      case 'csv':
        content = this.generateCSVReport(template, data, metadata);
        return this.csvGenerator.toBuffer(content);

      case 'html':
        content = this.generateHTMLReport(template, data, metadata);
        return this.htmlGenerator.toBuffer(content);

      default:
        throw new Error(`Format ${format} not implemented`);
    }
  }

  /**
   * CSVレポートを生成
   * @param {string} template - テンプレート名
   * @param {Object} data - データ
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateCSVReport(template, data, metadata) {
    switch (template) {
      case this.templates.restoration:
        return this.csvGenerator.generateRestorationReport(data, metadata);

      case this.templates.versine:
        return this.csvGenerator.generateVersineReport(data, metadata);

      case this.templates.movement:
        return this.csvGenerator.generateMovementReport(data, metadata);

      case this.templates.statistics:
        return this.csvGenerator.generateStatisticsReport(data, metadata);

      case this.templates.environment:
        return this.csvGenerator.generateEnvironmentReport(data, metadata);

      case this.templates.comprehensive:
        return this.csvGenerator.generateComprehensiveReport(
          data.result,
          data.environmentData,
          metadata
        );

      case this.templates.comparison:
        return this.csvGenerator.generateComparisonReport(data, metadata);

      default:
        throw new Error(`Unknown template: ${template}`);
    }
  }

  /**
   * HTMLレポートを生成
   * @param {string} template - テンプレート名
   * @param {Object} data - データ
   * @param {Object} metadata - メタデータ
   * @returns {string} HTML文字列
   */
  generateHTMLReport(template, data, metadata) {
    switch (template) {
      case this.templates.restoration:
        return this.htmlGenerator.generateRestorationReport(data, metadata);

      case this.templates.versine:
        return this.htmlGenerator.generateVersineReport(data, metadata);

      case this.templates.environment:
        return this.htmlGenerator.generateEnvironmentReport(data, metadata);

      case this.templates.comprehensive:
        return this.htmlGenerator.generateComprehensiveReport(
          data.result,
          data.environmentData,
          metadata
        );

      default:
        throw new Error(`Unknown template: ${template}`);
    }
  }

  /**
   * レポートをファイルに保存
   * @param {string} template - テンプレート名
   * @param {string} format - フォーマット
   * @param {Object} data - データ
   * @param {Object} metadata - メタデータ
   * @returns {Promise<string>} 保存先ファイルパス
   */
  async saveReport(template, format, data, metadata = {}) {
    await this.initializeOutputDirectory();

    const fileName = this.generateFileName(template, format, metadata);
    const filePath = path.join(this.outputDirectory, fileName);

    const buffer = this.generateReport(template, format, data, metadata);

    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * 複数フォーマットでレポートを一括生成
   * @param {string} template - テンプレート名
   * @param {string[]} formats - フォーマット配列
   * @param {Object} data - データ
   * @param {Object} metadata - メタデータ
   * @returns {Promise<Array<{format: string, path: string}>>} 保存先パス配列
   */
  async saveMultipleFormats(template, formats, data, metadata = {}) {
    const results = [];

    for (const format of formats) {
      const filePath = await this.saveReport(template, format, data, metadata);
      results.push({ format, path: filePath });
    }

    return results;
  }

  /**
   * バッチレポート生成
   * @param {Array<{template: string, format: string, data: Object, metadata: Object}>} reports - レポート定義配列
   * @returns {Promise<Array<{template: string, format: string, path: string}>>} 保存先パス配列
   */
  async batchGenerateReports(reports) {
    const results = [];

    for (const report of reports) {
      const filePath = await this.saveReport(
        report.template,
        report.format,
        report.data,
        report.metadata
      );

      results.push({
        template: report.template,
        format: report.format,
        path: filePath
      });
    }

    return results;
  }

  /**
   * 復元波形の標準レポートセットを生成
   * @param {RestorationWaveformResult} result - 復元波形計算結果
   * @param {Object} metadata - メタデータ
   * @param {string[]} formats - フォーマット配列（デフォルト: ['csv', 'html']）
   * @returns {Promise<Array>} 保存先パス配列
   */
  async generateStandardReportSet(result, metadata = {}, formats = ['csv', 'html']) {
    const reports = [];

    // 復元波形レポート
    reports.push({
      template: this.templates.restoration,
      format: formats[0],
      data: result,
      metadata
    });

    // 矢中弦レポート（データがある場合）
    if (result.versineData) {
      reports.push({
        template: this.templates.versine,
        format: formats[0],
        data: result.versineData,
        metadata
      });
    }

    // 統計情報レポート
    if (result.statistics) {
      reports.push({
        template: this.templates.statistics,
        format: formats[0],
        data: result.statistics,
        metadata
      });
    }

    // 総合レポート（HTMLのみ）
    if (formats.includes('html')) {
      reports.push({
        template: this.templates.comprehensive,
        format: 'html',
        data: { result },
        metadata
      });
    }

    return await this.batchGenerateReports(reports);
  }

  /**
   * 出力ディレクトリを設定
   * @param {string} directory - ディレクトリパス
   */
  setOutputDirectory(directory) {
    this.outputDirectory = directory;
  }

  /**
   * 出力ディレクトリを取得
   * @returns {string} ディレクトリパス
   */
  getOutputDirectory() {
    return this.outputDirectory;
  }

  /**
   * サポートされているフォーマット一覧を取得
   * @returns {string[]} フォーマット配列
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * テンプレート一覧を取得
   * @returns {Object} テンプレート
   */
  getTemplates() {
    return { ...this.templates };
  }

  /**
   * 出力ディレクトリ内のレポートファイル一覧を取得
   * @returns {Promise<Array<string>>} ファイル名配列
   */
  async listReports() {
    try {
      const files = await fs.readdir(this.outputDirectory);
      return files.filter(file => {
        const ext = path.extname(file).slice(1);
        return this.supportedFormats.includes(ext);
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * レポートファイルを削除
   * @param {string} fileName - ファイル名
   * @returns {Promise<boolean>} 削除成功/失敗
   */
  async deleteReport(fileName) {
    try {
      const filePath = path.join(this.outputDirectory, fileName);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete report:', error);
      return false;
    }
  }

  /**
   * 古いレポートファイルを削除
   * @param {number} daysToKeep - 保持日数
   * @returns {Promise<number>} 削除ファイル数
   */
  async cleanupOldReports(daysToKeep = 30) {
    try {
      const files = await this.listReports();
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.outputDirectory, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old reports:', error);
      return 0;
    }
  }
}

module.exports = { ReportManager };

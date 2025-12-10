/**
 * バッチ処理システム
 * 複数のファイルを一括処理
 *
 * 機能:
 * - 複数ファイルの一括パース
 * - 復元波形の一括計算
 * - レポートの一括生成
 * - 進捗管理
 * - エラーハンドリング
 */

const fs = require('fs').promises;
const path = require('path');
const { RSQParser } = require('../parsers/rsq-parser');
const { HDRDATParser } = require('../parsers/hdr-dat-parser');
const { DCPParser } = require('../parsers/dcp-parser');
const { RestorationEngine } = require('../algorithms/restoration-engine');
const { ReportManager } = require('../reports/report-manager');

class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent || 5,  // 最大同時処理数
      continueOnError: options.continueOnError !== false,  // エラー時も継続
      generateReports: options.generateReports !== false,  // レポート自動生成
      reportFormats: options.reportFormats || ['csv', 'html'],  // レポート形式
      ...options
    };

    // パーサー初期化
    this.rsqParser = new RSQParser();
    this.hdrDatParser = new HDRDATParser();
    this.dcpParser = new DCPParser();

    // 復元エンジン初期化
    this.restorationEngine = new RestorationEngine(options.restorationOptions);

    // レポートマネージャー初期化
    this.reportManager = new ReportManager(options.outputDirectory);

    // 処理状態
    this.processingState = {
      total: 0,
      completed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * ディレクトリ内の全ファイルを処理
   * @param {string} inputDirectory - 入力ディレクトリ
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 処理結果
   */
  async processDirectory(inputDirectory, options = {}) {
    // ファイル一覧を取得
    const files = await this.scanDirectory(inputDirectory, options.filePattern);

    return await this.processFiles(files, options);
  }

  /**
   * ディレクトリをスキャン
   * @param {string} directory - ディレクトリパス
   * @param {RegExp} pattern - ファイルパターン
   * @returns {Promise<Array<string>>} ファイルパス配列
   */
  async scanDirectory(directory, pattern = null) {
    const files = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isFile()) {
          if (!pattern || pattern.test(entry.name)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          // 再帰的にサブディレクトリもスキャン
          const subFiles = await this.scanDirectory(fullPath, pattern);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${directory}:`, error);
    }

    return files;
  }

  /**
   * 複数ファイルを処理
   * @param {string[]} filePaths - ファイルパス配列
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 処理結果
   */
  async processFiles(filePaths, options = {}) {
    this.resetState();
    this.processingState.total = filePaths.length;

    const results = [];
    const batchSize = this.options.maxConcurrent;

    // バッチごとに処理
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(filePath => this.processFile(filePath, options))
      );

      results.push(...batchResults);

      // 進捗コールバック
      if (options.onProgress) {
        options.onProgress({
          total: this.processingState.total,
          completed: this.processingState.completed,
          failed: this.processingState.failed,
          percentage: (this.processingState.completed / this.processingState.total) * 100
        });
      }
    }

    return {
      total: this.processingState.total,
      completed: this.processingState.completed,
      failed: this.processingState.failed,
      errors: this.processingState.errors,
      results: results.filter(r => r.success)
    };
  }

  /**
   * 単一ファイルを処理
   * @param {string} filePath - ファイルパス
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 処理結果
   */
  async processFile(filePath, options = {}) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      // ファイルを読み込み
      const buffer = await fs.readFile(filePath);

      // ファイル形式を判定してパース
      let parsedData;
      let metadata = {
        fileName,
        filePath
      };

      if (ext === '.rsq') {
        parsedData = this.rsqParser.parse(buffer);
        metadata = {
          ...metadata,
          lineCode: parsedData.header.lineCode,
          direction: parsedData.header.direction,
          measurementDate: parsedData.header.measurementDate,
          dataType: parsedData.header.dataType
        };
      } else if (ext === '.hdr' || ext === '.dat') {
        // HDR/DATペアを検索
        const pairPath = this.findHDRDATPair(filePath);
        if (!pairPath) {
          throw new Error('HDR/DAT pair not found');
        }

        const hdrBuffer = ext === '.hdr' ? buffer : await fs.readFile(pairPath);
        const datBuffer = ext === '.dat' ? buffer : await fs.readFile(pairPath);

        parsedData = this.hdrDatParser.parse(hdrBuffer, datBuffer);
        metadata = {
          ...metadata,
          lineCode: parsedData.header.lineCode,
          direction: parsedData.header.direction,
          measurementDate: parsedData.header.measurementDate,
          dataType: parsedData.header.dataType
        };
      } else if (ext === '.dcp') {
        parsedData = this.dcpParser.parse(buffer);
        metadata = {
          ...metadata,
          lineCode: parsedData.header.lineCode,
          direction: parsedData.header.direction,
          measurementDate: parsedData.header.measurementDate
        };
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      // 測定データに変換
      let measurementData;
      if (ext === '.rsq') {
        measurementData = this.rsqParser.toMeasurementData(parsedData);
      } else if (ext === '.hdr' || ext === '.dat') {
        measurementData = this.hdrDatParser.toMeasurementData(parsedData);
      } else if (ext === '.dcp') {
        // DCP の場合は特定の項目を選択（例: 高低右10m弦）
        measurementData = this.dcpParser.extractItem(parsedData, 'level10mRight');
      }

      // 復元波形を計算
      const restorationResult = this.restorationEngine.calculate(measurementData);

      // レポート生成
      let reportPaths = [];
      if (this.options.generateReports && restorationResult.success) {
        reportPaths = await this.reportManager.generateStandardReportSet(
          restorationResult,
          metadata,
          this.options.reportFormats
        );
      }

      this.processingState.completed++;

      return {
        success: true,
        filePath,
        fileName,
        metadata,
        restorationResult,
        reportPaths
      };
    } catch (error) {
      this.processingState.failed++;
      this.processingState.errors.push({
        filePath,
        fileName,
        error: error.message
      });

      if (!this.options.continueOnError) {
        throw error;
      }

      return {
        success: false,
        filePath,
        fileName,
        error: error.message
      };
    }
  }

  /**
   * HDR/DATペアファイルを検索
   * @param {string} filePath - ファイルパス
   * @returns {string|null} ペアファイルパス
   */
  findHDRDATPair(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basePath = filePath.slice(0, -ext.length);

    const pairExt = ext === '.hdr' ? '.dat' : '.hdr';
    const pairPath = basePath + pairExt.toUpperCase();

    try {
      if (require('fs').existsSync(pairPath)) {
        return pairPath;
      }

      // 小文字も試す
      const lowerPairPath = basePath + pairExt.toLowerCase();
      if (require('fs').existsSync(lowerPairPath)) {
        return lowerPairPath;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  /**
   * DCP→RSQバッチ変換
   * @param {string} dcpDirectory - DCPファイルディレクトリ
   * @param {string} outputDirectory - 出力ディレクトリ
   * @returns {Promise<Object>} 変換結果
   */
  async batchConvertDCPToRSQ(dcpDirectory, outputDirectory) {
    const dcpFiles = await this.scanDirectory(dcpDirectory, /\.dcp$/i);

    const { DCPToRSQConverter } = require('../converters/dcp-to-rsq-converter');
    const converter = new DCPToRSQConverter();

    this.resetState();
    this.processingState.total = dcpFiles.length;

    const results = [];

    for (const dcpFile of dcpFiles) {
      try {
        const buffer = await fs.readFile(dcpFile);
        const dcpData = this.dcpParser.parse(buffer);

        // RSQファイルに変換
        const rsqFiles = converter.convertToRSQFiles(dcpData);

        // 出力
        for (const rsqFile of rsqFiles) {
          const outputPath = path.join(outputDirectory, rsqFile.fileName);
          await fs.writeFile(outputPath, rsqFile.buffer);
        }

        this.processingState.completed++;

        results.push({
          success: true,
          dcpFile,
          rsqFiles: rsqFiles.map(f => f.fileName)
        });
      } catch (error) {
        this.processingState.failed++;
        this.processingState.errors.push({
          filePath: dcpFile,
          error: error.message
        });

        results.push({
          success: false,
          dcpFile,
          error: error.message
        });
      }
    }

    return {
      total: this.processingState.total,
      completed: this.processingState.completed,
      failed: this.processingState.failed,
      errors: this.processingState.errors,
      results
    };
  }

  /**
   * 処理状態をリセット
   */
  resetState() {
    this.processingState = {
      total: 0,
      completed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * 処理状態を取得
   * @returns {Object} 処理状態
   */
  getState() {
    return { ...this.processingState };
  }

  /**
   * オプションを設定
   * @param {Object} options - オプション
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * オプションを取得
   * @returns {Object} オプション
   */
  getOptions() {
    return { ...this.options };
  }
}

module.exports = { BatchProcessor };

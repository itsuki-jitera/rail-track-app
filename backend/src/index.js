/**
 * 軌道復元システム - メインモジュール
 * Rail Track Restoration System
 *
 * すべての機能を統合的に提供するメインエントリーポイント
 */

// ========== フェーズ1: ファイル形式パーサー ==========
const { RSQParser } = require('./parsers/rsq-parser');
const { HDRDATParser } = require('./parsers/hdr-dat-parser');
const { PNTParser } = require('./parsers/pnt-parser');
const { TBLDDBParser } = require('./parsers/tbl-ddb-parser');
const { DCPParser } = require('./parsers/dcp-parser');

// ========== フェーズ2: データ変換システム ==========
const { DCPToRSQConverter } = require('./converters/dcp-to-rsq-converter');
const { OracleToLabocsConverter } = require('./converters/oracle-to-labocs-converter');

// ========== フェーズ3: 復元波形計算エンジン ==========
const { InverseFilter } = require('./algorithms/inverse-filter');
const { VersineConverter } = require('./algorithms/versine-converter');
const { RestorationEngine } = require('./algorithms/restoration-engine');

// ========== フェーズ4: 計画線編集システム ==========
const { PlanLineEditor } = require('./algorithms/plan-line-editor');
const { CrossingMethod } = require('./algorithms/crossing-method');
const { PlanLineRefinement } = require('./algorithms/plan-line-refinement');

// ========== フェーズ5: レポート生成 ==========
const { CSVReportGenerator } = require('./reports/csv-report-generator');
const { HTMLReportGenerator } = require('./reports/html-report-generator');
const { ReportManager } = require('./reports/report-manager');

// ========== フェーズ6: 高度な機能 ==========
const { BatchProcessor } = require('./batch/batch-processor');
const { FileHistoryManager } = require('./utils/file-history-manager');
const { DataCacheManager } = require('./utils/data-cache-manager');

// ========== ユーティリティ ==========
const { EncodingDetector } = require('./utils/encoding-detector');

/**
 * 軌道復元システム - 統合クラス
 */
class RailTrackRestorationSystem {
  constructor(options = {}) {
    // パーサー
    this.parsers = {
      rsq: new RSQParser(),
      hdrDat: new HDRDATParser(),
      pnt: new PNTParser(),
      tblDdb: new TBLDDBParser(),
      dcp: new DCPParser()
    };

    // コンバーター
    this.converters = {
      dcpToRsq: new DCPToRSQConverter(),
      oracleToLabocs: new OracleToLabocsConverter()
    };

    // アルゴリズム
    this.algorithms = {
      inverseFilter: new InverseFilter(options.filterOptions),
      versineConverter: new VersineConverter(options.samplingInterval),
      restorationEngine: new RestorationEngine(options.restorationOptions),
      planLineEditor: new PlanLineEditor(options.samplingInterval),
      crossingMethod: new CrossingMethod(options.samplingInterval),
      planLineRefinement: new PlanLineRefinement(options.samplingInterval)
    };

    // レポート
    this.reports = {
      csv: new CSVReportGenerator(),
      html: new HTMLReportGenerator(),
      manager: new ReportManager(options.outputDirectory)
    };

    // 高度な機能
    this.batch = new BatchProcessor(options.batchOptions);
    this.history = new FileHistoryManager(options.historyFilePath);
    this.cache = new DataCacheManager(options.cacheOptions);
  }

  /**
   * システム情報を取得
   * @returns {Object} システム情報
   */
  getSystemInfo() {
    return {
      name: 'Rail Track Restoration System',
      version: '1.0.0',
      description: '軌道復元システム - 鉄道軌道の検測データを解析し、復元波形を計算',
      modules: {
        parsers: Object.keys(this.parsers),
        converters: Object.keys(this.converters),
        algorithms: Object.keys(this.algorithms),
        reports: Object.keys(this.reports)
      },
      features: [
        'RSQ/HDR/DAT/PNT/TBL/DDB/DCPファイルパース',
        'DCP→RSQ変換、Oracle→LABOCS変換',
        '復元波形計算（6m-40m帯域通過フィルタ）',
        '矢中弦変換（10m/20m/40m弦）',
        '計画線編集（直線/曲線設定、交叉法、微調整）',
        'レポート生成（CSV/HTML）',
        'バッチ処理、履歴管理、データキャッシュ'
      ]
    };
  }

  /**
   * クイックスタート: RSQファイルから復元波形を計算
   * @param {string|Buffer} rsqFileOrBuffer - RSQファイルパスまたはバッファ
   * @returns {Promise<Object>} 復元結果
   */
  async quickStartRSQ(rsqFileOrBuffer) {
    const fs = require('fs').promises;

    // ファイルパスの場合は読み込み
    let buffer;
    if (typeof rsqFileOrBuffer === 'string') {
      buffer = await fs.readFile(rsqFileOrBuffer);
    } else {
      buffer = rsqFileOrBuffer;
    }

    // パース
    const rsqData = this.parsers.rsq.parse(buffer);

    // 測定データに変換
    const measurementData = this.parsers.rsq.toMeasurementData(rsqData);

    // 復元波形を計算
    const result = this.algorithms.restorationEngine.calculate(measurementData);

    return {
      header: rsqData.header,
      result
    };
  }

  /**
   * クイックスタート: HDR/DATファイルから復元波形を計算
   * @param {string|Buffer} hdrFileOrBuffer - HDRファイルパスまたはバッファ
   * @param {string|Buffer} datFileOrBuffer - DATファイルパスまたはバッファ
   * @returns {Promise<Object>} 復元結果
   */
  async quickStartHDRDAT(hdrFileOrBuffer, datFileOrBuffer) {
    const fs = require('fs').promises;

    // ファイルパスの場合は読み込み
    let hdrBuffer, datBuffer;

    if (typeof hdrFileOrBuffer === 'string') {
      hdrBuffer = await fs.readFile(hdrFileOrBuffer);
    } else {
      hdrBuffer = hdrFileOrBuffer;
    }

    if (typeof datFileOrBuffer === 'string') {
      datBuffer = await fs.readFile(datFileOrBuffer);
    } else {
      datBuffer = datFileOrBuffer;
    }

    // パース
    const hdrDatData = this.parsers.hdrDat.parse(hdrBuffer, datBuffer);

    // 測定データに変換
    const measurementData = this.parsers.hdrDat.toMeasurementData(hdrDatData);

    // 復元波形を計算
    const result = this.algorithms.restorationEngine.calculate(measurementData);

    return {
      header: hdrDatData.header,
      result
    };
  }

  /**
   * バッチ処理の実行
   * @param {string} inputDirectory - 入力ディレクトリ
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 処理結果
   */
  async runBatchProcessing(inputDirectory, options = {}) {
    return await this.batch.processDirectory(inputDirectory, options);
  }

  /**
   * レポート生成
   * @param {Object} restorationResult - 復元結果
   * @param {Object} metadata - メタデータ
   * @param {string[]} formats - フォーマット配列
   * @returns {Promise<Array>} レポートファイルパス配列
   */
  async generateReports(restorationResult, metadata, formats = ['csv', 'html']) {
    return await this.reports.manager.generateStandardReportSet(
      restorationResult,
      metadata,
      formats
    );
  }
}

// エクスポート
module.exports = {
  // メインシステム
  RailTrackRestorationSystem,

  // パーサー
  RSQParser,
  HDRDATParser,
  PNTParser,
  TBLDDBParser,
  DCPParser,

  // コンバーター
  DCPToRSQConverter,
  OracleToLabocsConverter,

  // アルゴリズム
  InverseFilter,
  VersineConverter,
  RestorationEngine,
  PlanLineEditor,
  CrossingMethod,
  PlanLineRefinement,

  // レポート
  CSVReportGenerator,
  HTMLReportGenerator,
  ReportManager,

  // 高度な機能
  BatchProcessor,
  FileHistoryManager,
  DataCacheManager,

  // ユーティリティ
  EncodingDetector
};

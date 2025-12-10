/**
 * メインサーバーファイル
 * 全APIルートの統合と起動設定
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;

// ルートのインポート
const analysisRoutes = require('./src/routes/analysis-routes');
const mttRoutes = require('./src/routes/mtt-routes');
const kiyaDataRoutes = require('./src/routes/kiya-data-routes');

// 環境変数の設定
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || 'localhost';

// Expressアプリケーションの初期化
const app = express();

// ミドルウェア設定
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 静的ファイルの提供
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/output', express.static(path.join(__dirname, 'output')));

// ルートの設定
app.use('/api/analysis', analysisRoutes);
app.use('/api/mtt', mttRoutes);
app.use('/api/kiya-data', kiyaDataRoutes);

// MTT機種一覧エンドポイント
app.get('/api/mtt-types', async (req, res) => {
  try {
    const MTTConfiguration = require('./src/config/mtt-config');
    const types = MTTConfiguration.getAllTypes();

    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error('MTT機種取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// MTT機種詳細エンドポイント
app.get('/api/mtt-types/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const MTTConfiguration = require('./src/config/mtt-config');
    const config = MTTConfiguration.getConfig(type);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'MTT機種が見つかりません'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('MTT機種詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 統合処理エンドポイント
app.post('/api/process', async (req, res) => {
  try {
    const {
      action,
      data,
      workSection,
      options
    } = req.body;

    let result = {};

    switch (action) {
      case 'calculateMovements':
        const MovementCalculator = require('./src/calculators/movement-calculator');
        const calculator = new MovementCalculator(options);
        result = calculator.calculate(data, workSection);
        break;

      case 'correctMovements':
        const MovementCorrection = require('./src/calculators/movement-correction');
        const corrector = new MovementCorrection(options);
        result = corrector.applyAllCorrections(data.movements, data.planLine, workSection);
        break;

      case 'analyzeAndExport':
        // 統合処理: 分析 + エクスポート
        result = await processAnalyzeAndExport(data, workSection, options);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: '無効なアクションです'
        });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('処理エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// データインポートエンドポイント
app.post('/api/import', async (req, res) => {
  try {
    const { type, filePath, options } = req.body;

    let data = null;

    switch (type) {
      case 'kiya':
        // キヤデータのインポート
        data = await importKiyaData(filePath);
        break;

      case 'mdt':
        // MDTデータのインポート
        data = await importMDTData(filePath);
        break;

      case 'restoration':
        // 復元波形データのインポート
        data = await importRestorationData(filePath);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: '無効なデータタイプです'
        });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('インポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// エクスポート一覧取得エンドポイント
app.get('/api/exports', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, 'output');
    const files = await fs.readdir(outputDir);

    const exports = await Promise.all(files.map(async (file) => {
      const filePath = path.join(outputDir, file);
      const stats = await fs.stat(filePath);

      return {
        filename: file,
        path: `/output/${file}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        type: path.extname(file).substring(1).toUpperCase()
      };
    }));

    res.json({
      success: true,
      data: exports.sort((a, b) => b.created - a.created)
    });
  } catch (error) {
    console.error('エクスポート一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// エクスポートファイル削除エンドポイント
app.delete('/api/exports/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'output', filename);

    await fs.unlink(filePath);

    res.json({
      success: true,
      message: 'ファイルを削除しました'
    });
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'エンドポイントが見つかりません'
  });
});

// 統合処理関数
async function processAnalyzeAndExport(data, workSection, options) {
  const results = {
    analysis: {},
    exports: {}
  };

  // 波長帯域分析
  const WavebandAnalyzer = require('./src/analyzers/waveband-analyzer');
  const wavebandAnalyzer = new WavebandAnalyzer(options);
  results.analysis.waveband = wavebandAnalyzer.analyzeWavebands(data.trackData);

  // 品質分析
  const QualityAnalyzer = require('./src/analyzers/quality-analyzer');
  const qualityAnalyzer = new QualityAnalyzer(options);
  results.analysis.quality = qualityAnalyzer.analyzeQuality(
    data.before,
    data.after
  );

  // ALS形式エクスポート
  const ALSExporter = require('./src/exporters/als-exporter');
  const alsExporter = new ALSExporter(options);
  results.exports.als = await alsExporter.exportALSData(data.movements, workSection);

  // MJ形式エクスポート
  const MJDataExporter = require('./src/exporters/mj-exporter');
  const mjExporter = new MJDataExporter(options);
  results.exports.mj = await mjExporter.exportMJData(data, workSection);

  // 汎用形式エクスポート
  const GeneralDataExporter = require('./src/exporters/general-exporter');
  const generalExporter = new GeneralDataExporter(options);
  results.exports.general = await generalExporter.exportAllFormats(data, workSection);

  // レポート生成
  const ComprehensiveReportGenerator = require('./src/reports/comprehensive-report');
  const reportGenerator = new ComprehensiveReportGenerator(options);
  results.report = await reportGenerator.generateReport(
    {
      ...results.analysis,
      movements: data.movements,
      trackData: data.trackData,
      verticalCurves: data.verticalCurves,
      fieldMeasurements: data.fieldMeasurements
    },
    workSection
  );

  return results;
}

// データインポート関数（簡略化）
async function importKiyaData(filePath) {
  // キヤデータのインポート実装
  const content = await fs.readFile(filePath, 'utf8');
  // 実際の解析処理を実装
  return { type: 'kiya', data: [] };
}

async function importMDTData(filePath) {
  // MDTデータのインポート実装
  const content = await fs.readFile(filePath, 'utf8');
  // 実際の解析処理を実装
  return { type: 'mdt', metadata: {} };
}

async function importRestorationData(filePath) {
  // 復元波形データのインポート実装
  const content = await fs.readFile(filePath, 'utf8');
  // 実際の解析処理を実装
  return { type: 'restoration', waveform: [] };
}

// 必要なディレクトリの作成
async function ensureDirectories() {
  const dirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'output'),
    path.join(__dirname, 'output', 'IDOU'),
    path.join(__dirname, 'output', 'reports')
  ];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`ディレクトリを作成しました: ${dir}`);
    }
  }
}

// サーバー起動
async function startServer() {
  try {
    // 必要なディレクトリを作成
    await ensureDirectories();

    // サーバーを起動
    app.listen(PORT, HOST, () => {
      console.log('========================================');
      console.log('レールトラック軌道整正計算サーバー');
      console.log('========================================');
      console.log(`サーバー起動: http://${HOST}:${PORT}`);
      console.log(`API Health: http://${HOST}:${PORT}/api/health`);
      console.log('========================================');
      console.log('利用可能なエンドポイント:');
      console.log('- POST /api/analysis/waveband - 波長帯域分析');
      console.log('- POST /api/analysis/quality - 品質分析');
      console.log('- POST /api/analysis/field-correlation - 手検測相関');
      console.log('- POST /api/export/als - ALS形式エクスポート');
      console.log('- POST /api/export/mj - MJ形式エクスポート');
      console.log('- POST /api/report/comprehensive - 総合レポート生成');
      console.log('========================================');
    });
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}

// グレースフルシャットダウン
process.on('SIGTERM', async () => {
  console.log('シャットダウンシグナルを受信しました');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nサーバーを停止します');
  process.exit(0);
});

// サーバー起動
startServer();
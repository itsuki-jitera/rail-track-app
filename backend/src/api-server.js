/**
 * 軌道復元システム - 新APIサーバー
 * Rail Track Restoration System - New API Server
 *
 * ポート: 5000
 * 既存のserver.js（ポート3002）とは別に起動
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// ルーター
const fileRoutes = require('./routes/file-routes');
const restorationRoutes = require('./routes/restoration-routes');
const reportRoutes = require('./routes/report-routes');
const batchRoutes = require('./routes/batch-routes');
const historyRoutes = require('./routes/history-routes');
const cacheRoutes = require('./routes/cache-routes');
const conversionRoutes = require('./routes/conversion-routes');
const algorithmRoutes = require('./routes/algorithm-routes');
const curveSpecRoutes = require('./routes/curve-spec-routes');
const kiyaDataRoutes = require('./routes/kiya-data-routes');
const trackEnvironmentRoutes = require('./routes/track-environment-routes');
const eccentricVersineRoutes = require('./routes/eccentric-versine-routes');
const legacyDataRoutes = require('./routes/legacy-data-routes');

// アプリケーション初期化
const app = express();
const PORT = process.env.PORT || 5000;

// ミドルウェア設定
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静的ファイル配信
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));
app.use('/cache', express.static(path.join(__dirname, '../cache')));

// ディレクトリ初期化
async function initializeDirectories() {
  const directories = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../reports'),
    path.join(__dirname, '../cache'),
    path.join(__dirname, '../data'),
    path.join(__dirname, '../temp')
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✓ Directory initialized: ${dir}`);
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

// ルーティング
app.use('/api/files', fileRoutes);
app.use('/api/restoration', restorationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/conversion', conversionRoutes);
app.use('/api/algorithms', algorithmRoutes);
app.use('/api/curve-spec', curveSpecRoutes);
app.use('/api/kiya-data', kiyaDataRoutes);
app.use('/api/track-env', trackEnvironmentRoutes);
app.use('/api/eccentric-versine', eccentricVersineRoutes);
app.use('/api/legacy-data', legacyDataRoutes);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Rail Track Restoration System API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// システム情報
app.get('/api/info', (req, res) => {
  const { RailTrackRestorationSystem } = require('./index');
  const system = new RailTrackRestorationSystem();
  res.json(system.getSystemInfo());
});

// APIエンドポイント一覧
app.get('/api/endpoints', (req, res) => {
  res.json({
    success: true,
    endpoints: {
      files: [
        'POST /api/files/upload-rsq - RSQファイルアップロード',
        'POST /api/files/upload-hdrdat - HDR/DATファイルアップロード',
        'POST /api/files/upload-dcp - DCPファイルアップロード',
        'POST /api/files/upload-pnt - PNTファイルアップロード',
        'POST /api/files/upload-tblddb - TBL/DDBファイルアップロード',
        'GET /api/files/list - アップロードファイル一覧'
      ],
      restoration: [
        'POST /api/restoration/calculate - 復元波形計算',
        'POST /api/restoration/generate-plan-line - 計画線生成',
        'POST /api/restoration/set-straight-line - 直線設定',
        'POST /api/restoration/set-circular-curve - 曲線設定',
        'POST /api/restoration/smooth-section - 区間平滑化',
        'POST /api/restoration/connect-plan-lines - 計画線接続',
        'POST /api/restoration/gaussian-smoothing - ガウシアン平滑化',
        'POST /api/restoration/remove-outliers - 異常値除去',
        'POST /api/restoration/calculate-versine - 矢中弦変換',
        'POST /api/restoration/calculate-statistics - 統計情報計算',
        'GET /api/restoration/frequency-response - 周波数応答取得',
        'GET /api/restoration/impulse-response - インパルス応答取得'
      ],
      reports: [
        'POST /api/reports/generate-restoration - 復元波形レポート生成',
        'POST /api/reports/generate-versine - 矢中弦レポート生成',
        'POST /api/reports/generate-statistics - 統計情報レポート生成',
        'POST /api/reports/generate-comprehensive - 総合レポート生成',
        'POST /api/reports/generate-standard-set - 標準レポートセット生成',
        'GET /api/reports/list - レポート一覧',
        'DELETE /api/reports/:filename - レポート削除',
        'POST /api/reports/cleanup - 古いレポートクリーンアップ',
        'GET /api/reports/supported-formats - サポート形式取得',
        'GET /api/reports/templates - テンプレート一覧'
      ],
      batch: [
        'POST /api/batch/start - バッチ処理開始',
        'GET /api/batch/progress - バッチ処理進捗取得',
        'POST /api/batch/convert-dcp-to-rsq - DCP→RSQバッチ変換',
        'GET /api/batch/options - バッチ処理オプション取得',
        'POST /api/batch/options - バッチ処理オプション設定'
      ],
      history: [
        'POST /api/history/add - 履歴追加',
        'GET /api/history/find-by-path - ファイルパスで検索',
        'GET /api/history/find-by-hash - ハッシュ値で検索',
        'GET /api/history/find-by-date-range - 期間で検索',
        'GET /api/history/all - 全履歴取得',
        'GET /api/history/statistics - 統計情報取得',
        'GET /api/history/is-processed - 処理済みチェック',
        'GET /api/history/latest - 最新記録取得',
        'POST /api/history/cleanup - 古い履歴クリーンアップ',
        'POST /api/history/clear - 履歴クリア',
        'GET /api/history/export - 履歴エクスポート'
      ],
      cache: [
        'GET /api/cache/get - キャッシュ取得',
        'POST /api/cache/set - キャッシュ設定',
        'DELETE /api/cache/delete - キャッシュ削除',
        'DELETE /api/cache/delete-by-type - タイプ別削除',
        'POST /api/cache/cleanup-expired - 期限切れクリーンアップ',
        'POST /api/cache/clear - 全キャッシュクリア',
        'GET /api/cache/stats - キャッシュ統計情報',
        'POST /api/cache/reset-stats - 統計情報リセット',
        'GET /api/cache/info - キャッシュ情報取得',
        'GET /api/cache/options - キャッシュオプション取得',
        'POST /api/cache/options - キャッシュオプション設定'
      ],
      conversion: [
        'POST /api/conversion/dcp-to-rsq - DCP→RSQ変換',
        'POST /api/conversion/csv-to-labocs - CSV→LABOCS変換',
        'POST /api/conversion/labocs-to-csv - LABOCS→CSV変換',
        'GET /api/conversion/supported - サポート変換タイプ取得',
        'GET /api/conversion/dcp-items - DCP項目コード取得',
        'GET /api/conversion/labocs-tables - LABOCSテーブル種別取得'
      ],
      algorithms: [
        'POST /api/algorithms/bs05 - Bs05曲線部バス補正',
        'POST /api/algorithms/hsj - HSJ波長帯制限フィルタ',
        'POST /api/algorithms/y1y2 - Y1Y2矢中弦計算',
        'POST /api/algorithms/y1y2/correlation - Y1Y2相関分析',
        'POST /api/algorithms/bs05/theoretical-bass - 理論バス値計算',
        'POST /api/algorithms/hsj/set-band - 波長帯域設定',
        'GET /api/algorithms/info - アルゴリズム情報取得',
        'GET /api/algorithms/supported - サポートアルゴリズム一覧'
      ],
      curveSpec: [
        'POST /api/curve-spec/import - 曲線諸元CSVインポート',
        'GET /api/curve-spec/list - 曲線諸元一覧取得',
        'GET /api/curve-spec/range - キロ程範囲内の曲線諸元取得',
        'POST /api/curve-spec/validate - 曲線諸元整合性チェック',
        'GET /api/curve-spec/export - 曲線諸元CSVエクスポート',
        'PUT /api/curve-spec/update - 曲線諸元更新',
        'DELETE /api/curve-spec/clear - 曲線諸元データクリア'
      ],
      kiyaData: [
        'POST /api/kiya-data/dataset - データセット作成',
        'GET /api/kiya-data/dataset/:datasetId - データセット取得',
        'GET /api/kiya-data/datasets - データセット一覧取得',
        'POST /api/kiya-data/upload/lk - LKファイルアップロード',
        'POST /api/kiya-data/upload/ck - CKファイルアップロード',
        'POST /api/kiya-data/upload/o010 - O010ファイルアップロード',
        'POST /api/kiya-data/upload/batch - 複数ファイル一括アップロード',
        'POST /api/kiya-data/convert/labocs - LABOCS形式変換',
        'GET /api/kiya-data/dataset/:datasetId/position-info - 位置情報取得',
        'GET /api/kiya-data/dataset/:datasetId/measurements - 測定データ取得',
        'DELETE /api/kiya-data/dataset/:datasetId - データセット削除',
        'GET /api/kiya-data/statistics - 統計情報取得',
        'GET /api/kiya-data/info - キヤデータ処理情報取得'
      ],
      trackEnvironment: [
        'POST /api/track-env/dataset - データセット作成',
        'GET /api/track-env/dataset/:datasetId - データセット取得',
        'GET /api/track-env/datasets - データセット一覧取得',
        'POST /api/track-env/upload - 軌道環境データアップロード',
        'POST /api/track-env/upload/batch - 複数ファイル一括アップロード',
        'GET /api/track-env/dataset/:datasetId/range - キロ程範囲で検索',
        'GET /api/track-env/dataset/:datasetId/statistics - 統計情報取得',
        'GET /api/track-env/dataset/:datasetId/export - データエクスポート',
        'DELETE /api/track-env/dataset/:datasetId - データセット削除',
        'GET /api/track-env/statistics - 全体統計情報取得',
        'GET /api/track-env/supported-types - サポートデータ型一覧',
        'GET /api/track-env/info - 軌道環境データ処理情報'
      ],
      eccentricVersine: [
        'POST /api/eccentric-versine/calculate - 偏心矢計算',
        'POST /api/eccentric-versine/characteristics - 検測特性計算',
        'POST /api/eccentric-versine/convert - 偏心矢間変換',
        'POST /api/eccentric-versine/convert-from-seiya - 正矢→偏心矢変換',
        'POST /api/eccentric-versine/convert-to-seiya - 偏心矢→正矢変換',
        'POST /api/eccentric-versine/ab-coefficients - A, B係数計算',
        'POST /api/eccentric-versine/conversion-coefficients - α, β変換係数計算',
        'GET /api/eccentric-versine/info - アルゴリズム情報取得'
      ],
      legacyData: [
        'POST /api/legacy-data/upload - MDT/O010ファイルアップロード',
        'POST /api/legacy-data/parse-mdt - MDTファイル解析',
        'POST /api/legacy-data/parse-o010 - O010ファイル解析',
        'GET /api/legacy-data/info - レガシーデータ処理情報'
      ]
    }
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.url} not found`,
    hint: 'GET /api/endpoints でAPI一覧を確認できます'
  });
});

// サーバー起動
async function startServer() {
  try {
    // ディレクトリ初期化
    console.log('Initializing directories...');
    await initializeDirectories();

    // サーバー起動
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(70));
      console.log('🚂 Rail Track Restoration System - New API Server');
      console.log('='.repeat(70));
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ API URL: http://localhost:${PORT}/api`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✓ System info: http://localhost:${PORT}/api/info`);
      console.log(`✓ API endpoints: http://localhost:${PORT}/api/endpoints`);
      console.log('='.repeat(70));
      console.log('\n📡 Available API Groups:');
      console.log('  ├─ /api/files        - ファイルアップロード・パース');
      console.log('  ├─ /api/restoration  - 復元波形計算・計画線編集');
      console.log('  ├─ /api/reports      - レポート生成');
      console.log('  ├─ /api/batch        - バッチ処理');
      console.log('  ├─ /api/history      - ファイル履歴管理');
      console.log('  ├─ /api/cache        - データキャッシュ管理');
      console.log('  ├─ /api/conversion   - ファイル形式変換');
      console.log('  ├─ /api/algorithms   - コアアルゴリズム (Bs05/HSJ/Y1Y2)');
      console.log('  ├─ /api/curve-spec   - 曲線諸元管理');
      console.log('  ├─ /api/kiya-data    - キヤ141検測車データ処理');
      console.log('  ├─ /api/track-env    - 軌道環境データ管理');
      console.log('  ├─ /api/eccentric-versine - 偏心矢計算・変換');
      console.log('  └─ /api/legacy-data  - レガシーデータ（MDT/O010）処理');
      console.log('\n' + '='.repeat(70) + '\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// サーバー起動
startServer();

module.exports = app;

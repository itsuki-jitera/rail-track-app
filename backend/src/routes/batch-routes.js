/**
 * バッチ処理API
 * Batch processing routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// バッチ処理
const { BatchProcessor } = require('../batch/batch-processor');
const batchJobManager = require('../utils/batch-job-manager');
const { RailTrackRestorationSystem } = require('../index');

// バッチプロセッサー初期化
let batchProcessor = null;
let currentBatchState = null;

// Multer設定 - 複数ファイルアップロード用
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/batch');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `batch-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/**
 * バッチ処理開始
 * POST /api/batch/start
 */
router.post('/start', async (req, res) => {
  try {
    const { inputDirectory, options } = req.body;

    if (!inputDirectory) {
      return res.status(400).json({
        success: false,
        error: 'Input directory is required'
      });
    }

    // バッチプロセッサー初期化
    batchProcessor = new BatchProcessor(options);

    // 進捗コールバック
    const onProgress = (progress) => {
      currentBatchState = progress;
    };

    // バッチ処理実行（非同期）
    const result = await batchProcessor.processDirectory(inputDirectory, {
      ...options,
      onProgress
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * バッチ処理進捗取得
 * GET /api/batch/progress
 */
router.get('/progress', (req, res) => {
  try {
    if (!batchProcessor) {
      return res.json({
        success: true,
        state: null,
        message: 'No batch processing running'
      });
    }

    const state = batchProcessor.getState();

    res.json({
      success: true,
      state,
      currentProgress: currentBatchState
    });
  } catch (error) {
    console.error('Get batch progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DCP→RSQバッチ変換
 * POST /api/batch/convert-dcp-to-rsq
 */
router.post('/convert-dcp-to-rsq', async (req, res) => {
  try {
    const { dcpDirectory, outputDirectory } = req.body;

    if (!dcpDirectory || !outputDirectory) {
      return res.status(400).json({
        success: false,
        error: 'DCP directory and output directory are required'
      });
    }

    batchProcessor = new BatchProcessor();

    const result = await batchProcessor.batchConvertDCPToRSQ(
      dcpDirectory,
      outputDirectory
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('DCP to RSQ batch conversion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * バッチ処理オプション取得
 * GET /api/batch/options
 */
router.get('/options', (req, res) => {
  try {
    if (!batchProcessor) {
      batchProcessor = new BatchProcessor();
    }

    const options = batchProcessor.getOptions();

    res.json({
      success: true,
      options
    });
  } catch (error) {
    console.error('Get batch options error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * バッチ処理オプション設定
 * POST /api/batch/options
 */
router.post('/options', (req, res) => {
  try {
    const { options } = req.body;

    if (!batchProcessor) {
      batchProcessor = new BatchProcessor();
    }

    batchProcessor.setOptions(options);

    res.json({
      success: true,
      options: batchProcessor.getOptions()
    });
  } catch (error) {
    console.error('Set batch options error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// BatchJobManager統合エンドポイント
// ========================================

/**
 * 複数ファイル一括処理
 * POST /api/batch/process-files
 */
router.post('/process-files', upload.array('files', 100), async (req, res) => {
  try {
    const files = req.files;
    const { processingType = 'restoration', options = {} } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // ジョブ作成
    const jobId = batchJobManager.createJob({
      processingType,
      options: JSON.parse(typeof options === 'string' ? options : JSON.stringify(options)),
      files: files.map(f => ({
        originalName: f.originalname,
        path: f.path,
        size: f.size,
        mimetype: f.mimetype
      }))
    });

    // ジョブを実行中にする
    batchJobManager.updateJobStatus(jobId, 'running');

    // バックグラウンドで処理を開始
    processFilesInBackground(jobId, files, processingType, options);

    res.json({
      success: true,
      jobId,
      message: `${files.length}個のファイルのバッチ処理を開始しました`,
      filesCount: files.length
    });
  } catch (error) {
    console.error('Process files error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 全ジョブ一覧取得
 * GET /api/batch/jobs
 */
router.get('/jobs', (req, res) => {
  try {
    const jobs = batchJobManager.getAllJobs();
    const statistics = batchJobManager.getStatistics();

    res.json({
      success: true,
      jobs,
      statistics,
      totalJobs: jobs.length
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 特定ジョブ詳細取得
 * GET /api/batch/jobs/:jobId
 */
router.get('/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = batchJobManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ジョブ削除
 * DELETE /api/batch/jobs/:jobId
 */
router.delete('/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const deleted = batchJobManager.deleteJob(jobId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ジョブ統計情報取得
 * GET /api/batch/statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const statistics = batchJobManager.getStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 古いジョブのクリーンアップ
 * POST /api/batch/cleanup
 */
router.post('/cleanup', (req, res) => {
  try {
    const { maxAge = 24 * 60 * 60 * 1000 } = req.body; // デフォルト24時間
    const deletedJobs = batchJobManager.cleanup(maxAge);

    res.json({
      success: true,
      deletedCount: deletedJobs.length,
      deletedJobs,
      message: `${deletedJobs.length}個の古いジョブを削除しました`
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ジョブ結果の一括エクスポート
 * POST /api/batch/jobs/:jobId/export
 */
router.post('/jobs/:jobId/export', (req, res) => {
  try {
    const { jobId } = req.params;
    const { format = 'csv' } = req.body;
    const job = batchJobManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // CSV形式でエクスポート
    const lines = [];

    // ヘッダー
    lines.push('バッチ処理結果レポート');
    lines.push(`ジョブID,${job.id}`);
    lines.push(`作成日時,${job.createdAt}`);
    lines.push(`開始日時,${job.startTime || '-'}`);
    lines.push(`終了日時,${job.endTime || '-'}`);
    lines.push(`ステータス,${job.status}`);
    lines.push(`総ファイル数,${job.totalFiles}`);
    lines.push(`処理済みファイル数,${job.processedFiles}`);
    lines.push(`成功数,${job.successCount}`);
    lines.push(`失敗数,${job.failureCount}`);
    lines.push('');

    // 成功結果
    if (job.results.length > 0) {
      lines.push('=== 成功ファイル ===');
      lines.push('ファイル名,処理日時,データ点数,最小値,最大値,平均値,標準偏差');

      for (const result of job.results) {
        const stats = result.result?.statistics;
        lines.push([
          result.fileName,
          result.processedAt,
          result.result?.restoredWaveform?.length || '-',
          stats?.min?.toFixed(3) || '-',
          stats?.max?.toFixed(3) || '-',
          stats?.mean?.toFixed(3) || '-',
          stats?.sigma?.toFixed(3) || '-'
        ].join(','));
      }
      lines.push('');
    }

    // エラー結果
    if (job.errors.length > 0) {
      lines.push('=== エラーファイル ===');
      lines.push('ファイル名,処理日時,エラー内容');

      for (const error of job.errors) {
        lines.push([
          error.fileName,
          error.processedAt,
          `"${error.error.replace(/"/g, '""')}"` // CSVエスケープ
        ].join(','));
      }
    }

    const csvContent = lines.join('\n');
    const filename = `batch_job_${jobId}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // UTF-8 BOM
  } catch (error) {
    console.error('Export job error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 全ジョブ結果の一括エクスポート
 * POST /api/batch/export-all
 */
router.post('/export-all', (req, res) => {
  try {
    const { status = 'all' } = req.body;
    const allJobs = batchJobManager.getAllJobs();

    // ステータスでフィルタ
    const filteredJobs = status === 'all'
      ? allJobs
      : allJobs.filter(job => job.status === status);

    if (filteredJobs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No jobs found'
      });
    }

    // CSV形式でエクスポート
    const lines = [];

    // ヘッダー
    lines.push('バッチ処理ジョブ一覧');
    lines.push(`出力日時,${new Date().toISOString()}`);
    lines.push(`総ジョブ数,${filteredJobs.length}`);
    lines.push('');

    // ジョブ一覧
    lines.push('ジョブID,作成日時,開始日時,終了日時,ステータス,総ファイル数,処理済み,成功数,失敗数,進捗率');

    for (const job of filteredJobs) {
      lines.push([
        job.id,
        job.createdAt,
        job.startTime || '-',
        job.endTime || '-',
        job.status,
        job.totalFiles,
        job.processedFiles,
        job.successCount,
        job.failureCount,
        `${job.progress || 0}%`
      ].join(','));
    }

    const csvContent = lines.join('\n');
    const filename = `batch_jobs_summary_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // UTF-8 BOM
  } catch (error) {
    console.error('Export all jobs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// ヘルパー関数
// ========================================

/**
 * バックグラウンドでファイルを処理
 */
async function processFilesInBackground(jobId, files, processingType, options) {
  try {
    const system = new RailTrackRestorationSystem();
    const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // ファイルタイプに応じた処理
        let result;

        if (processingType === 'restoration') {
          // RSQファイルの復元波形計算
          const fileContent = await fs.readFile(file.path, 'utf-8');
          const parsedData = system.parseRSQFile(fileContent);

          result = system.calculateRestorationWaveform(
            parsedData.measurementData,
            parsedOptions
          );

          // 統計情報を計算
          if (result.restoredWaveform && result.restoredWaveform.length > 0) {
            const values = result.restoredWaveform;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            const sigma = Math.sqrt(variance);

            result.statistics = { min, max, mean, sigma, count: values.length };
          }

          result.fileName = file.originalname;
          result.filePath = file.path;
        } else if (processingType === 'conversion') {
          // ファイル形式変換
          const fileContent = await fs.readFile(file.path, 'utf-8');
          const fileExt = path.extname(file.originalname).toLowerCase();

          if (fileExt === '.dcp') {
            // DCP→RSQ変換
            const dcpData = system.parseDCPFile(fileContent);
            const rsqContent = system.convertDCPToRSQ(dcpData);

            // 変換後のファイルを保存
            const outputFileName = file.originalname.replace(/\.dcp$/i, '.rsq');
            const outputPath = path.join(path.dirname(file.path), outputFileName);
            await fs.writeFile(outputPath, rsqContent, 'utf-8');

            result = {
              fileName: file.originalname,
              outputFileName,
              outputPath,
              message: 'DCP to RSQ conversion completed',
              conversionType: 'DCP→RSQ'
            };
          } else {
            throw new Error(`Unsupported file type for conversion: ${fileExt}`);
          }
        } else {
          throw new Error(`Unknown processing type: ${processingType}`);
        }

        // 成功結果を記録
        batchJobManager.addFileResult(jobId, {
          fileName: file.originalname,
          filePath: file.path,
          result,
          processedAt: new Date().toISOString()
        }, true);

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);

        // エラー結果を記録
        batchJobManager.addFileResult(jobId, {
          fileName: file.originalname,
          filePath: file.path,
          error: fileError.message,
          errorStack: fileError.stack,
          processedAt: new Date().toISOString()
        }, false);
      }
    }

    console.log(`Batch job ${jobId} completed`);
  } catch (error) {
    console.error(`Batch job ${jobId} failed:`, error);
    batchJobManager.updateJobStatus(jobId, 'failed');
  }
}

module.exports = router;

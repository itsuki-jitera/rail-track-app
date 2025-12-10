/**
 * バッチ処理ジョブマネージャー
 * Batch Job Manager for processing multiple files
 */

class BatchJobManager {
  constructor() {
    this.jobs = new Map();
    this.jobIdCounter = 0;
  }

  /**
   * 新しいバッチジョブを作成
   * @param {Object} config - ジョブ設定
   * @returns {string} - ジョブID
   */
  createJob(config) {
    const jobId = `batch_${Date.now()}_${++this.jobIdCounter}`;

    const job = {
      id: jobId,
      status: 'pending', // pending, running, completed, failed
      config,
      files: config.files || [],
      totalFiles: (config.files || []).length,
      processedFiles: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      errors: [],
      startTime: null,
      endTime: null,
      createdAt: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  /**
   * ジョブ情報を取得
   * @param {string} jobId - ジョブID
   * @returns {Object} - ジョブ情報
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * すべてのジョブを取得
   * @returns {Array} - ジョブリスト
   */
  getAllJobs() {
    return Array.from(this.jobs.values()).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  /**
   * ジョブのステータスを更新
   * @param {string} jobId - ジョブID
   * @param {string} status - 新しいステータス
   */
  updateJobStatus(jobId, status) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;

    if (status === 'running' && !job.startTime) {
      job.startTime = new Date().toISOString();
    } else if ((status === 'completed' || status === 'failed') && !job.endTime) {
      job.endTime = new Date().toISOString();
    }
  }

  /**
   * ファイル処理結果を追加
   * @param {string} jobId - ジョブID
   * @param {Object} result - 処理結果
   * @param {boolean} success - 成功フラグ
   */
  addFileResult(jobId, result, success = true) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.processedFiles++;

    if (success) {
      job.successCount++;
      job.results.push(result);
    } else {
      job.failureCount++;
      job.errors.push(result);
    }

    // 進捗率を計算
    job.progress = job.totalFiles > 0
      ? Math.round((job.processedFiles / job.totalFiles) * 100)
      : 0;

    // 全ファイル処理完了チェック
    if (job.processedFiles >= job.totalFiles) {
      this.updateJobStatus(jobId,
        job.failureCount === 0 ? 'completed' : 'completed_with_errors'
      );
    }
  }

  /**
   * ジョブを削除
   * @param {string} jobId - ジョブID
   */
  deleteJob(jobId) {
    return this.jobs.delete(jobId);
  }

  /**
   * 古いジョブをクリーンアップ
   * @param {number} maxAge - 最大保持時間（ミリ秒）
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // デフォルト24時間
    const now = new Date();
    const deletedJobs = [];

    for (const [jobId, job] of this.jobs.entries()) {
      const createdAt = new Date(job.createdAt);
      const age = now - createdAt;

      if (age > maxAge && (job.status === 'completed' || job.status === 'failed')) {
        this.jobs.delete(jobId);
        deletedJobs.push(jobId);
      }
    }

    return deletedJobs;
  }

  /**
   * ジョブの統計情報を取得
   */
  getStatistics() {
    const jobs = Array.from(this.jobs.values());

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      completedWithErrors: jobs.filter(j => j.status === 'completed_with_errors').length
    };
  }
}

// シングルトンインスタンス
const batchJobManager = new BatchJobManager();

module.exports = batchJobManager;

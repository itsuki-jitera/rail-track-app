/**
 * バッチ処理ページ
 * Batch Processing Page
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// 型定義
interface BatchJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'completed_with_errors';
  config: {
    processingType: string;
    options: any;
    files: any[];
  };
  files: any[];
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  failureCount: number;
  results: any[];
  errors: any[];
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  progress?: number;
}

interface BatchStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  completedWithErrors: number;
}

const BatchProcessingPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [statistics, setStatistics] = useState<BatchStatistics | null>(null);
  const [processingType, setProcessingType] = useState<string>('restoration');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ジョブ一覧を取得
  const fetchJobs = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/batch/jobs');
      if (response.data.success) {
        setJobs(response.data.jobs);
        setStatistics(response.data.statistics);
      }
    } catch (error: any) {
      console.error('ジョブ取得エラー:', error);
    }
  }, []);

  // 初回読み込み
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // 自動更新
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchJobs, 3000); // 3秒ごとに更新
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, fetchJobs]);

  // ファイル選択
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
    }
  };

  // ドラッグ&ドロップ
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  // バッチ処理開始
  const handleStartBatch = async () => {
    if (selectedFiles.length === 0) {
      alert('ファイルを選択してください');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('processingType', processingType);
      formData.append('options', JSON.stringify({}));

      const response = await axios.post(
        'http://localhost:5000/api/batch/process-files',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        alert(`✓ ${response.data.message}\nジョブID: ${response.data.jobId}`);
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        await fetchJobs();
      }
    } catch (error: any) {
      alert('バッチ処理開始エラー: ' + (error.response?.data?.error || error.message));
    }

    setLoading(false);
  };

  // ジョブ削除
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('このジョブを削除しますか?')) {
      return;
    }

    try {
      const response = await axios.delete(`http://localhost:5000/api/batch/jobs/${jobId}`);
      if (response.data.success) {
        alert('✓ ジョブを削除しました');
        await fetchJobs();
      }
    } catch (error: any) {
      alert('ジョブ削除エラー: ' + (error.response?.data?.error || error.message));
    }
  };

  // 古いジョブクリーンアップ
  const handleCleanup = async () => {
    if (!confirm('完了済みの古いジョブをクリーンアップしますか?')) {
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/batch/cleanup', {
        maxAge: 24 * 60 * 60 * 1000 // 24時間
      });
      if (response.data.success) {
        alert(`✓ ${response.data.message}`);
        await fetchJobs();
      }
    } catch (error: any) {
      alert('クリーンアップエラー: ' + (error.response?.data?.error || error.message));
    }
  };

  // ジョブ結果エクスポート
  const handleExportJob = async (jobId: string) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/api/batch/jobs/${jobId}/export`,
        { format: 'csv' },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_job_${jobId}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('✓ ジョブ結果をエクスポートしました');
    } catch (error: any) {
      alert('エクスポートエラー: ' + (error.response?.data?.error || error.message));
    }
  };

  // 全ジョブ結果エクスポート
  const handleExportAllJobs = async () => {
    try {
      const response = await axios.post(
        'http://localhost:5000/api/batch/export-all',
        { status: 'all' },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_jobs_summary_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('✓ 全ジョブ結果をエクスポートしました');
    } catch (error: any) {
      alert('エクスポートエラー: ' + (error.response?.data?.error || error.message));
    }
  };

  // ステータス表示用の色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#6c757d';
      case 'running': return '#007bff';
      case 'completed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'completed_with_errors': return '#ffc107';
      default: return '#6c757d';
    }
  };

  // ステータス表示用のテキスト
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待機中';
      case 'running': return '処理中';
      case 'completed': return '完了';
      case 'failed': return '失敗';
      case 'completed_with_errors': return '一部エラー';
      default: return status;
    }
  };

  // フォーマット用関数
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>バッチ処理</h1>
      <p>複数のRSQファイルを一括で処理できます</p>

      {/* 統計情報 */}
      {statistics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#495057' }}>
              {statistics.total}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d', marginTop: '5px' }}>
              総ジョブ数
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
              {statistics.running}
            </div>
            <div style={{ fontSize: '14px', color: '#0056b3', marginTop: '5px' }}>
              処理中
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
              {statistics.completed}
            </div>
            <div style={{ fontSize: '14px', color: '#1e7e34', marginTop: '5px' }}>
              完了
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
              {statistics.completedWithErrors}
            </div>
            <div style={{ fontSize: '14px', color: '#856404', marginTop: '5px' }}>
              一部エラー
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#f8d7da',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
              {statistics.failed}
            </div>
            <div style={{ fontSize: '14px', color: '#721c24', marginTop: '5px' }}>
              失敗
            </div>
          </div>
        </div>
      )}

      {/* ファイルアップロード */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2>ファイルアップロード</h2>

        {/* ドラッグ&ドロップエリア */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '3px dashed #007bff' : '2px dashed #dee2e6',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            backgroundColor: isDragging ? '#e3f2fd' : '#f8f9fa',
            cursor: 'pointer',
            marginBottom: '20px',
            transition: 'all 0.3s ease'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>
            📁
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
            {isDragging ? 'ファイルをドロップ' : 'ファイルをドラッグ&ドロップ'}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>
            または、クリックしてファイルを選択
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".rsq,.RSQ"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* 選択ファイル一覧 */}
        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3>選択されたファイル ({selectedFiles.length}個)</h3>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: '5px',
              padding: '10px'
            }}>
              {selectedFiles.map((file, index) => (
                <div key={index} style={{
                  padding: '8px',
                  borderBottom: index < selectedFiles.length - 1 ? '1px solid #e9ecef' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ flex: 1 }}>{file.name}</span>
                  <span style={{ color: '#6c757d', fontSize: '14px' }}>
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 処理タイプ選択 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            処理タイプ:
          </label>
          <select
            value={processingType}
            onChange={(e) => setProcessingType(e.target.value)}
            style={{
              padding: '10px',
              border: '1px solid #ced4da',
              borderRadius: '5px',
              fontSize: '16px',
              width: '100%',
              maxWidth: '300px'
            }}
          >
            <option value="restoration">復元波形計算</option>
            <option value="conversion">ファイル形式変換</option>
          </select>
        </div>

        {/* アクション */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleStartBatch}
            disabled={loading || selectedFiles.length === 0}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedFiles.length === 0 ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '処理中...' : `バッチ処理開始 (${selectedFiles.length}ファイル)`}
          </button>
          <button
            onClick={() => {
              setSelectedFiles([]);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            disabled={selectedFiles.length === 0}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              cursor: selectedFiles.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            クリア
          </button>
        </div>
      </div>

      {/* ジョブ管理 */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2>ジョブ一覧</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              自動更新 (3秒)
            </label>
            <button
              onClick={fetchJobs}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              更新
            </button>
            <button
              onClick={handleExportAllJobs}
              style={{
                padding: '8px 16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              全ジョブエクスポート
            </button>
            <button
              onClick={handleCleanup}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              クリーンアップ
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6c757d'
          }}>
            ジョブがありません
          </div>
        ) : (
          <div style={{
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '15px',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                      ジョブ ID: {job.id}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6c757d' }}>
                      作成日時: {formatDate(job.createdAt)}
                    </div>
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: getStatusColor(job.status),
                    color: 'white',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {getStatusText(job.status)}
                  </div>
                </div>

                {/* 進捗バー */}
                {job.status === 'running' && job.progress !== undefined && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '5px',
                      fontSize: '14px'
                    }}>
                      <span>進捗: {job.processedFiles} / {job.totalFiles} ファイル</span>
                      <span>{job.progress}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '20px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${job.progress}%`,
                        height: '100%',
                        backgroundColor: '#007bff',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}

                {/* 統計情報 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '10px',
                  marginBottom: '15px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>総ファイル数</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{job.totalFiles}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>処理済み</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{job.processedFiles}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#28a745' }}>成功</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                      {job.successCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#dc3545' }}>失敗</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc3545' }}>
                      {job.failureCount}
                    </div>
                  </div>
                </div>

                {/* 時間情報 */}
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '15px' }}>
                  {job.startTime && (
                    <div>開始: {formatDate(job.startTime)}</div>
                  )}
                  {job.endTime && (
                    <div>終了: {formatDate(job.endTime)}</div>
                  )}
                </div>

                {/* アクション */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(job.status === 'completed' || job.status === 'completed_with_errors') && (
                    <button
                      onClick={() => handleExportJob(job.id)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      レポート出力
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    削除
                  </button>
                  {job.errors.length > 0 && (
                    <button
                      onClick={() => {
                        alert(`エラー詳細:\n\n${job.errors.map(e =>
                          `ファイル: ${e.fileName}\nエラー: ${e.error}`
                        ).join('\n\n')}`);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#ffc107',
                        color: '#212529',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      エラー詳細 ({job.errors.length})
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchProcessingPage;

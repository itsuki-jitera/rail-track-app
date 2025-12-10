/**
 * 統合ファイルアップローダー
 * Unified File Uploader - Supports all rail track data formats
 *
 * サポート形式:
 * - RSQ: 旧形式検測データ (単一ファイル)
 * - HDR/DAT: 2ファイル構成検測データ
 * - DCP: 全項目一括データ (単一ファイル)
 * - PNT: ポイントデータ (単一ファイル)
 * - TBL/DDB: LABOCS表形式データ (2ファイル構成)
 * - MDT/O010: 旧ラボデータ (2ファイル構成)
 */

import React, { useState } from 'react';
import axios from 'axios';

export type FileFormat = 'RSQ' | 'HDR_DAT' | 'DCP' | 'PNT' | 'TBL_DDB' | 'MDT_O010';

interface UnifiedFileUploaderProps {
  onUploadSuccess?: (data: any, format: FileFormat) => void;
  onUploadError?: (error: string) => void;
  allowedFormats?: FileFormat[];
}

interface UploadedFileInfo {
  name: string;
  size: number;
  file: File;
}

const API_BASE_URL_5000 = 'http://localhost:5000/api';
const API_BASE_URL_3002 = 'http://localhost:5000/api';

export const UnifiedFileUploader: React.FC<UnifiedFileUploaderProps> = ({
  onUploadSuccess,
  onUploadError,
  allowedFormats = ['RSQ', 'HDR_DAT', 'DCP', 'PNT', 'TBL_DDB', 'MDT_O010']
}) => {
  const [selectedFormat, setSelectedFormat] = useState<FileFormat>('RSQ');
  const [file1, setFile1] = useState<UploadedFileInfo | null>(null);
  const [file2, setFile2] = useState<UploadedFileInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<any | null>(null);

  // フォーマット設定
  const formatConfig: Record<FileFormat, {
    label: string;
    description: string;
    file1Label: string;
    file1Extensions: string;
    file2Label?: string;
    file2Extensions?: string;
    requiresTwoFiles: boolean;
    apiEndpoint: string;
    apiBaseUrl: string;
  }> = {
    RSQ: {
      label: 'RSQ形式',
      description: '旧形式検測データ（バイナリ、1ファイル）',
      file1Label: 'RSQファイル',
      file1Extensions: '.rsq',
      requiresTwoFiles: false,
      apiEndpoint: '/files/upload-rsq',
      apiBaseUrl: API_BASE_URL_5000
    },
    HDR_DAT: {
      label: 'HDR/DAT形式',
      description: '検測データ（2ファイル構成）',
      file1Label: 'HDRファイル（ヘッダー）',
      file1Extensions: '.hdr',
      file2Label: 'DATファイル（データ）',
      file2Extensions: '.dat',
      requiresTwoFiles: true,
      apiEndpoint: '/files/upload-hdrdat',
      apiBaseUrl: API_BASE_URL_5000
    },
    DCP: {
      label: 'DCP形式',
      description: '全項目一括データ（バイナリ、1ファイル）',
      file1Label: 'DCPファイル',
      file1Extensions: '.dcp',
      requiresTwoFiles: false,
      apiEndpoint: '/files/upload-dcp',
      apiBaseUrl: API_BASE_URL_5000
    },
    PNT: {
      label: 'PNT形式',
      description: 'ポイントデータ',
      file1Label: 'PNTファイル',
      file1Extensions: '.pnt',
      requiresTwoFiles: false,
      apiEndpoint: '/files/upload-pnt',
      apiBaseUrl: API_BASE_URL_5000
    },
    TBL_DDB: {
      label: 'TBL/DDB形式 (LABOCS)',
      description: 'LABOCS表形式データ（2ファイル構成）',
      file1Label: 'DDBファイル（テーブル定義）',
      file1Extensions: '.ddb',
      file2Label: 'TBLファイル（データ）',
      file2Extensions: '.tbl',
      requiresTwoFiles: true,
      apiEndpoint: '/files/upload-tblddb',
      apiBaseUrl: API_BASE_URL_5000
    },
    MDT_O010: {
      label: 'MDT/O010形式',
      description: '旧ラボデータ（2ファイル構成）',
      file1Label: 'MDTファイル（ヘッダー）',
      file1Extensions: '.mdt,.MDT',
      file2Label: 'O010*.csvファイル（データ）',
      file2Extensions: '.csv,.CSV',
      requiresTwoFiles: true,
      apiEndpoint: '/legacy-data/upload',
      apiBaseUrl: API_BASE_URL_5000
    }
  };

  const config = formatConfig[selectedFormat];

  // ファイル選択ハンドラー
  const handleFile1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile1({
        name: file.name,
        size: file.size,
        file
      });
      setError(null);
    }
  };

  const handleFile2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile2({
        name: file.name,
        size: file.size,
        file
      });
      setError(null);
    }
  };

  // アップロード実行
  const handleUpload = async () => {
    if (!file1) {
      setError('ファイルを選択してください');
      return;
    }

    if (config.requiresTwoFiles && !file2) {
      setError('2つ目のファイルを選択してください');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadedData(null);

    try {
      const formData = new FormData();

      if (selectedFormat === 'RSQ') {
        formData.append('file', file1.file);
      } else if (selectedFormat === 'HDR_DAT') {
        formData.append('hdr', file1.file);
        formData.append('dat', file2!.file);
      } else if (selectedFormat === 'DCP') {
        formData.append('file', file1.file);
      } else if (selectedFormat === 'PNT') {
        formData.append('file', file1.file);
      } else if (selectedFormat === 'TBL_DDB') {
        formData.append('ddb', file1.file);
        formData.append('tbl', file2!.file);
      } else if (selectedFormat === 'MDT_O010') {
        formData.append('mdt', file1.file);
        formData.append('o010', file2!.file);
      }

      const response = await axios.post(
        `${config.apiBaseUrl}${config.apiEndpoint}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            setUploadProgress(percentCompleted);
          }
        }
      );

      if (response.data.success) {
        setUploadedData(response.data);
        if (onUploadSuccess) {
          onUploadSuccess(response.data, selectedFormat);
        }
      } else {
        throw new Error(response.data.error || 'アップロードに失敗しました');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      setError(errorMsg);
      if (onUploadError) {
        onUploadError(errorMsg);
      }
    } finally {
      setUploading(false);
    }
  };

  // クリア
  const handleClear = () => {
    setFile1(null);
    setFile2(null);
    setError(null);
    setUploadedData(null);
    setUploadProgress(0);
  };

  // ファイルサイズをフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="unified-file-uploader">
      {/* フォーマット選択 */}
      <div className="format-selector">
        <h3>ファイル形式を選択</h3>
        <div className="format-buttons">
          {allowedFormats.map((format) => (
            <button
              key={format}
              className={`format-btn ${selectedFormat === format ? 'active' : ''}`}
              onClick={() => {
                setSelectedFormat(format);
                handleClear();
              }}
              disabled={uploading}
            >
              <div className="format-label">{formatConfig[format].label}</div>
              <div className="format-desc">{formatConfig[format].description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ファイル選択 */}
      <div className="file-inputs">
        {/* ファイル1 */}
        <div className="file-input-group">
          <label htmlFor="file1">
            <strong>{config.file1Label}</strong>
          </label>
          <input
            id="file1"
            type="file"
            accept={config.file1Extensions}
            onChange={handleFile1Change}
            disabled={uploading}
          />
          {file1 && (
            <div className="file-info">
              <span className="file-name">📄 {file1.name}</span>
              <span className="file-size">{formatFileSize(file1.size)}</span>
            </div>
          )}
        </div>

        {/* ファイル2 (必要な場合のみ) */}
        {config.requiresTwoFiles && (
          <div className="file-input-group">
            <label htmlFor="file2">
              <strong>{config.file2Label}</strong>
            </label>
            <input
              id="file2"
              type="file"
              accept={config.file2Extensions}
              onChange={handleFile2Change}
              disabled={uploading}
            />
            {file2 && (
              <div className="file-info">
                <span className="file-name">📄 {file2.name}</span>
                <span className="file-size">{formatFileSize(file2.size)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* アップロードボタン */}
      <div className="upload-actions">
        <button
          className="btn-upload"
          onClick={handleUpload}
          disabled={uploading || !file1 || (config.requiresTwoFiles && !file2)}
        >
          {uploading ? `アップロード中... ${uploadProgress}%` : '📤 アップロード'}
        </button>
        <button
          className="btn-clear"
          onClick={handleClear}
          disabled={uploading}
        >
          🗑️ クリア
        </button>
      </div>

      {/* 進捗バー */}
      {uploading && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* アップロード成功メッセージ */}
      {uploadedData && !error && (
        <div className="success-message">
          ✅ アップロードに成功しました！
          {uploadedData.dataPoints && (
            <div className="data-info">
              データ点数: {uploadedData.dataPoints.toLocaleString()}
            </div>
          )}
        </div>
      )}

      <style>{`
        .unified-file-uploader {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
        }

        .format-selector {
          margin-bottom: 24px;
        }

        .format-selector h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
        }

        .format-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .format-btn {
          padding: 16px;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .format-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .format-btn.active {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .format-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .format-label {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .format-desc {
          font-size: 12px;
          opacity: 0.8;
        }

        .file-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .file-input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-input-group label {
          font-size: 14px;
          color: #374151;
        }

        .file-input-group input[type="file"] {
          padding: 10px;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          background: #f9fafb;
          cursor: pointer;
          transition: all 0.2s;
        }

        .file-input-group input[type="file"]:hover:not(:disabled) {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .file-input-group input[type="file"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .file-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f0f9ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          font-size: 13px;
        }

        .file-name {
          color: #1e40af;
          font-weight: 600;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          color: #6b7280;
          margin-left: 12px;
        }

        .upload-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .btn-upload, .btn-clear {
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-upload {
          flex: 1;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }

        .btn-upload:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          transform: translateY(-2px);
        }

        .btn-upload:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-clear {
          background: white;
          color: #374151;
          border: 2px solid #d1d5db;
        }

        .btn-clear:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .btn-clear:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .progress-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          transition: width 0.3s ease;
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .error-message {
          padding: 14px 18px;
          background: linear-gradient(135deg, #fef2f2, #fee2e2);
          border: 2px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
          font-weight: 600;
        }

        .success-message {
          padding: 14px 18px;
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 2px solid #bbf7d0;
          border-radius: 8px;
          color: #16a34a;
          font-size: 14px;
          font-weight: 600;
        }

        .data-info {
          margin-top: 8px;
          font-size: 12px;
          color: #059669;
        }
      `}</style>
    </div>
  );
};

export default UnifiedFileUploader;

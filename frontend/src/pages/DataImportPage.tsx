/**
 * データインポートページ
 * Data Import Page - Unified file upload for all formats
 */

import React, { useState } from 'react';
import { UnifiedFileUploader, FileFormat } from '../components/UnifiedFileUploader';

interface ImportedDataInfo {
  format: FileFormat;
  filename: string;
  timestamp: Date;
  data: any;
}

export const DataImportPage: React.FC = () => {
  const [importHistory, setImportHistory] = useState<ImportedDataInfo[]>([]);
  const [selectedData, setSelectedData] = useState<ImportedDataInfo | null>(null);

  const handleUploadSuccess = (data: any, format: FileFormat) => {
    const newEntry: ImportedDataInfo = {
      format,
      filename: data.filename || 'unknown',
      timestamp: new Date(),
      data
    };

    setImportHistory(prev => [newEntry, ...prev]);
    setSelectedData(newEntry);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  // データ詳細表示
  const renderDataDetails = (entry: ImportedDataInfo) => {
    const { format, data } = entry;

    switch (format) {
      case 'RSQ':
        return (
          <div className="data-details">
            <h4>RSQデータ</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">ファイルID:</span>
                <span className="value">{data.header?.fileId || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">路線コード:</span>
                <span className="value">{data.header?.lineCode || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">上下区分:</span>
                <span className="value">{data.header?.direction || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">測定日:</span>
                <span className="value">{data.header?.measurementDate ? new Date(data.header.measurementDate).toLocaleDateString('ja-JP') : 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">データ項目:</span>
                <span className="value">{data.dataType || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">データ点数:</span>
                <span className="value">{data.dataPoints?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">開始キロ程:</span>
                <span className="value">{data.header?.startKilometer || 0} m</span>
              </div>
              <div className="detail-item">
                <span className="label">終了キロ程:</span>
                <span className="value">{data.header?.endKilometer || 0} m</span>
              </div>
            </div>
          </div>
        );

      case 'DCP':
        return (
          <div className="data-details">
            <h4>DCPデータ（全項目一括）</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">ファイルID:</span>
                <span className="value">{data.header?.fileId || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">測定日:</span>
                <span className="value">{data.header?.measurementDate ? new Date(data.header.measurementDate).toLocaleDateString('ja-JP') : 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">データ点数:</span>
                <span className="value">{data.dataPoints?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="detail-item full-width">
                <span className="label">利用可能な項目:</span>
                <div className="items-list">
                  {data.availableItems?.map((item: any, index: number) => (
                    <span key={index} className="item-badge">
                      {item.name} ({item.code})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'TBL_DDB':
        return (
          <div className="data-details">
            <h4>LABOCS表形式データ (TBL/DDB)</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">テーブル名:</span>
                <span className="value">{data.header?.tableName || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">テーブル種別:</span>
                <span className="value">{data.tableTypeName || data.header?.tableType || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">レコード数:</span>
                <span className="value">{data.recordCount?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="detail-item full-width">
                <span className="label">フィールド:</span>
                <div className="items-list">
                  {data.header?.fields?.map((field: any, index: number) => (
                    <span key={index} className="item-badge">
                      {field.name} ({field.type})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="data-details">
            <h4>データ詳細</h4>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="data-import-page">
      <div className="page-header">
        <h1>📁 データインポート</h1>
        <p className="page-description">
          軌道検測データの統合アップロード・管理
        </p>
      </div>

      {/* アップローダー */}
      <section className="upload-section">
        <UnifiedFileUploader
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />
      </section>

      {/* インポート履歴 & 詳細 */}
      {importHistory.length > 0 && (
        <div className="content-grid">
          {/* 履歴リスト */}
          <section className="history-section">
            <h2>インポート履歴</h2>
            <div className="history-list">
              {importHistory.map((entry, index) => (
                <div
                  key={index}
                  className={`history-item ${selectedData === entry ? 'active' : ''}`}
                  onClick={() => setSelectedData(entry)}
                >
                  <div className="history-icon">
                    {entry.format === 'RSQ' && '📊'}
                    {entry.format === 'DCP' && '📈'}
                    {entry.format === 'TBL_DDB' && '📋'}
                    {entry.format === 'HDR_DAT' && '📉'}
                    {entry.format === 'PNT' && '📍'}
                    {entry.format === 'MDT_O010' && '📄'}
                  </div>
                  <div className="history-info">
                    <div className="history-format">{entry.format}</div>
                    <div className="history-filename">{entry.filename}</div>
                    <div className="history-time">
                      {entry.timestamp.toLocaleString('ja-JP')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* データ詳細 */}
          {selectedData && (
            <section className="details-section">
              <h2>データ詳細</h2>
              {renderDataDetails(selectedData)}
            </section>
          )}
        </div>
      )}

      {/* 空状態 */}
      {importHistory.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📤</div>
          <h3>ファイルをアップロードしてください</h3>
          <p>上記のフォーマット選択からファイル形式を選んで、ファイルをアップロードしてください</p>
        </div>
      )}

      <style>{`
        .data-import-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
        }

        .page-description {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .upload-section {
          margin-bottom: 32px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 24px;
          margin-top: 32px;
        }

        .history-section, .details-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
        }

        .history-section h2, .details-section h2 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .history-item:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .history-item.active {
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
        }

        .history-icon {
          font-size: 32px;
        }

        .history-info {
          flex: 1;
        }

        .history-format {
          font-size: 12px;
          font-weight: 700;
          color: #3b82f6;
          text-transform: uppercase;
        }

        .history-filename {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          margin: 2px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-time {
          font-size: 12px;
          color: #6b7280;
        }

        .data-details {
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .data-details h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
        }

        .detail-item .label {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
        }

        .detail-item .value {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }

        .items-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .item-badge {
          padding: 4px 8px;
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border: 1px solid #93c5fd;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #1e40af;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: linear-gradient(135deg, #f9fafb, #f3f4f6);
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          margin-top: 32px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
        }

        .empty-state p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default DataImportPage;

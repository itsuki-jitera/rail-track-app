/**
 * ファイル形式変換コンポーネント
 * File Format Converter Component
 *
 * サポートされている変換:
 * - DCP → RSQ (全項目一括データから項目別データへ)
 * - CSV → LABOCS (Oracle形式からLABOCS形式へ)
 * - LABOCS → CSV (LABOCS形式からCSV形式へ)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

type ConversionType = 'DCP_TO_RSQ' | 'CSV_TO_LABOCS' | 'LABOCS_TO_CSV' | null;

interface ConversionInfo {
  type: string;
  name: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  endpoint: string;
  supportedItems?: string[];
  supportedTableTypes?: string[];
}

interface DCPItem {
  key: string;
  code: string;
  name: string;
}

interface LABOCSTable {
  type: string;
  name: string;
  fields: Array<{ name: string; type: string; length: number }>;
}

const API_BASE_URL = 'http://localhost:5000/api/conversion';

export const FileConverter: React.FC = () => {
  const [conversionType, setConversionType] = useState<ConversionType>(null);
  const [dcpItems, setDcpItems] = useState<DCPItem[]>([]);
  const [labocsTables, setLabocsTables] = useState<LABOCSTable[]>([]);

  // DCP → RSQ 設定
  const [dcpFile, setDcpFile] = useState<File | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // CSV → LABOCS 設定
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedTableType, setSelectedTableType] = useState<string>('');
  const [lineCode, setLineCode] = useState<string>('TK');
  const [direction, setDirection] = useState<string>('D');

  // LABOCS → CSV 設定
  const [ddbFile, setDdbFile] = useState<File | null>(null);
  const [tblFile, setTblFile] = useState<File | null>(null);

  // 変換状態
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 初期化: サポートされている変換タイプを取得
  useEffect(() => {
    // fetchSupportedConversions();
    fetchDCPItems();
    fetchLABOCSTables();
  }, []);

  // const fetchSupportedConversions = async () => {
  //   try {
  //     const response = await axios.get(`${API_BASE_URL}/supported`);
  //     if (response.data.success) {
  //       setSupportedConversions(response.data.conversions);
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch supported conversions:', error);
  //   }
  // };

  const fetchDCPItems = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dcp-items`);
      if (response.data.success) {
        setDcpItems(response.data.items);
        // デフォルトで全項目を選択
        setSelectedItems(response.data.items.map((item: DCPItem) => item.key));
      }
    } catch (error) {
      console.error('Failed to fetch DCP items:', error);
    }
  };

  const fetchLABOCSTables = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/labocs-tables`);
      if (response.data.success) {
        setLabocsTables(response.data.tables);
      }
    } catch (error) {
      console.error('Failed to fetch LABOCS tables:', error);
    }
  };

  // 変換実行
  const handleConvert = async () => {
    if (!conversionType) {
      setError('変換タイプを選択してください');
      return;
    }

    setIsConverting(true);
    setError(null);
    setConversionResult(null);

    try {
      if (conversionType === 'DCP_TO_RSQ') {
        await convertDCPToRSQ();
      } else if (conversionType === 'CSV_TO_LABOCS') {
        await convertCSVToLABOCS();
      } else if (conversionType === 'LABOCS_TO_CSV') {
        await convertLABOCSToCSV();
      }
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || '変換に失敗しました');
    } finally {
      setIsConverting(false);
    }
  };

  // DCP → RSQ 変換
  const convertDCPToRSQ = async () => {
    if (!dcpFile) {
      throw new Error('DCPファイルを選択してください');
    }

    const formData = new FormData();
    formData.append('file', dcpFile);
    formData.append('items', JSON.stringify(selectedItems));

    const response = await axios.post(`${API_BASE_URL}/dcp-to-rsq`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (response.data.success) {
      setConversionResult(response.data);
    }
  };

  // CSV → LABOCS 変換
  const convertCSVToLABOCS = async () => {
    if (!csvFile) {
      throw new Error('CSVファイルを選択してください');
    }

    if (!selectedTableType) {
      throw new Error('テーブル種別を選択してください');
    }

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('tableType', selectedTableType);
    formData.append('lineCode', lineCode);
    formData.append('direction', direction);

    const response = await axios.post(`${API_BASE_URL}/csv-to-labocs`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (response.data.success) {
      setConversionResult(response.data);
    }
  };

  // LABOCS → CSV 変換
  const convertLABOCSToCSV = async () => {
    if (!ddbFile || !tblFile) {
      throw new Error('DDBとTBLファイルの両方を選択してください');
    }

    const formData = new FormData();
    formData.append('ddb', ddbFile);
    formData.append('tbl', tblFile);

    const response = await axios.post(`${API_BASE_URL}/labocs-to-csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (response.data.success) {
      setConversionResult(response.data);
    }
  };

  // ファイルダウンロード
  const handleDownload = (fileName: string, base64Data: string) => {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 全ファイルダウンロード (DCP → RSQ用)
  const handleDownloadAll = () => {
    if (conversionResult && conversionResult.files) {
      for (const file of conversionResult.files) {
        handleDownload(file.fileName, file.data);
      }
    } else if (conversionResult && conversionResult.ddbFile && conversionResult.tblFile) {
      handleDownload(conversionResult.ddbFile.fileName, conversionResult.ddbFile.data);
      handleDownload(conversionResult.tblFile.fileName, conversionResult.tblFile.data);
    } else if (conversionResult && conversionResult.csvFile) {
      handleDownload(conversionResult.csvFile.fileName, conversionResult.csvFile.data);
    }
  };

  // リセット
  const handleReset = () => {
    setConversionType(null);
    setDcpFile(null);
    setCsvFile(null);
    setDdbFile(null);
    setTblFile(null);
    setConversionResult(null);
    setError(null);
    setSelectedItems(dcpItems.map(item => item.key));
    setSelectedTableType('');
    setLineCode('TK');
    setDirection('D');
  };

  // 項目選択トグル
  const toggleItemSelection = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    );
  };

  return (
    <div className="file-converter">
      <div className="converter-header">
        <h2>ファイル形式変換</h2>
        <p className="header-description">
          異なるファイル形式間での変換を行います
        </p>
      </div>

      {/* 変換タイプ選択 */}
      {!conversionType && (
        <div className="conversion-type-selector">
          <h3>変換タイプを選択</h3>
          <div className="conversion-cards">
            <div
              className="conversion-card"
              onClick={() => setConversionType('DCP_TO_RSQ')}
            >
              <div className="card-icon">🔄</div>
              <div className="card-title">DCP → RSQ</div>
              <div className="card-description">
                全項目一括データから項目別データへ変換
              </div>
              <div className="card-formats">
                <span className="format-badge">DCP (1 file)</span>
                <span className="arrow">→</span>
                <span className="format-badge">RSQ (12 files)</span>
              </div>
            </div>

            <div
              className="conversion-card"
              onClick={() => setConversionType('CSV_TO_LABOCS')}
            >
              <div className="card-icon">📊</div>
              <div className="card-title">CSV → LABOCS</div>
              <div className="card-description">
                Oracle形式CSVからLABOCS表形式へ変換
              </div>
              <div className="card-formats">
                <span className="format-badge">CSV (1 file)</span>
                <span className="arrow">→</span>
                <span className="format-badge">TBL + DDB (2 files)</span>
              </div>
            </div>

            <div
              className="conversion-card"
              onClick={() => setConversionType('LABOCS_TO_CSV')}
            >
              <div className="card-icon">📋</div>
              <div className="card-title">LABOCS → CSV</div>
              <div className="card-description">
                LABOCS表形式からCSVへ変換
              </div>
              <div className="card-formats">
                <span className="format-badge">TBL + DDB (2 files)</span>
                <span className="arrow">→</span>
                <span className="format-badge">CSV (1 file)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DCP → RSQ 変換フォーム */}
      {conversionType === 'DCP_TO_RSQ' && (
        <div className="conversion-form">
          <div className="form-header">
            <h3>🔄 DCP → RSQ 変換</h3>
            <button className="back-btn" onClick={handleReset}>
              ← 戻る
            </button>
          </div>

          <div className="form-section">
            <label className="form-label">DCPファイル選択</label>
            <input
              type="file"
              accept=".dcp"
              onChange={(e) => setDcpFile(e.target.files?.[0] || null)}
              className="file-input"
            />
            {dcpFile && (
              <div className="file-info">
                ✓ {dcpFile.name} ({(dcpFile.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>

          <div className="form-section">
            <label className="form-label">抽出する項目を選択</label>
            <div className="items-grid">
              {dcpItems.map((item) => (
                <div
                  key={item.key}
                  className={`item-checkbox ${selectedItems.includes(item.key) ? 'checked' : ''}`}
                  onClick={() => toggleItemSelection(item.key)}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.key)}
                    onChange={() => toggleItemSelection(item.key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="item-info">
                    <span className="item-code">{item.code}</span>
                    <span className="item-name">{item.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="convert-btn"
            onClick={handleConvert}
            disabled={!dcpFile || selectedItems.length === 0 || isConverting}
          >
            {isConverting ? '変換中...' : '変換実行'}
          </button>
        </div>
      )}

      {/* CSV → LABOCS 変換フォーム */}
      {conversionType === 'CSV_TO_LABOCS' && (
        <div className="conversion-form">
          <div className="form-header">
            <h3>📊 CSV → LABOCS 変換</h3>
            <button className="back-btn" onClick={handleReset}>
              ← 戻る
            </button>
          </div>

          <div className="form-section">
            <label className="form-label">CSVファイル選択</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="file-input"
            />
            {csvFile && (
              <div className="file-info">
                ✓ {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>

          <div className="form-section">
            <label className="form-label">テーブル種別</label>
            <select
              value={selectedTableType}
              onChange={(e) => setSelectedTableType(e.target.value)}
              className="select-input"
            >
              <option value="">選択してください</option>
              {labocsTables.map((table) => (
                <option key={table.type} value={table.type}>
                  {table.type} - {table.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-section">
              <label className="form-label">路線コード</label>
              <input
                type="text"
                value={lineCode}
                onChange={(e) => setLineCode(e.target.value)}
                placeholder="TK"
                maxLength={2}
                className="text-input"
              />
            </div>

            <div className="form-section">
              <label className="form-label">上下区分</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="select-input"
              >
                <option value="D">下り (D)</option>
                <option value="R">上り (R)</option>
              </select>
            </div>
          </div>

          <button
            className="convert-btn"
            onClick={handleConvert}
            disabled={!csvFile || !selectedTableType || isConverting}
          >
            {isConverting ? '変換中...' : '変換実行'}
          </button>
        </div>
      )}

      {/* LABOCS → CSV 変換フォーム */}
      {conversionType === 'LABOCS_TO_CSV' && (
        <div className="conversion-form">
          <div className="form-header">
            <h3>📋 LABOCS → CSV 変換</h3>
            <button className="back-btn" onClick={handleReset}>
              ← 戻る
            </button>
          </div>

          <div className="form-section">
            <label className="form-label">DDBファイル選択</label>
            <input
              type="file"
              accept=".ddb"
              onChange={(e) => setDdbFile(e.target.files?.[0] || null)}
              className="file-input"
            />
            {ddbFile && (
              <div className="file-info">
                ✓ {ddbFile.name} ({(ddbFile.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>

          <div className="form-section">
            <label className="form-label">TBLファイル選択</label>
            <input
              type="file"
              accept=".tbl"
              onChange={(e) => setTblFile(e.target.files?.[0] || null)}
              className="file-input"
            />
            {tblFile && (
              <div className="file-info">
                ✓ {tblFile.name} ({(tblFile.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>

          <button
            className="convert-btn"
            onClick={handleConvert}
            disabled={!ddbFile || !tblFile || isConverting}
          >
            {isConverting ? '変換中...' : '変換実行'}
          </button>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error}</div>
        </div>
      )}

      {/* 変換結果 */}
      {conversionResult && (
        <div className="conversion-result">
          <div className="result-header">
            <div className="result-icon">✅</div>
            <h3>変換完了</h3>
          </div>

          <div className="result-info">
            <div className="info-item">
              <span className="info-label">変換タイプ:</span>
              <span className="info-value">{conversionResult.conversion}</span>
            </div>
            <div className="info-item">
              <span className="info-label">元ファイル:</span>
              <span className="info-value">
                {conversionResult.sourceFile ||
                  `${conversionResult.sourceFiles?.ddb}, ${conversionResult.sourceFiles?.tbl}`}
              </span>
            </div>
            {conversionResult.message && (
              <div className="info-item">
                <span className="info-label">メッセージ:</span>
                <span className="info-value">{conversionResult.message}</span>
              </div>
            )}
          </div>

          {/* ファイルリスト */}
          <div className="files-list">
            <h4>生成されたファイル</h4>

            {conversionResult.files && (
              <div className="files-grid">
                {conversionResult.files.map((file: any, index: number) => (
                  <div key={index} className="file-card">
                    <div className="file-card-icon">📄</div>
                    <div className="file-card-name">{file.fileName}</div>
                    <div className="file-card-size">
                      {(file.size / 1024).toFixed(2)} KB
                    </div>
                    <button
                      className="download-btn-small"
                      onClick={() => handleDownload(file.fileName, file.data)}
                    >
                      ダウンロード
                    </button>
                  </div>
                ))}
              </div>
            )}

            {conversionResult.ddbFile && conversionResult.tblFile && (
              <div className="files-grid">
                <div className="file-card">
                  <div className="file-card-icon">📄</div>
                  <div className="file-card-name">{conversionResult.ddbFile.fileName}</div>
                  <div className="file-card-size">
                    {(conversionResult.ddbFile.size / 1024).toFixed(2)} KB
                  </div>
                  <button
                    className="download-btn-small"
                    onClick={() => handleDownload(conversionResult.ddbFile.fileName, conversionResult.ddbFile.data)}
                  >
                    ダウンロード
                  </button>
                </div>
                <div className="file-card">
                  <div className="file-card-icon">📄</div>
                  <div className="file-card-name">{conversionResult.tblFile.fileName}</div>
                  <div className="file-card-size">
                    {(conversionResult.tblFile.size / 1024).toFixed(2)} KB
                  </div>
                  <button
                    className="download-btn-small"
                    onClick={() => handleDownload(conversionResult.tblFile.fileName, conversionResult.tblFile.data)}
                  >
                    ダウンロード
                  </button>
                </div>
              </div>
            )}

            {conversionResult.csvFile && (
              <div className="files-grid">
                <div className="file-card">
                  <div className="file-card-icon">📄</div>
                  <div className="file-card-name">{conversionResult.csvFile.fileName}</div>
                  <div className="file-card-size">
                    {(conversionResult.csvFile.size / 1024).toFixed(2)} KB
                  </div>
                  <button
                    className="download-btn-small"
                    onClick={() => handleDownload(conversionResult.csvFile.fileName, conversionResult.csvFile.data)}
                  >
                    ダウンロード
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="result-actions">
            <button className="download-all-btn" onClick={handleDownloadAll}>
              📥 すべてダウンロード
            </button>
            <button className="reset-btn" onClick={handleReset}>
              🔄 新しい変換を開始
            </button>
          </div>
        </div>
      )}

      <style>{`
        .file-converter {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        .converter-header {
          margin-bottom: 32px;
        }

        .converter-header h2 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
        }

        .header-description {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .conversion-type-selector h3 {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
        }

        .conversion-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .conversion-card {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
        }

        .conversion-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
          transform: translateY(-4px);
        }

        .card-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .card-description {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 16px;
        }

        .card-formats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .format-badge {
          padding: 4px 12px;
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border: 1px solid #93c5fd;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          color: #1e40af;
        }

        .arrow {
          font-size: 18px;
          color: #3b82f6;
          font-weight: 700;
        }

        .conversion-form {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
        }

        .form-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .form-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
        }

        .back-btn {
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: #e5e7eb;
        }

        .form-section {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #374151;
        }

        .file-input,
        .text-input,
        .select-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .file-input:focus,
        .text-input:focus,
        .select-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .file-info {
          margin-top: 8px;
          padding: 8px 12px;
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          border: 1px solid #6ee7b7;
          border-radius: 6px;
          font-size: 14px;
          color: #065f46;
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
        }

        .item-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .item-checkbox:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .item-checkbox.checked {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border-color: #3b82f6;
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-code {
          font-size: 12px;
          font-weight: 700;
          color: #3b82f6;
        }

        .item-name {
          font-size: 14px;
          color: #1f2937;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .convert-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
        }

        .convert-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          transform: translateY(-2px);
        }

        .convert-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          border: 2px solid #f87171;
          border-radius: 8px;
          margin-top: 20px;
        }

        .error-icon {
          font-size: 24px;
        }

        .error-text {
          font-size: 14px;
          font-weight: 600;
          color: #991b1b;
        }

        .conversion-result {
          background: white;
          border: 2px solid #10b981;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .result-icon {
          font-size: 32px;
        }

        .result-header h3 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          color: #1f2937;
        }

        .result-info {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .info-item {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .info-item:last-child {
          margin-bottom: 0;
        }

        .info-label {
          font-weight: 700;
          color: #6b7280;
        }

        .info-value {
          color: #1f2937;
        }

        .files-list h4 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
        }

        .files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .file-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .file-card-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .file-card-name {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
          word-break: break-all;
        }

        .file-card-size {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 12px;
        }

        .download-btn-small {
          width: 100%;
          padding: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .download-btn-small:hover {
          background: linear-gradient(135deg, #059669, #047857);
        }

        .result-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .download-all-btn,
        .reset-btn {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
        }

        .download-all-btn {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }

        .download-all-btn:hover {
          background: linear-gradient(135deg, #059669, #047857);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          transform: translateY(-2px);
        }

        .reset-btn {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        .reset-btn:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default FileConverter;

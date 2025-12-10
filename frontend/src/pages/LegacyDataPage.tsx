/**
 * 旧ラボデータ専用ページ
 * MDT + O010*.csv形式の旧データをアップロード・表示
 */

import React, { useState } from 'react';
import axios from 'axios';
import {
  MultiMeasurementData,
  MeasurementType,
  MDTData,
  O010Data,
  LegacyDataUploadResult,
  RestorationWaveformResult,
  DataPoint
} from '../types';
import MeasurementTypeSelector, { MEASUREMENT_METADATA } from '../components/MeasurementTypeSelector';
import MultiMeasurementChart from '../components/MultiMeasurementChart';
import MultiMeasurementStatistics from '../components/MultiMeasurementStatistics';
import DraggableRestorationChart from '../components/DraggableRestorationChart';

const API_BASE_URL = 'http://localhost:5000/api';

const LegacyDataPage: React.FC = () => {
  const [mdtFile, setMdtFile] = useState<File | null>(null);
  const [o010File, setO010File] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // アップロード結果
  const [mdtData, setMdtData] = useState<MDTData | null>(null);
  const [o010Data, setO010Data] = useState<O010Data | null>(null);
  const [multiMeasurementData, setMultiMeasurementData] = useState<MultiMeasurementData[]>([]);

  // 測定項目選択状態
  const [availableMeasurements, setAvailableMeasurements] = useState<MeasurementType[]>([]);
  const [selectedMeasurements, setSelectedMeasurements] = useState<MeasurementType[]>([]);

  // 復元波形計算状態
  const [restorationResult, setRestorationResult] = useState<RestorationWaveformResult | null>(null);
  const [calculatingRestoration, setCalculatingRestoration] = useState(false);
  const [selectedMeasurementForRestoration, setSelectedMeasurementForRestoration] = useState<MeasurementType | null>(null);

  const handleMdtFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMdtFile(file);
      setError(null);
    }
  };

  const handleO010FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setO010File(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!mdtFile && !o010File) {
      setError('MDTファイルまたはO010ファイルを選択してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (mdtFile) formData.append('mdt', mdtFile);
      if (o010File) formData.append('o010', o010File);

      // レガシーデータ専用エンドポイントを使用
      const response = await axios.post<LegacyDataUploadResult>(
        `${API_BASE_URL}/legacy-data/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        // MDTデータ
        if (response.data.mdtData) {
          setMdtData(response.data.mdtData);
        }

        // O010データ
        if (response.data.o010Data) {
          setO010Data(response.data.o010Data);
        }

        // 複数測定項目データ
        if (response.data.multiMeasurementData && response.data.multiMeasurementData.length > 0) {
          setMultiMeasurementData(response.data.multiMeasurementData);

          // 利用可能な測定項目を抽出
          const firstData = response.data.multiMeasurementData[0];
          const available = Object.keys(firstData.measurements).filter(
            key => firstData.measurements[key as MeasurementType] !== undefined
          ) as MeasurementType[];

          setAvailableMeasurements(available);

          // 初期選択（最初の3項目）
          setSelectedMeasurements(available.slice(0, Math.min(3, available.length)));
        }
      } else {
        setError(response.data.error || 'アップロードに失敗しました');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'アップロード中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMdtFile(null);
    setO010File(null);
    setMdtData(null);
    setO010Data(null);
    setMultiMeasurementData([]);
    setAvailableMeasurements([]);
    setSelectedMeasurements([]);
    setRestorationResult(null);
    setSelectedMeasurementForRestoration(null);
    setError(null);
  };

  const handleCalculateRestoration = async (measurementType: MeasurementType) => {
    if (multiMeasurementData.length === 0) {
      setError('測定データがありません');
      return;
    }

    setCalculatingRestoration(true);
    setError(null);
    setSelectedMeasurementForRestoration(measurementType);

    try {
      // 測定データを { distance, value } 形式に変換
      const measurementData: DataPoint[] = multiMeasurementData
        .map(d => ({
          distance: d.distance,
          value: d.measurements[measurementType]
        }))
        .filter((d): d is DataPoint => d.value !== undefined && d.value !== null);

      if (measurementData.length === 0) {
        setError('選択された測定項目のデータがありません');
        setCalculatingRestoration(false);
        return;
      }

      console.log(`復元波形計算開始: ${measurementType}, ${measurementData.length}点`);

      const response = await axios.post<RestorationWaveformResult>(
        `${API_BASE_URL}/restoration/calculate`,
        {
          measurementData,
          options: {
            minWavelength: 6.0,
            maxWavelength: 40.0,
            samplingInterval: 0.25
          }
        }
      );

      if (response.data.success) {
        setRestorationResult(response.data);
        console.log('復元波形計算完了');
      } else {
        setError(response.data.error || '復元波形計算に失敗しました');
      }
    } catch (err: any) {
      console.error('Restoration calculation error:', err);
      setError(err.response?.data?.error || '復元波形計算中にエラーが発生しました');
    } finally {
      setCalculatingRestoration(false);
    }
  };

  return (
    <div className="legacy-data-page">
      <div className="page-header">
        <h1>旧ラボデータ解析</h1>
        <p>MDTファイルとO010*.csvファイルをアップロードして、測定データを解析・可視化します</p>
      </div>

      {/* アップロードセクション */}
      <div className="upload-section">
        <h2>ファイルアップロード</h2>

        <div className="file-inputs">
          <div className="file-input-group">
            <label htmlFor="mdt-file">
              <strong>MDTファイル</strong>
              <span className="file-description">（測定ヘッダー情報）</span>
            </label>
            <input
              id="mdt-file"
              type="file"
              accept=".MDT,.mdt"
              onChange={handleMdtFileChange}
              disabled={loading}
            />
            {mdtFile && <div className="file-name">選択: {mdtFile.name}</div>}
          </div>

          <div className="file-input-group">
            <label htmlFor="o010-file">
              <strong>O010*.csvファイル</strong>
              <span className="file-description">（測定データ）</span>
            </label>
            <input
              id="o010-file"
              type="file"
              accept=".csv,.CSV"
              onChange={handleO010FileChange}
              disabled={loading}
            />
            {o010File && <div className="file-name">選択: {o010File.name}</div>}
          </div>
        </div>

        <div className="upload-actions">
          <button
            onClick={handleUpload}
            disabled={loading || (!mdtFile && !o010File)}
            className="btn-primary"
          >
            {loading ? 'アップロード中...' : 'アップロード'}
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="btn-secondary"
          >
            クリア
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      {/* MDT情報表示 */}
      {mdtData && (
        <div className="mdt-info-section">
          <h2>MDT情報</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">ファイルID:</span>
              <span className="info-value">{mdtData.fileId}</span>
            </div>
            <div className="info-item">
              <span className="info-label">路線名:</span>
              <span className="info-value">{mdtData.lineName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">上下区分:</span>
              <span className="info-value">{mdtData.direction}</span>
            </div>
            <div className="info-item">
              <span className="info-label">測定日:</span>
              <span className="info-value">{mdtData.measurementDate}</span>
            </div>
            <div className="info-item">
              <span className="info-label">キロ程範囲:</span>
              <span className="info-value">
                {mdtData.startKilometer.toFixed(3)}km - {mdtData.endKilometer?.toFixed(3) || 'N/A'}km
              </span>
            </div>
          </div>
        </div>
      )}

      {/* O010データ情報 */}
      {o010Data && (
        <div className="o010-info-section">
          <h2>O010データ情報</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">測定日:</span>
              <span className="info-value">{o010Data.header.measurementDate || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">コース:</span>
              <span className="info-value">{o010Data.header.course || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">総レコード数:</span>
              <span className="info-value">{o010Data.totalRecords}</span>
            </div>
          </div>
        </div>
      )}

      {/* 測定データ表示 */}
      {multiMeasurementData.length > 0 && (
        <>
          <MeasurementTypeSelector
            availableMeasurements={availableMeasurements}
            selectedMeasurements={selectedMeasurements}
            onSelectionChange={setSelectedMeasurements}
          />

          <MultiMeasurementChart
            data={multiMeasurementData}
            selectedMeasurements={selectedMeasurements}
            title={`測定データ - ${mdtData?.lineName || ''} ${mdtData?.direction || ''}`}
          />

          <MultiMeasurementStatistics
            data={multiMeasurementData}
            selectedMeasurements={selectedMeasurements}
          />

          {/* 復元波形計算セクション */}
          <div className="restoration-section">
            <h2>復元波形計算</h2>
            <p className="restoration-description">
              選択した測定項目に対して復元波形（6m-40m波長成分）を計算し、計画線と移動量を算出します
            </p>

            <div className="restoration-controls">
              <label htmlFor="measurement-select">計算対象の測定項目:</label>
              <select
                id="measurement-select"
                className="measurement-select"
                value={selectedMeasurementForRestoration || ''}
                onChange={(e) => setSelectedMeasurementForRestoration(e.target.value as MeasurementType)}
                disabled={availableMeasurements.length === 0 || calculatingRestoration}
              >
                <option value="">-- 測定項目を選択 --</option>
                {availableMeasurements.map(m => {
                  const metadata = MEASUREMENT_METADATA[m];
                  return (
                    <option key={m} value={m}>
                      {metadata?.label || m}
                    </option>
                  );
                })}
              </select>

              <button
                onClick={() => selectedMeasurementForRestoration && handleCalculateRestoration(selectedMeasurementForRestoration)}
                disabled={!selectedMeasurementForRestoration || calculatingRestoration}
                className="btn-calculate"
              >
                {calculatingRestoration ? '計算中...' : '🔄 復元波形を計算'}
              </button>
            </div>
          </div>

          {/* 復元波形計算結果表示 */}
          {restorationResult && selectedMeasurementForRestoration && (
            <div className="restoration-result-section">
              <DraggableRestorationChart
                originalData={multiMeasurementData.map(d => ({
                  distance: d.distance,
                  value: d.measurements[selectedMeasurementForRestoration] || 0
                }))}
                result={restorationResult}
                measurementLabel={
                  MEASUREMENT_METADATA[selectedMeasurementForRestoration]?.label ||
                  selectedMeasurementForRestoration
                }
                onPlanLineUpdate={(updatedPlanLine) => {
                  console.log('計画線が更新されました:', updatedPlanLine);
                }}
                onSave={(updatedPlanLine) => {
                  console.log('計画線を保存:', updatedPlanLine);
                  // TODO: APIを呼び出して保存処理を実装
                }}
              />
            </div>
          )}
        </>
      )}

      <style>{`
        .legacy-data-page {
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

        .page-header p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .upload-section, .mdt-info-section, .o010-info-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .upload-section h2, .mdt-info-section h2, .o010-info-section h2 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .file-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .file-input-group {
          display: flex;
          flex-direction: column;
        }

        .file-input-group label {
          margin-bottom: 8px;
          font-size: 14px;
          color: #374151;
        }

        .file-input-group label strong {
          display: block;
          margin-bottom: 4px;
        }

        .file-description {
          font-size: 12px;
          color: #6b7280;
          font-weight: normal;
        }

        .file-input-group input[type="file"] {
          padding: 8px;
          border: 2px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .file-input-group input[type="file"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .file-name {
          margin-top: 8px;
          font-size: 12px;
          color: #059669;
          font-weight: 500;
        }

        .upload-actions {
          display: flex;
          gap: 12px;
        }

        .btn-primary, .btn-secondary {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-message {
          margin-top: 16px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 14px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .info-value {
          font-size: 14px;
          color: #1f2937;
          font-weight: 600;
        }

        .restoration-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .restoration-section h2 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .restoration-description {
          margin: 0 0 20px 0;
          color: #6b7280;
          font-size: 14px;
        }

        .restoration-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .restoration-controls label {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }

        .measurement-select {
          flex: 1;
          max-width: 300px;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .measurement-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-calculate {
          padding: 10px 24px;
          background: #8b5cf6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-calculate:hover:not(:disabled) {
          background: #7c3aed;
        }

        .btn-calculate:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .restoration-result-section {
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
};

export default LegacyDataPage;

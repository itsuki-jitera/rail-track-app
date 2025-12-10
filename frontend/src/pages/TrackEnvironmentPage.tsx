/**
 * 軌道環境データ管理ページ
 * Track Environment Data Management Page
 *
 * LABOCS形式の軌道環境データ(.TBL/.DDB)を管理
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TrackEnvironmentPage.css';

const API_BASE_URL = 'http://localhost:5000/api';

// interface FileInfo {
//   dataType: string;
//   dataTypeName: string;
//   recordCount: number;
// }

interface Dataset {
  id: string;
  status: 'initialized' | 'processing' | 'completed' | 'failed';
  config: any;
  files: Record<string, string>;
  data: {
    stations: any[];
    gradients: any[];
    curves: any[];
    structures: any[];
    joints: any[];
    ballasts: any[];
    turnouts: any[];
    ejs: any[];
    ijs: any[];
    other?: Record<string, any[]>;
  };
  metadata: {
    lineName: string | null;
    lineType: string | null;
    section: string | null;
    updateYear: number | null;
    updateMonth: number | null;
  };
  missingTypes?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  datasetId: string;
  totalFiles: number;
  dataCounts: {
    stations: number;
    gradients: number;
    curves: number;
    structures: number;
    joints: number;
    ballasts: number;
    turnouts: number;
    ejs: number;
    ijs: number;
  };
  status: string;
  missingTypes: string[];
  coverage: {
    percentage: number;
    loaded: number;
    total: number;
  };
  kilometrage?: {
    min: number;
    max: number;
    length: number;
  };
}

interface RangeSearchResult {
  stations: any[];
  gradients: any[];
  curves: any[];
  structures: any[];
  joints: any[];
  ballasts: any[];
  turnouts: any[];
  ejs: any[];
  ijs: any[];
}

const TrackEnvironmentPage: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'search' | 'export'>('overview');

  // データ検索
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [searchResult, setSearchResult] = useState<RangeSearchResult | null>(null);

  // データタイプ定義
  const DATA_TYPES = [
    { code: 'EM', name: '駅名データ', key: 'stations' },
    { code: 'JS', name: 'こう配データ（縦断線形）', key: 'gradients', required: true },
    { code: 'HS', name: '曲線データ（平面線形）', key: 'curves', required: true },
    { code: 'KR', name: '構造物・路盤データ', key: 'structures', required: true },
    { code: 'RT', name: 'レール継目データ（左）', key: 'joints', required: true },
    { code: 'RU', name: 'レール継目データ（右）', key: 'joints', required: true },
    { code: 'DS', name: '道床データ', key: 'ballasts', required: true },
    { code: 'BK', name: '分岐器データ', key: 'turnouts', required: true },
    { code: 'EJ', name: 'EJデータ', key: 'ejs', required: true },
    { code: 'IJ', name: 'IJデータ', key: 'ijs', required: true }
  ];

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    if (selectedDataset) {
      loadStatistics(selectedDataset.id);
    }
  }, [selectedDataset]);

  const loadDatasets = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/track-env/datasets`);
      if (response.data.success) {
        setDatasets(response.data.datasets);
        if (response.data.datasets.length > 0 && !selectedDataset) {
          setSelectedDataset(response.data.datasets[0]);
        }
      }
    } catch (error) {
      console.error('データセット一覧取得エラー:', error);
    }
  };

  const loadStatistics = async (datasetId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/track-env/dataset/${datasetId}/statistics`);
      if (response.data.success) {
        setStatistics(response.data.statistics);
      }
    } catch (error) {
      console.error('統計情報取得エラー:', error);
    }
  };

  const createNewDataset = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/track-env/dataset`, {
        config: {
          source: 'manual_upload',
          createdAt: new Date().toISOString()
        }
      });

      if (response.data.success) {
        const newDataset = response.data.dataset;
        setDatasets(prev => [newDataset, ...prev]);
        setSelectedDataset(newDataset);
        alert('新しいデータセットを作成しました');
      }
    } catch (error: any) {
      console.error('データセット作成エラー:', error);
      alert(`エラー: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedDataset) {
      alert('データセットを選択してください');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('datasetId', selectedDataset.id);

    const uploadKey = `${selectedDataset.id}_${file.name}`;
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      const response = await axios.post(
        `${API_BASE_URL}/track-env/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentage = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(prev => ({ ...prev, [uploadKey]: percentage }));
          }
        }
      );

      if (response.data.success) {
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[uploadKey];
          return updated;
        });

        if (response.data.skipped) {
          alert(response.data.message);
        } else {
          alert(`${response.data.message}\n${response.data.file.recordCount}件のレコードを読み込みました`);

          // データセットを再取得
          const updatedResponse = await axios.get(`${API_BASE_URL}/track-env/dataset/${selectedDataset.id}`);
          if (updatedResponse.data.success) {
            setSelectedDataset(updatedResponse.data.dataset);
            loadDatasets();
          }
        }
      }
    } catch (error: any) {
      console.error('ファイルアップロードエラー:', error);
      alert(`エラー: ${error.response?.data?.error || error.message}`);
      setUploadProgress(prev => {
        const updated = { ...prev };
        delete updated[uploadKey];
        return updated;
      });
    }
  };

  const handleBatchUpload = async (files: FileList) => {
    if (files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    if (selectedDataset) {
      formData.append('datasetId', selectedDataset.id);
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/track-env/upload/batch`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      if (response.data.success) {
        const successCount = response.data.results.filter((r: any) => r.success && !r.skipped).length;
        const skippedCount = response.data.results.filter((r: any) => r.skipped).length;
        const failCount = response.data.results.filter((r: any) => !r.success).length;

        alert(
          `バッチアップロード完了\n` +
          `成功: ${successCount}件\n` +
          `スキップ: ${skippedCount}件\n` +
          `失敗: ${failCount}件`
        );

        // データセットIDを更新
        if (!selectedDataset) {
          const updatedResponse = await axios.get(`${API_BASE_URL}/track-env/dataset/${response.data.datasetId}`);
          if (updatedResponse.data.success) {
            setSelectedDataset(updatedResponse.data.dataset);
          }
        }

        loadDatasets();
      }
    } catch (error: any) {
      console.error('バッチアップロードエラー:', error);
      alert(`エラー: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeSearch = async () => {
    if (!selectedDataset) {
      alert('データセットを選択してください');
      return;
    }

    if (!startKm || !endKm) {
      alert('開始キロ程と終了キロ程を入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/track-env/dataset/${selectedDataset.id}/range`,
        {
          params: { startKm, endKm }
        }
      );

      if (response.data.success) {
        setSearchResult(response.data.data);
      }
    } catch (error: any) {
      console.error('範囲検索エラー:', error);
      alert(`エラー: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!selectedDataset) {
      alert('データセットを選択してください');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/track-env/dataset/${selectedDataset.id}/export`,
        {
          params: { format }
        }
      );

      if (format === 'csv') {
        // CSV直接ダウンロード
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `track_env_${selectedDataset.id}.csv`;
        link.click();
      } else {
        // JSON形式
        const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
          type: 'application/json'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `track_env_${selectedDataset.id}.json`;
        link.click();
      }

      alert(`${format.toUpperCase()}形式でエクスポートしました`);
    } catch (error: any) {
      console.error('エクスポートエラー:', error);
      alert(`エラー: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('このデータセットを削除してもよろしいですか？')) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.delete(`${API_BASE_URL}/track-env/dataset/${datasetId}`);

      if (response.data.success) {
        alert('データセットを削除しました');

        if (selectedDataset?.id === datasetId) {
          setSelectedDataset(null);
          setStatistics(null);
        }

        loadDatasets();
      }
    } catch (error: any) {
      console.error('データセット削除エラー:', error);
      alert(`エラー: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      initialized: { label: '初期化済み', className: 'status-badge initialized' },
      processing: { label: '処理中', className: 'status-badge processing' },
      completed: { label: '完了', className: 'status-badge completed' },
      failed: { label: '失敗', className: 'status-badge failed' }
    };
    const badge = badges[status] || badges.initialized;
    return <span className={badge.className}>{badge.label}</span>;
  };

  const renderDataTable = (title: string, data: any[], maxRows: number = 10) => {
    if (!data || data.length === 0) {
      return (
        <div className="data-table-container">
          <h4>{title}</h4>
          <p className="no-data">データがありません</p>
        </div>
      );
    }

    const headers = Object.keys(data[0]);
    const displayData = data.slice(0, maxRows);

    return (
      <div className="data-table-container">
        <h4>{title} ({data.length}件)</h4>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {headers.map(header => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx}>
                  {headers.map(header => (
                    <td key={header}>{JSON.stringify(row[header])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > maxRows && (
            <p className="table-note">残り{data.length - maxRows}件のデータがあります</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="track-environment-page">
      <header className="page-header">
        <h1>軌道環境データ管理</h1>
        <p className="page-description">
          LABOCS形式の軌道環境データ(.TBL/.DDB)を管理します
        </p>
      </header>

      <div className="page-layout">
        {/* 左サイドバー: データセット一覧 */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>データセット一覧</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={createNewDataset}
              disabled={loading}
            >
              + 新規作成
            </button>
          </div>

          <div className="dataset-list">
            {datasets.map(dataset => (
              <div
                key={dataset.id}
                className={`dataset-card ${selectedDataset?.id === dataset.id ? 'selected' : ''}`}
                onClick={() => setSelectedDataset(dataset)}
              >
                <div className="dataset-header">
                  <span className="dataset-id">{dataset.id}</span>
                  {getStatusBadge(dataset.status)}
                </div>

                <div className="dataset-meta">
                  {dataset.metadata.lineName && (
                    <p>路線: {dataset.metadata.lineName}</p>
                  )}
                  <p>ファイル数: {Object.keys(dataset.files).length}</p>
                  <p className="dataset-date">
                    {new Date(dataset.createdAt).toLocaleString('ja-JP')}
                  </p>
                </div>

                {dataset.missingTypes && dataset.missingTypes.length > 0 && (
                  <div className="missing-types">
                    <small>未登録: {dataset.missingTypes.join(', ')}</small>
                  </div>
                )}

                <button
                  className="btn btn-danger btn-xs delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDataset(dataset.id);
                  }}
                  disabled={loading}
                >
                  削除
                </button>
              </div>
            ))}

            {datasets.length === 0 && (
              <p className="no-datasets">データセットがありません</p>
            )}
          </div>
        </aside>

        {/* メインコンテンツ */}
        <main className="main-content">
          {!selectedDataset ? (
            <div className="empty-state">
              <p>データセットを選択するか、新規作成してください</p>
            </div>
          ) : (
            <>
              {/* タブナビゲーション */}
              <div className="tab-navigation">
                <button
                  className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  概要
                </button>
                <button
                  className={`tab ${activeTab === 'data' ? 'active' : ''}`}
                  onClick={() => setActiveTab('data')}
                >
                  データ
                </button>
                <button
                  className={`tab ${activeTab === 'search' ? 'active' : ''}`}
                  onClick={() => setActiveTab('search')}
                >
                  範囲検索
                </button>
                <button
                  className={`tab ${activeTab === 'export' ? 'active' : ''}`}
                  onClick={() => setActiveTab('export')}
                >
                  エクスポート
                </button>
              </div>

              {/* 概要タブ */}
              {activeTab === 'overview' && (
                <div className="tab-content">
                  <section className="section">
                    <h2>データセット情報</h2>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>データセットID:</label>
                        <span>{selectedDataset.id}</span>
                      </div>
                      <div className="info-item">
                        <label>ステータス:</label>
                        {getStatusBadge(selectedDataset.status)}
                      </div>
                      <div className="info-item">
                        <label>路線名:</label>
                        <span>{selectedDataset.metadata.lineName || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>線別:</label>
                        <span>{selectedDataset.metadata.lineType || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>更新年月:</label>
                        <span>
                          {selectedDataset.metadata.updateYear && selectedDataset.metadata.updateMonth
                            ? `${selectedDataset.metadata.updateYear}年${selectedDataset.metadata.updateMonth}月`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="info-item">
                        <label>作成日時:</label>
                        <span>{new Date(selectedDataset.createdAt).toLocaleString('ja-JP')}</span>
                      </div>
                    </div>
                  </section>

                  {statistics && (
                    <section className="section">
                      <h2>統計情報</h2>
                      <div className="stats-grid">
                        <div className="stat-card">
                          <h3>ファイル数</h3>
                          <p className="stat-value">{statistics.totalFiles}</p>
                        </div>
                        <div className="stat-card">
                          <h3>カバレッジ</h3>
                          <p className="stat-value">{statistics.coverage.percentage}%</p>
                          <p className="stat-detail">
                            {statistics.coverage.loaded} / {statistics.coverage.total}
                          </p>
                        </div>
                        {statistics.kilometrage && (
                          <div className="stat-card">
                            <h3>キロ程範囲</h3>
                            <p className="stat-value">
                              {statistics.kilometrage.min.toFixed(3)} - {statistics.kilometrage.max.toFixed(3)}
                            </p>
                            <p className="stat-detail">
                              {statistics.kilometrage.length.toFixed(3)} km
                            </p>
                          </div>
                        )}
                      </div>

                      <h3>データ件数</h3>
                      <div className="data-counts">
                        {Object.entries(statistics.dataCounts).map(([key, count]) => (
                          <div key={key} className="count-item">
                            <label>{DATA_TYPES.find(t => t.key === key)?.name || key}:</label>
                            <span>{count}件</span>
                          </div>
                        ))}
                      </div>

                      {statistics.missingTypes.length > 0 && (
                        <div className="missing-alert">
                          <strong>未登録データ:</strong> {statistics.missingTypes.join(', ')}
                        </div>
                      )}
                    </section>
                  )}

                  <section className="section">
                    <h2>ファイルアップロード</h2>

                    <div className="upload-section">
                      <h3>単一ファイルアップロード</h3>
                      <input
                        type="file"
                        accept=".TBL,.DDB"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                        disabled={loading}
                      />
                      <p className="upload-note">
                        .TBL または .DDB ファイルを選択してください
                      </p>
                    </div>

                    <div className="upload-section">
                      <h3>バッチアップロード</h3>
                      <input
                        type="file"
                        accept=".TBL,.DDB"
                        multiple
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleBatchUpload(e.target.files);
                          }
                        }}
                        disabled={loading}
                      />
                      <p className="upload-note">
                        複数の .TBL/.DDB ファイルを一括アップロードできます
                      </p>
                    </div>

                    {Object.keys(uploadProgress).length > 0 && (
                      <div className="upload-progress">
                        <h3>アップロード進捗</h3>
                        {Object.entries(uploadProgress).map(([key, progress]) => (
                          <div key={key} className="progress-item">
                            <label>{key}</label>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span>{progress}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* データタブ */}
              {activeTab === 'data' && (
                <div className="tab-content">
                  <section className="section">
                    <h2>登録データ一覧</h2>
                    {renderDataTable('駅名データ (EM)', selectedDataset.data.stations)}
                    {renderDataTable('こう配データ (JS)', selectedDataset.data.gradients)}
                    {renderDataTable('曲線データ (HS)', selectedDataset.data.curves)}
                    {renderDataTable('構造物データ (KR)', selectedDataset.data.structures)}
                    {renderDataTable('レール継目 (RT/RU)', selectedDataset.data.joints)}
                    {renderDataTable('道床データ (DS)', selectedDataset.data.ballasts)}
                    {renderDataTable('分岐器データ (BK)', selectedDataset.data.turnouts)}
                    {renderDataTable('EJデータ', selectedDataset.data.ejs)}
                    {renderDataTable('IJデータ', selectedDataset.data.ijs)}
                  </section>
                </div>
              )}

              {/* 範囲検索タブ */}
              {activeTab === 'search' && (
                <div className="tab-content">
                  <section className="section">
                    <h2>キロ程範囲検索</h2>
                    <div className="search-form">
                      <div className="form-group">
                        <label>開始キロ程:</label>
                        <input
                          type="number"
                          step="0.001"
                          value={startKm}
                          onChange={(e) => setStartKm(e.target.value)}
                          placeholder="例: 0.000"
                        />
                      </div>
                      <div className="form-group">
                        <label>終了キロ程:</label>
                        <input
                          type="number"
                          step="0.001"
                          value={endKm}
                          onChange={(e) => setEndKm(e.target.value)}
                          placeholder="例: 10.000"
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleRangeSearch}
                        disabled={loading}
                      >
                        検索
                      </button>
                    </div>

                    {searchResult && (
                      <div className="search-results">
                        <h3>検索結果</h3>
                        {renderDataTable('駅名', searchResult.stations)}
                        {renderDataTable('こう配', searchResult.gradients)}
                        {renderDataTable('曲線', searchResult.curves)}
                        {renderDataTable('構造物', searchResult.structures)}
                        {renderDataTable('レール継目', searchResult.joints)}
                        {renderDataTable('道床', searchResult.ballasts)}
                        {renderDataTable('分岐器', searchResult.turnouts)}
                        {renderDataTable('EJ', searchResult.ejs)}
                        {renderDataTable('IJ', searchResult.ijs)}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* エクスポートタブ */}
              {activeTab === 'export' && (
                <div className="tab-content">
                  <section className="section">
                    <h2>データエクスポート</h2>
                    <div className="export-options">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleExport('json')}
                        disabled={loading}
                      >
                        JSON形式でエクスポート
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleExport('csv')}
                        disabled={loading}
                      >
                        CSV形式でエクスポート
                      </button>
                    </div>
                    <p className="export-note">
                      データセット全体をJSON形式またはCSV形式でダウンロードできます
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default TrackEnvironmentPage;

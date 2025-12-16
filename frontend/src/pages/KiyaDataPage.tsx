/**
 * キヤデータ処理ページ
 * Kiya 141 inspection car data processing page
 *
 * MO処理手順に基づいた統合処理:
 * 1. データセット作成
 * 2. LK/CK/O010ファイルアップロード
 * 3. LABOCS形式変換
 * 4. データ可視化
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PresetButtons, StandardButton } from '../components/StandardButton';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';
import { apiConfig } from '../config/api';

// 型定義
interface Dataset {
  id: string;
  status: string;
  config: any;
  files: {
    ck: string | null;
    lk: string | null;
    o010: string | null;
  };
  data: {
    curves: any[];
    sections: any[];
    measurements: any[];
    positionInfo: any;
    labocs: any;
  };
  metadata: {
    lineName: string | null;
    measurementDate: string | null;
    startKm: number | null;
    endKm: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  total: number;
  initialized: number;
  processing: number;
  completed: number;
  failed: number;
}

export const KiyaDataPage: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});

  // グローバル状態を使用
  const { state, dispatch } = useGlobalWorkspace();

  // データセット選択
  const handleSelectDataset = (dataset: Dataset) => {
    setSelectedDataset(dataset);

    // O010ファイルが既にアップロードされている場合、グローバル状態を更新
    if (dataset.files.o010 && dataset.data) {
      dispatch({
        type: 'LOAD_MTT_DATA',
        payload: {
          filename: dataset.files.o010,
          uploadDate: new Date(dataset.updatedAt),
          rawData: dataset.data,
          metadata: {
            totalLength: dataset.metadata.endKm && dataset.metadata.startKm
              ? dataset.metadata.endKm - dataset.metadata.startKm
              : 0,
            measurementDate: dataset.metadata.measurementDate || new Date().toISOString(),
            trainType: 'キヤ141',
            direction: 'up' as 'up' | 'down'
          }
        }
      });
    }
  };

  // データセット一覧を取得
  const fetchDatasets = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(apiConfig.endpoints.kiyaData.datasets);
      if (response.data.success) {
        setDatasets(response.data.datasets);

        // 既存のデータセットで最新のO010ファイルがあるものがあれば自動選択
        const datasetsWithO010 = response.data.datasets.filter((d: Dataset) => d.files.o010);
        if (datasetsWithO010.length > 0 && !selectedDataset) {
          const latestDataset = datasetsWithO010[datasetsWithO010.length - 1];
          handleSelectDataset(latestDataset);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 統計情報を取得
  const fetchStatistics = async () => {
    try {
      const response = await axios.get(apiConfig.endpoints.kiyaData.statistics);
      if (response.data.success) {
        setStatistics(response.data.statistics);
      }
    } catch (err: any) {
      console.error('統計情報取得エラー:', err);
    }
  };

  // 初期ロード
  useEffect(() => {
    fetchDatasets();
    fetchStatistics();
  }, []);

  // 新しいデータセットを作成
  const handleCreateDataset = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.post(apiConfig.endpoints.kiyaData.dataset, {
        config: {
          name: `Dataset ${new Date().toLocaleString('ja-JP')}`,
          createdBy: 'user'
        }
      });

      if (response.data.success) {
        await fetchDatasets();
        setSelectedDataset(response.data.dataset);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ファイル名バリデーション（MTTファイル用）
  const validateMTTFilename = (filename: string): boolean => {
    // ファイル名から拡張子を除去
    const nameWithoutExt = filename.split('.')[0];
    const ext = filename.split('.').pop()?.toLowerCase();

    // 以下のパターンを許可:
    // 1. Xで始まる6文字（例: X12345.csv） - 本番データ形式
    // 2. O010で始まるファイル（例: O010161677017.csv） - 旧ラボデータ形式
    // 3. MDTファイル（例: KSD022DA.MDT） - 軌道狂いデータ

    if (ext === 'mdt') {
      return true; // 全てのMDTファイルを許可
    }

    if (ext === 'csv') {
      return (nameWithoutExt.length === 6 && nameWithoutExt.startsWith('X')) ||
             nameWithoutExt.startsWith('O010');
    }

    return false;
  };

  // ファイルアップロード
  const handleFileUpload = async (
    datasetId: string,
    fileType: 'lk' | 'ck' | 'o010',
    file: File
  ) => {
    try {
      setError(null);

      // MTTファイルの場合、ファイル名をチェック
      if (fileType === 'o010') {
        if (!validateMTTFilename(file.name)) {
          setError('MTTファイルは以下の形式である必要があります: MDTファイル、O010で始まるCSVファイル（例: O010161677017.csv）、またはXで始まる6文字のCSVファイル（例: X12345.csv）');
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('datasetId', datasetId);

      setUploadProgress(prev => ({ ...prev, [fileType]: 0 }));

      const endpoint = fileType === 'lk' ? apiConfig.endpoints.kiyaData.uploadLK :
                       fileType === 'ck' ? apiConfig.endpoints.kiyaData.uploadCK :
                       apiConfig.endpoints.kiyaData.uploadO010;

      const response = await axios.post(
        endpoint,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(prev => ({ ...prev, [fileType]: percentCompleted }));
          }
        }
      );

      if (response.data.success) {
        setSelectedDataset(response.data.dataset);
        await fetchDatasets();
        setUploadProgress(prev => ({ ...prev, [fileType]: 100 }));

        // MTTファイル(O010)がアップロードされた場合、グローバル状態を更新
        if (fileType === 'o010' && response.data.dataset) {
          dispatch({
            type: 'LOAD_MTT_DATA',
            payload: {
              filename: file.name,
              uploadDate: new Date(),
              rawData: response.data.dataset.data,
              metadata: {
                totalLength: response.data.dataset.metadata.endKm - response.data.dataset.metadata.startKm,
                measurementDate: response.data.dataset.metadata.measurementDate || new Date().toISOString(),
                trainType: 'キヤ141',
                direction: 'up' as 'up' | 'down'
              }
            }
          });
          alert(`MTTファイル「${file.name}」を読み込みました。次は作業区間設定を行ってください。`);
        }

        // CKファイル（曲線諸元データ）がアップロードされた場合、グローバル状態を更新
        if (fileType === 'ck' && response.data.dataset) {
          // 生データを保存
          dispatch({
            type: 'SET_CURVE_RAW_DATA',
            payload: response.data.dataset.data.curves || response.data.dataset.data
          });

          // 曲線諸元データを保存
          if (response.data.dataset.data.curves) {
            const curveSpecs = response.data.dataset.data.curves.map((curve: any, index: number) => ({
              id: curve.id || `curve_${index}`,
              startPos: curve.start * 1000, // km to m
              endPos: curve.end * 1000, // km to m
              radius: curve.radius || 0,
              cant: curve.cant || 0,
              direction: curve.direction || 'right',
              transitionLength: curve.transitionLength || 0
            }));
            dispatch({
              type: 'SET_CURVE_SPECS',
              payload: curveSpecs
            });
          }
          console.log(`CKファイル「${file.name}」をグローバル状態に保存しました。`);
        }

        // LKファイル（線区情報）がアップロードされた場合、グローバル状態を更新
        if (fileType === 'lk' && response.data.dataset) {
          // 生データを保存
          dispatch({
            type: 'SET_LINE_RAW_DATA',
            payload: response.data.dataset.data.sections || response.data.dataset.data
          });

          // 線区情報を保存
          if (response.data.dataset.data.sections) {
            dispatch({
              type: 'SET_LINE_SECTIONS',
              payload: response.data.dataset.data.sections
            });
          }
          console.log(`LKファイル「${file.name}」をグローバル状態に保存しました。`);
        }

        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileType];
            return newProgress;
          });
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileType];
        return newProgress;
      });
    }
  };

  // LABOCS変換
  const handleConvertToLABOCS = async (datasetId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.post(apiConfig.endpoints.kiyaData.convertLabocs, {
        datasetId,
        options: {
          dataInterval: 0.25
        }
      });

      if (response.data.success) {
        alert('LABOCS形式への変換が完了しました');
        // データセット情報を再取得
        const datasetResponse = await axios.get(
          `${apiConfig.endpoints.kiyaData.dataset}/${datasetId}`
        );
        if (datasetResponse.data.success) {
          setSelectedDataset(datasetResponse.data.dataset);
        }
        await fetchDatasets();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // データセット削除
  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('このデータセットを削除しますか?')) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.delete(
        `${apiConfig.endpoints.kiyaData.dataset}/${datasetId}`
      );

      if (response.data.success) {
        if (selectedDataset?.id === datasetId) {
          setSelectedDataset(null);
        }
        await fetchDatasets();
        await fetchStatistics();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ファイル選択ハンドラー
  const handleFileChange = (
    datasetId: string,
    fileType: 'lk' | 'ck' | 'o010',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(datasetId, fileType, file);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>キヤ141検測車データ処理</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          LK/CK/O010ファイルをアップロードして、LABOCS形式に変換します
        </p>

        {/* 統計情報 */}
        {statistics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{statistics.total}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>総データセット</div>
            </div>
            <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>{statistics.initialized}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>初期化済み</div>
            </div>
            <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>{statistics.processing}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>処理中</div>
            </div>
            <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#388e3c' }}>{statistics.completed}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>完了</div>
            </div>
          </div>
        )}

        <StandardButton
          onClick={handleCreateDataset}
          disabled={isLoading}
          loading={isLoading}
          label="新しいデータセットを作成"
          type="primary"
        />
      </div>

      {error && (
        <div style={{
          padding: '15px',
          background: '#ffebee',
          borderLeft: '4px solid #f44336',
          marginBottom: '20px',
          borderRadius: '4px'
        }}>
          <strong>エラー:</strong> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* データセット一覧 */}
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>データセット一覧</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            {datasets.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                データセットがありません
              </div>
            ) : (
              datasets.map(dataset => (
                <div
                  key={dataset.id}
                  onClick={() => handleSelectDataset(dataset)}
                  style={{
                    padding: '15px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    background: selectedDataset?.id === dataset.id ? '#e3f2fd' : 'white',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDataset?.id !== dataset.id) {
                      e.currentTarget.style.background = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDataset?.id !== dataset.id) {
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                    {dataset.id}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    ステータス: {dataset.status}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    作成: {new Date(dataset.createdAt).toLocaleString('ja-JP')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* データセット詳細 */}
        <div>
          {selectedDataset ? (
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px' }}>データセット詳細</h2>
                <PresetButtons.Delete
                  onClick={() => handleDeleteDataset(selectedDataset.id)}
                  size="small"
                />
              </div>

              {/* メタデータ */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>メタデータ</h3>
                <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>ID:</strong> {selectedDataset.id}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>ステータス:</strong> {selectedDataset.status}
                  </div>
                  {selectedDataset.metadata.lineName && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>路線名:</strong> {selectedDataset.metadata.lineName}
                    </div>
                  )}
                  {selectedDataset.metadata.measurementDate && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>測定日:</strong> {selectedDataset.metadata.measurementDate}
                    </div>
                  )}
                  {selectedDataset.metadata.startKm !== null && selectedDataset.metadata.endKm !== null && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>キロ程範囲:</strong> {selectedDataset.metadata.startKm.toFixed(3)} 〜 {selectedDataset.metadata.endKm.toFixed(3)} km
                    </div>
                  )}
                </div>
              </div>

              {/* ファイルアップロード */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>ファイルアップロード</h3>
                <div style={{ display: 'grid', gap: '15px' }}>
                  {/* LKファイル */}
                  <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>LKファイル（線区管理ファイル）</strong>
                      {selectedDataset.files.lk && (
                        <span style={{ marginLeft: '10px', color: '#4caf50' }}>✓ アップロード済み</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileChange(selectedDataset.id, 'lk', e)}
                      style={{ width: '100%' }}
                    />
                    {uploadProgress.lk !== undefined && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ background: '#e0e0e0', height: '4px', borderRadius: '2px' }}>
                          <div style={{
                            background: '#1976d2',
                            height: '100%',
                            width: `${uploadProgress.lk}%`,
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                          {uploadProgress.lk}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CKファイル */}
                  <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>CKファイル（曲線情報ファイル）</strong>
                      {selectedDataset.files.ck && (
                        <span style={{ marginLeft: '10px', color: '#4caf50' }}>✓ アップロード済み</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileChange(selectedDataset.id, 'ck', e)}
                      style={{ width: '100%' }}
                    />
                    {uploadProgress.ck !== undefined && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ background: '#e0e0e0', height: '4px', borderRadius: '2px' }}>
                          <div style={{
                            background: '#1976d2',
                            height: '100%',
                            width: `${uploadProgress.ck}%`,
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                          {uploadProgress.ck}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* O010ファイル */}
                  <div style={{
                    border: state.status.dataLoaded ? '2px solid #4caf50' : '1px solid #ddd',
                    padding: '15px',
                    borderRadius: '4px',
                    background: state.status.dataLoaded ? '#f1f8e9' : 'white'
                  }}>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>O010ファイル（MTTデータ）</strong>
                      {selectedDataset.files.o010 && (
                        <span style={{ marginLeft: '10px', color: '#4caf50' }}>✓ アップロード済み</span>
                      )}
                      {state.status.dataLoaded && (
                        <span style={{ marginLeft: '10px', color: '#4caf50', fontWeight: 'bold' }}>
                          ✓ グローバルデータ読込済
                        </span>
                      )}
                    </div>
                    <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
                      ※ 対応形式: MDTファイル、O010で始まるCSVファイル、Xで始まる6文字のCSVファイル
                    </div>
                    <input
                      type="file"
                      accept=".csv,.mdt"
                      onChange={(e) => handleFileChange(selectedDataset.id, 'o010', e)}
                      style={{ width: '100%' }}
                    />
                    {uploadProgress.o010 !== undefined && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ background: '#e0e0e0', height: '4px', borderRadius: '2px' }}>
                          <div style={{
                            background: '#1976d2',
                            height: '100%',
                            width: `${uploadProgress.o010}%`,
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                          {uploadProgress.o010}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* LABOCS変換ボタン */}
              {selectedDataset.files.lk && selectedDataset.files.ck && selectedDataset.files.o010 && (
                <div style={{ marginBottom: '20px' }}>
                  <StandardButton
                    onClick={() => handleConvertToLABOCS(selectedDataset.id)}
                    disabled={isLoading}
                    loading={isLoading}
                    label="LABOCS形式に変換"
                    type="success"
                    fullWidth
                  />
                </div>
              )}

              {/* データサマリー */}
              {selectedDataset.data && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>データサマリー</h3>
                  <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>曲線数:</strong> {selectedDataset.data.curves.length}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>区間数:</strong> {selectedDataset.data.sections.length}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>測定データ数:</strong> {selectedDataset.data.measurements.length}
                    </div>
                    {selectedDataset.data.labocs && (
                      <div style={{ marginTop: '15px', padding: '10px', background: '#e8f5e9', borderRadius: '4px' }}>
                        <strong style={{ color: '#388e3c' }}>✓ LABOCS変換完了</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 曲線情報 */}
              {selectedDataset.data.curves.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>曲線情報</h3>
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}>
                    {selectedDataset.data.curves.map((curve, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '10px',
                          borderBottom: index < selectedDataset.data.curves.length - 1 ? '1px solid #eee' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                          {curve.id}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          範囲: {curve.start?.toFixed(3)} 〜 {curve.end?.toFixed(3)} km
                        </div>
                        {curve.radius && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            半径: {curve.radius}m, カント: {curve.cant || 0}mm, 方向: {curve.direction || 'N/A'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              border: '2px dashed #ddd',
              borderRadius: '8px',
              padding: '60px 20px',
              textAlign: 'center',
              color: '#999'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
              <div style={{ fontSize: '18px' }}>データセットを選択してください</div>
              <div style={{ fontSize: '14px', marginTop: '10px' }}>
                左のリストからデータセットを選択するか、新しいデータセットを作成してください
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KiyaDataPage;

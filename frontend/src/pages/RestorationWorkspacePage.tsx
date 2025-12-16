import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PresetButtons, StandardButton } from '../components/StandardButton';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';
import { apiConfig } from '../config/api';

export const RestorationWorkspacePage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [restorationResult, setRestorationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [dataType, setDataType] = useState<string>('alignment');
  const [lambdaLower, setLambdaLower] = useState<number>(6.0);
  const [lambdaUpper, setLambdaUpper] = useState<number>(100.0);

  // グローバル状態を使用
  const { state, dispatch } = useGlobalWorkspace();

  // データ保存済みかどうかのフラグ
  const [dataSaved, setDataSaved] = useState(false);

  // 復元波形計算（グローバルデータ使用版）
  const handleCalculateRestorationFromGlobal = async () => {
    if (!state.originalData.cutData && !state.originalData.mttData) {
      alert('グローバル状態に利用可能なデータがありません。キヤデータページでファイルをアップロードしてください。');
      return;
    }

    setLoading(true);

    try {
      // 優先順位: 1. cutData（切取済みデータ）、2. mttData（生データ）
      let measurementData;

      if (state.originalData.cutData) {
        // 切取済みデータを優先使用
        if (state.originalData.cutData.level && Array.isArray(state.originalData.cutData.level)) {
          const levelArray = state.originalData.cutData.level;
          const dataInterval = 0.25;
          measurementData = levelArray.map((value, index) => ({
            distance: index * dataInterval,
            value: value
          }));
          console.log('切取済みデータ（cutData.level）を使用します:', measurementData.length, '点');
        } else {
          console.error('cutDataの形式が正しくありません:', state.originalData.cutData);
          alert('データ形式エラー: 切取済みデータの形式が正しくありません');
          setLoading(false);
          return;
        }
      } else if (state.originalData.mttData?.rawData) {
        // MTTデータの生データを使用
        let rawDataArray;
        if (Array.isArray(state.originalData.mttData.rawData)) {
          rawDataArray = state.originalData.mttData.rawData;
          console.log('MTTデータ（生データ）を使用します:', rawDataArray.length, '点');
        } else if (state.originalData.mttData.rawData.level) {
          rawDataArray = state.originalData.mttData.rawData.level;
          console.log('MTTデータ（rawData.level）を使用します:', rawDataArray.length, '点');
        } else {
          console.error('MTTデータの形式が正しくありません:', state.originalData.mttData.rawData);
          alert('データ形式エラー: MTTデータの形式が正しくありません');
          setLoading(false);
          return;
        }
        const dataInterval = 0.25;
        measurementData = rawDataArray.map((value, index) => ({
          distance: index * dataInterval,
          value: value
        }));
      }

      const response = await axios.post(`${apiConfig.baseURL}/api/restoration/vb6/calculate`, {
        measurementData,
        filterParams: {
          lambdaLower,
          lambdaUpper,
          dataInterval: 0.25,
          dataType
        }
      });

      setRestorationResult(response.data);

      // グローバル状態に復元波形を保存
      dispatch({
        type: 'CALCULATE_RESTORED_WAVEFORM',
        payload: {
          positions: measurementData.map(d => d.distance),
          level: response.data.restoredWaveform,
          alignment: [],  // 後で実装
          calculatedAt: new Date(),
          method: 'standard'
        }
      });

      // ワークフロー状態は SET_RESTORED_WAVEFORM で自動的に更新される

      setDataSaved(true);
      alert('✓ 復元波形計算が完了し、データが保存されました');
    } catch (error: any) {
      console.error('復元波形計算エラー詳細:', error);
      alert(`復元波形計算エラーが発生しました: ${error.response?.data?.error || error.message}`);
    }

    setLoading(false);
  };

  // 復元波形計算（ファイルアップロード版）
  const handleCalculateRestoration = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post(`${apiConfig.baseURL}/api/upload`, formData);

      const response = await axios.post(`${apiConfig.baseURL}/api/restoration/vb6/calculate`, {
        measurementData: uploadRes.data.data,
        filterParams: {
          lambdaLower,
          lambdaUpper,
          dataInterval: 0.25,
          dataType
        }
      });

      setRestorationResult(response.data);

      // グローバル状態に復元波形を保存
      dispatch({
        type: 'CALCULATE_RESTORED_WAVEFORM',
        payload: {
          positions: measurementData.map(d => d.distance),
          level: response.data.restoredWaveform,
          alignment: [],  // 後で実装
          calculatedAt: new Date(),
          method: 'standard'
        }
      });

      // ワークフロー状態は SET_RESTORED_WAVEFORM で自動的に更新される

      setDataSaved(true);
      alert('✓ 復元波形計算が完了し、データが保存されました');
    } catch (error) {
      console.error(error);
      alert('復元波形計算エラーが発生しました');
    }

    setLoading(false);
  };


  // リセット
  const handleReset = () => {
    if (confirm('現在の計算結果をクリアして、最初からやり直しますか？')) {
      setRestorationResult(null);
      setFile(null);
      setDataSaved(false);
      dispatch({
        type: 'CLEAR_RESTORED_WAVEFORM'
      });
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '24px'
    }}>
      {/* ヘッダー */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 24px auto',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: 700, color: 'white' }}>
          ⚙️ 復元波形計算
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255, 255, 255, 0.9)' }}>
          測定データから復元波形を計算します（VB6 KANA3相当）
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 計算前の画面 */}
        {!restorationResult ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 24px 0', color: '#1f2937', fontSize: '20px' }}>
              復元波形計算パラメータ設定
            </h3>

            {/* グローバルデータ利用可能通知 */}
            {(state.originalData.cutData || state.originalData.mttData) && (
              <div style={{
                background: '#e8f5e9',
                border: '2px solid #4caf50',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: '8px', fontSize: '18px' }}>
                      ✅ キヤデータページの測定データを利用可能
                    </div>
                    <div style={{ fontSize: '14px', color: '#388e3c' }}>
                      {state.originalData.cutData
                        ? `切取済みデータ（${state.originalData.cutData.level?.length || 0}点）が利用できます`
                        : `O010ファイル（MTTデータ）が利用できます`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* パラメータ設定 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                  データタイプ:
                </label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid #d1d5db',
                    fontSize: '14px'
                  }}
                >
                  <option value="alignment">通り</option>
                  <option value="level">高低</option>
                  <option value="crossLevel">水準</option>
                  <option value="twist">平面性</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                  復元波長下限 (m):
                </label>
                <input
                  type="number"
                  value={lambdaLower}
                  onChange={(e) => setLambdaLower(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid #d1d5db',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                  復元波長上限 (m):
                </label>
                <input
                  type="number"
                  value={lambdaUpper}
                  onChange={(e) => setLambdaUpper(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid #d1d5db',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {/* 計算実行ボタン */}
            {(state.originalData.cutData || state.originalData.mttData) ? (
              <div style={{ textAlign: 'center' }}>
                <StandardButton
                  onClick={handleCalculateRestorationFromGlobal}
                  disabled={loading}
                  loading={loading}
                  label="復元波形を計算"
                  type="success"
                  icon="📊"
                  style={{
                    fontSize: '18px',
                    padding: '14px 32px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                  }}
                />
              </div>
            ) : (
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                background: '#f9fafb'
              }}>
                <p style={{ marginBottom: '16px', color: '#6b7280' }}>
                  キヤデータが読み込まれていません。手動でファイルをアップロードしてください。
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: '16px' }}
                />
                <br />
                <PresetButtons.Execute
                  onClick={handleCalculateRestoration}
                  disabled={!file || loading}
                  loading={loading}
                  label="アップロードファイルで計算"
                />
              </div>
            )}
          </div>
        ) : (
          /* 計算完了後の画面 */
          <div>
            {/* 計算完了通知 */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 12px 0', color: '#065f46', fontSize: '24px' }}>
                    ✓ 復元波形計算完了
                  </h3>
                  <p style={{ margin: 0, fontSize: '16px', color: '#065f46' }}>
                    復元波形の計算が正常に完了しました
                  </p>
                </div>
                <StandardButton
                  onClick={handleReset}
                  label="やり直す"
                  type="danger"
                  icon="🔄"
                />
              </div>
            </div>

            {/* 統計情報表示 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>データ点数</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6' }}>
                  {restorationResult?.restoredWaveform?.length || 0}
                </div>
              </div>

              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>平均値</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>
                  {restorationResult?.statistics?.mean?.toFixed(3) || '0.000'} mm
                </div>
              </div>

              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>σ値</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b' }}>
                  {restorationResult?.statistics?.sigma?.toFixed(3) || '0.000'} mm
                </div>
              </div>

              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>RMS値</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#8b5cf6' }}>
                  {restorationResult?.statistics?.rms?.toFixed(3) || '0.000'} mm
                </div>
              </div>
            </div>

            {/* フィルタ情報 */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>フィルタパラメータ</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                fontSize: '14px'
              }}>
                <div>
                  <span style={{ color: '#6b7280' }}>データタイプ: </span>
                  <strong>{restorationResult?.filterInfo?.dataType || dataType}</strong>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>波長下限: </span>
                  <strong>{restorationResult?.filterInfo?.lambdaLower || lambdaLower} m</strong>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>波長上限: </span>
                  <strong>{restorationResult?.filterInfo?.lambdaUpper || lambdaUpper} m</strong>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>データ間隔: </span>
                  <strong>{restorationResult?.filterInfo?.dataInterval || 0.25} m</strong>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default RestorationWorkspacePage;
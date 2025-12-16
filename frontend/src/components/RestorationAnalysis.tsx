import React, { useState } from 'react';
import axios from 'axios';
import { WaveformChart } from './WaveformChart';

export const RestorationAnalysis: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<string>('alignment');
  const [lambdaLower, setLambdaLower] = useState<number>(6.0);
  const [lambdaUpper, setLambdaUpper] = useState<number>(100.0);
  const [dataInterval, setDataInterval] = useState<number>(0.25);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // データタイプ変更時にデフォルト値を更新
  const handleDataTypeChange = async (newDataType: string) => {
    setDataType(newDataType);

    try {
      const response = await axios.get(
        `http://localhost:5000/api/restoration/vb6/default-params/${newDataType}`
      );

      if (response.data.success) {
        const params = response.data.params;
        setLambdaLower(params.lambdaLower);
        setLambdaUpper(params.lambdaUpper);
        setDataInterval(params.dataInterval);
      }
    } catch (error) {
      console.error('デフォルトパラメータ取得エラー:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);

    try {
      // ファイルアップロード
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('http://localhost:3003/api/upload', formData);

      // 復元波形計算
      const response = await axios.post('http://localhost:5000/api/restoration/vb6/calculate', {
        measurementData: uploadRes.data.data,
        filterParams: {
          lambdaLower,
          lambdaUpper,
          dataInterval,
          dataType
        }
      });

      setResult(response.data);
    } catch (error) {
      console.error(error);
      alert('復元波形計算エラーが発生しました');
    }

    setLoading(false);
  };

  const getDataTypeName = (type: string) => {
    const names: Record<string, string> = {
      alignment: '通り',
      level: '高低',
      crossLevel: '水準',
      twist: '平面性'
    };
    return names[type] || type;
  };

  return (
    <div style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>復元波形計算 (VB6互換)</h3>

      {/* ファイル選択 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
          検測データファイル (CSV):
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        />
      </div>

      {/* データタイプ選択 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
          データタイプ:
        </label>
        <select
          value={dataType}
          onChange={(e) => handleDataTypeChange(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="alignment">通り (Alignment)</option>
          <option value="level">高低 (Level)</option>
          <option value="crossLevel">水準 (Cross Level)</option>
          <option value="twist">平面性 (Twist)</option>
        </select>
      </div>

      {/* 復元波長範囲 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
            復元波長 下限 (m):
          </label>
          <input
            type="number"
            value={lambdaLower}
            onChange={(e) => setLambdaLower(Number(e.target.value))}
            step="0.1"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
            復元波長 上限 (m):
          </label>
          <input
            type="number"
            value={lambdaUpper}
            onChange={(e) => setLambdaUpper(Number(e.target.value))}
            step="0.1"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px'
            }}
          />
        </div>
      </div>

      {/* データ間隔 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
          データ間隔 (m):
        </label>
        <select
          value={dataInterval}
          onChange={(e) => setDataInterval(Number(e.target.value))}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="0.25">0.25m</option>
          <option value="0.5">0.5m</option>
          <option value="1.0">1.0m</option>
        </select>
      </div>

      {/* 実行ボタン */}
      <button
        onClick={handleAnalyze}
        disabled={!file || loading}
        style={{
          padding: '12px 24px',
          background: loading ? '#9ca3af' : '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {loading ? '計算中...' : '復元波形計算実行'}
      </button>

      {/* 結果表示 */}
      {result && result.success && (
        <div style={{ marginTop: '32px', padding: '20px', background: '#fef3c7', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#92400e' }}>復元波形計算結果</h4>

          {/* フィルタ情報 */}
          <div style={{
            padding: '16px',
            background: 'white',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '1px solid #fbbf24'
          }}>
            <h5 style={{ margin: '0 0 12px 0', color: '#374151' }}>フィルタ設定</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div>
                <strong>データタイプ:</strong> {getDataTypeName(result.filterInfo.dataType)}
              </div>
              <div>
                <strong>データ点数:</strong> {result.filterInfo.dataLength}
              </div>
              <div>
                <strong>復元波長:</strong> {result.filterInfo.lambdaLower}m - {result.filterInfo.lambdaUpper}m
              </div>
              <div>
                <strong>データ間隔:</strong> {result.filterInfo.dataInterval}m
              </div>
            </div>
          </div>

          {/* 統計情報 */}
          <div style={{
            padding: '16px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #fbbf24'
          }}>
            <h5 style={{ margin: '0 0 12px 0', color: '#374151' }}>統計情報</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>σ値 (標準偏差)</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                  {result.statistics.sigma.toFixed(3)} mm
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>RMS</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                  {result.statistics.rms.toFixed(3)} mm
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>平均値</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                  {result.statistics.mean.toFixed(3)} mm
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>最小値</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                  {result.statistics.min.toFixed(3)} mm
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>最大値</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                  {result.statistics.max.toFixed(3)} mm
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>データ点数</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                  {result.statistics.count} 点
                </div>
              </div>
            </div>
          </div>

          {/* 成功メッセージ */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#d1fae5',
            border: '1px solid #10b981',
            borderRadius: '6px',
            color: '#065f46',
            fontSize: '14px',
            fontWeight: 600
          }}>
            ✓ 復元波形計算が正常に完了しました
          </div>

          {/* 波形チャート表示 */}
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>復元波形チャート</h4>
            <WaveformChart
              restoredWaveform={result.restoredWaveform}
              dataInterval={result.filterInfo.dataInterval}
              startKP={0}
              showBrush={true}
              height={400}
            />
          </div>
        </div>
      )}
    </div>
  );
};

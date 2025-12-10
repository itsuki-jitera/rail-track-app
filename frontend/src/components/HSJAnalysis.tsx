import React, { useState } from 'react';
import axios from 'axios';

export const HSJAnalysis: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [filterType, setFilterType] = useState<string>('multiband');
  const [minWave, setMinWave] = useState<number>(10);
  const [maxWave, setMaxWave] = useState<number>(40);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('http://localhost:3002/api/upload', formData);

      const response = await axios.post('http://localhost:5000/api/algorithms/hsj', {
        measurementData: uploadRes.data.data,
        filterType,
        minWavelength: minWave,
        maxWavelength: maxWave
      });

      setResult(response.data);
    } catch (error) {
      console.error(error);
      alert('解析エラーが発生しました');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <div style={{ margin: '16px 0' }}>
        <label>フィルタ:
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ marginLeft: '8px' }}>
            <option value="multiband">マルチバンド</option>
            <option value="bandpass">バンドパス</option>
            <option value="highpass">ハイパス</option>
            <option value="lowpass">ローパス</option>
          </select>
        </label>
        {filterType === 'bandpass' && (
          <>
            <label style={{ marginLeft: '16px' }}>最小波長 (m): <input type="number" value={minWave} onChange={(e) => setMinWave(Number(e.target.value))} /></label>
            <label style={{ marginLeft: '16px' }}>最大波長 (m): <input type="number" value={maxWave} onChange={(e) => setMaxWave(Number(e.target.value))} /></label>
          </>
        )}
      </div>
      <button onClick={handleAnalyze} disabled={!file || loading} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        {loading ? '解析中...' : 'HSJ解析実行'}
      </button>
      {result && result.success && (
        <div style={{ marginTop: '20px' }}>
          <h3>解析結果</h3>
          {result.results ? (
            <>
              <p>短波長σ: {result.results.shortWave?.statistics?.sigma?.toFixed(3)} mm</p>
              <p>中波長σ: {result.results.midWave?.statistics?.sigma?.toFixed(3)} mm</p>
              <p>長波長σ: {result.results.longWave?.statistics?.sigma?.toFixed(3)} mm</p>
            </>
          ) : (
            <>
              <p>σ値: {result.statistics?.sigma?.toFixed(3)} mm</p>
              <p>RMS: {result.statistics?.rms?.toFixed(3)} mm</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import axios from 'axios';

export const Y1Y2Analysis: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [chordType, setChordType] = useState<string>('10m');
  const [y2Mode, setY2Mode] = useState<string>('subtract');
  const [result, setResult] = useState<any>(null);
  const [correlation, setCorrelation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('http://localhost:3003/api/upload', formData);

      const response = await axios.post('http://localhost:5000/api/algorithms/y1y2', {
        measurementData: uploadRes.data.data,
        chordType,
        y2Mode
      });

      setResult(response.data);

      if (response.data.success) {
        const corrRes = await axios.post('http://localhost:5000/api/algorithms/y1y2/correlation', {
          y1y2Result: response.data
        });
        setCorrelation(corrRes.data);
      }
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
        <label>弦長:
          <select value={chordType} onChange={(e) => setChordType(e.target.value)} style={{ marginLeft: '8px' }}>
            <option value="5m">5m</option>
            <option value="10m">10m</option>
            <option value="20m">20m</option>
            <option value="40m">40m</option>
          </select>
        </label>
        <label style={{ marginLeft: '16px' }}>Y2モード:
          <select value={y2Mode} onChange={(e) => setY2Mode(e.target.value)} style={{ marginLeft: '8px' }}>
            <option value="subtract">減算方式</option>
            <option value="double">2倍方式</option>
          </select>
        </label>
      </div>
      <button onClick={handleAnalyze} disabled={!file || loading} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        {loading ? '解析中...' : 'Y1Y2解析実行'}
      </button>
      {result && result.success && (
        <div style={{ marginTop: '20px' }}>
          <h3>解析結果</h3>
          <p>Y1 σ値: {result.y1.statistics.sigma.toFixed(3)} mm</p>
          <p>Y2 σ値: {result.y2.statistics.sigma.toFixed(3)} mm</p>
          <p>差分 σ値: {result.difference.statistics.sigma.toFixed(3)} mm</p>
          {correlation && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <p><strong>相関係数:</strong> {correlation.correlation}</p>
              <p><strong>判定:</strong> {correlation.interpretation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

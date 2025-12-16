import React, { useState } from 'react';
import axios from 'axios';

export const Bs05Analysis: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [radius, setRadius] = useState<number>(400);
  const [cant, setCant] = useState<number>(80);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('http://localhost:3003/api/upload', formData);

      const response = await axios.post('http://localhost:5000/api/algorithms/bs05', {
        measurementData: uploadRes.data.data,
        singleCurveParams: { radius, cant }
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
        <label>曲線半径 (m): <input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></label>
        <label style={{ marginLeft: '16px' }}>カント (mm): <input type="number" value={cant} onChange={(e) => setCant(Number(e.target.value))} /></label>
      </div>
      <button onClick={handleAnalyze} disabled={!file || loading} style={{ padding: '10px 20px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        {loading ? '解析中...' : 'Bs05解析実行'}
      </button>
      {result && result.success && (
        <div style={{ marginTop: '20px' }}>
          <h3>解析結果</h3>
          <p>σ値: {result.statistics.sigma.toFixed(3)} mm</p>
          <p>RMS: {result.statistics.rms.toFixed(3)} mm</p>
          <p>補正データ点数: {result.statistics.count}</p>
        </div>
      )}
    </div>
  );
};

/**
 * 偏心矢計算ページ
 * Eccentric Versine Calculation Page
 */

import React, { useState, useEffect } from 'react';
import './EccentricVersinePage.css';
import EccentricVersineChart from '../components/EccentricVersineChart';
import CharacteristicsChart from '../components/CharacteristicsChart';
import ConversionComparisonChart from '../components/ConversionComparisonChart';

// API Base URL
const API_BASE = 'http://localhost:5000/api';

interface MeasurementPoint {
  distance: number;
  value: number;
}

interface Statistics {
  count: number;
  mean: number;
  sigma: number;
  rms: number;
  max: number;
  min: number;
  peakToPeak: number;
}

interface Characteristic {
  wavelength: number;
  A: number;
  B: number;
  amplitude: number;
  phase: number;
  phaseDeg: number;
}

interface CalculationResult {
  success: boolean;
  data?: MeasurementPoint[];
  statistics?: Statistics;
  characteristics?: Characteristic[];
  parameters?: any;
  error?: string;
}

interface AlgorithmInfo {
  name: string;
  version: string;
  description: string;
  specification: string[];
  formulas: {
    versine: string;
    coefficientA: string;
    coefficientB: string;
    amplitude: string;
    phase: string;
    conversionAlpha: string;
    conversionBeta: string;
  };
  parameters: {
    samplingInterval: number;
    precision: number;
  };
}

const EccentricVersinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculate' | 'characteristics' | 'convert' | 'coefficients' | 'info'>('calculate');

  // 計算タブ
  const [measurementData, setMeasurementData] = useState<MeasurementPoint[]>([]);
  const [p, setP] = useState<number>(5);
  const [q, setQ] = useState<number>(10);
  const [samplingInterval, setSamplingInterval] = useState<number>(0.25);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // 検測特性タブ
  const [charP, setCharP] = useState<number>(5);
  const [charQ, setCharQ] = useState<number>(10);
  const [characteristics, setCharacteristics] = useState<Characteristic[] | null>(null);
  const [loadingChar, setLoadingChar] = useState(false);

  // 変換タブ
  const [conversionData, setConversionData] = useState<MeasurementPoint[]>([]);
  const [p1, setP1] = useState<number>(5);
  const [q1, setQ1] = useState<number>(10);
  const [p2, setP2] = useState<number>(7);
  const [q2, setQ2] = useState<number>(8);
  const [wavelength, setWavelength] = useState<number>(20);
  const [conversionResult, setConversionResult] = useState<CalculationResult | null>(null);
  const [converting, setConverting] = useState(false);

  // 係数計算タブ
  const [coeffP, setCoeffP] = useState<number>(5);
  const [coeffQ, setCoeffQ] = useState<number>(10);
  const [coeffWavelength, setCoeffWavelength] = useState<number>(20);
  const [abCoefficients, setAbCoefficients] = useState<any>(null);
  const [loadingCoeff, setLoadingCoeff] = useState(false);

  // アルゴリズム情報
  const [algorithmInfo, setAlgorithmInfo] = useState<AlgorithmInfo | null>(null);

  // サンプルデータ生成
  const generateSampleData = (length: number = 400) => {
    const data: MeasurementPoint[] = [];
    for (let i = 0; i < length; i++) {
      const distance = i * samplingInterval;
      // サイン波 + ノイズ
      const value = 5 * Math.sin(2 * Math.PI * distance / 20) +
                    2 * Math.sin(2 * Math.PI * distance / 10) +
                    (Math.random() - 0.5) * 0.5;
      data.push({ distance, value });
    }
    return data;
  };

  // 偏心矢計算
  const handleCalculate = async () => {
    if (measurementData.length === 0) {
      alert('測定データがありません。サンプルデータを生成してください。');
      return;
    }

    setCalculating(true);
    try {
      const response = await fetch(`${API_BASE}/eccentric-versine/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurementData,
          p,
          q,
          samplingInterval
        })
      });

      const result = await response.json();
      setCalculationResult(result);

      if (!result.success) {
        alert(`計算エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('計算エラー:', error);
      alert('計算中にエラーが発生しました');
    } finally {
      setCalculating(false);
    }
  };

  // 検測特性計算
  const handleCalculateCharacteristics = async () => {
    setLoadingChar(true);
    try {
      const response = await fetch(`${API_BASE}/eccentric-versine/characteristics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p: charP,
          q: charQ,
          samplingInterval
        })
      });

      const result = await response.json();
      if (result.success) {
        setCharacteristics(result.characteristics);
      } else {
        alert(`計算エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('検測特性計算エラー:', error);
      alert('検測特性計算中にエラーが発生しました');
    } finally {
      setLoadingChar(false);
    }
  };

  // 偏心矢変換
  const handleConvert = async () => {
    if (conversionData.length === 0) {
      alert('変換元データがありません。サンプルデータを生成してください。');
      return;
    }

    setConverting(true);
    try {
      const response = await fetch(`${API_BASE}/eccentric-versine/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurementData: conversionData,
          p1,
          q1,
          p2,
          q2,
          wavelength,
          samplingInterval
        })
      });

      const result = await response.json();
      setConversionResult(result);

      if (!result.success) {
        alert(`変換エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('変換エラー:', error);
      alert('変換中にエラーが発生しました');
    } finally {
      setConverting(false);
    }
  };

  // A, B係数計算
  const handleCalculateABCoefficients = async () => {
    setLoadingCoeff(true);
    try {
      const response = await fetch(`${API_BASE}/eccentric-versine/ab-coefficients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p: coeffP,
          q: coeffQ,
          wavelength: coeffWavelength
        })
      });

      const result = await response.json();
      if (result.success) {
        setAbCoefficients(result);
      } else {
        alert(`計算エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('係数計算エラー:', error);
      alert('係数計算中にエラーが発生しました');
    } finally {
      setLoadingCoeff(false);
    }
  };

  // アルゴリズム情報取得
  useEffect(() => {
    const fetchAlgorithmInfo = async () => {
      try {
        const response = await fetch(`${API_BASE}/eccentric-versine/info`);
        const result = await response.json();
        if (result.success) {
          setAlgorithmInfo(result.info);
        }
      } catch (error) {
        console.error('アルゴリズム情報取得エラー:', error);
      }
    };

    fetchAlgorithmInfo();
  }, []);

  return (
    <div className="eccentric-versine-page">
      <div className="page-header">
        <h1>偏心矢計算</h1>
        <p className="page-description">
          非対称弦長構成の偏心矢計算・変換システム（仕様書準拠）
        </p>
      </div>

      {/* タブナビゲーション */}
      <div className="tab-navigation">
        <button
          className={`tab ${activeTab === 'calculate' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculate')}
        >
          偏心矢計算
        </button>
        <button
          className={`tab ${activeTab === 'characteristics' ? 'active' : ''}`}
          onClick={() => setActiveTab('characteristics')}
        >
          検測特性
        </button>
        <button
          className={`tab ${activeTab === 'convert' ? 'active' : ''}`}
          onClick={() => setActiveTab('convert')}
        >
          偏心矢変換
        </button>
        <button
          className={`tab ${activeTab === 'coefficients' ? 'active' : ''}`}
          onClick={() => setActiveTab('coefficients')}
        >
          係数計算
        </button>
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          アルゴリズム情報
        </button>
      </div>

      <div className="tab-content">
        {/* 偏心矢計算タブ */}
        {activeTab === 'calculate' && (
          <div className="section">
            <h2>偏心矢計算</h2>

            <div className="parameter-section">
              <h3>パラメータ設定</h3>
              <div className="param-grid">
                <div className="param-item">
                  <label>前方弦長 p (m):</label>
                  <input
                    type="number"
                    value={p}
                    onChange={(e) => setP(parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="param-item">
                  <label>後方弦長 q (m):</label>
                  <input
                    type="number"
                    value={q}
                    onChange={(e) => setQ(parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="param-item">
                  <label>サンプリング間隔 τ (m):</label>
                  <input
                    type="number"
                    value={samplingInterval}
                    onChange={(e) => setSamplingInterval(parseFloat(e.target.value))}
                    step="0.05"
                    min="0.05"
                  />
                </div>
              </div>

              <div className="formula-display">
                <strong>計算式:</strong> y[n] = x[n] - (1/(p+q))(p·x[n-q/τ] + q·x[n+p/τ])
              </div>
            </div>

            <div className="data-section">
              <h3>測定データ</h3>
              <div className="button-group">
                <button
                  className="btn btn-primary"
                  onClick={() => setMeasurementData(generateSampleData())}
                >
                  サンプルデータ生成
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCalculate}
                  disabled={calculating || measurementData.length === 0}
                >
                  {calculating ? '計算中...' : '偏心矢を計算'}
                </button>
              </div>

              {measurementData.length > 0 && (
                <div className="data-info">
                  <p>測定データ数: {measurementData.length} 点</p>
                  <p>距離範囲: {measurementData[0].distance.toFixed(2)}m 〜 {measurementData[measurementData.length - 1].distance.toFixed(2)}m</p>
                </div>
              )}
            </div>

            {calculationResult && calculationResult.success && (
              <div className="result-section">
                <h3>計算結果</h3>

                {/* 波形チャート */}
                {measurementData && calculationResult.data && (
                  <div className="chart-section">
                    <EccentricVersineChart
                      originalData={measurementData}
                      versineData={calculationResult.data}
                      title="偏心矢波形"
                    />
                  </div>
                )}

                {calculationResult.parameters && (
                  <div className="info-grid">
                    <div className="info-item">
                      <label>前方弦長:</label>
                      <span>{calculationResult.parameters.p} m ({calculationResult.parameters.pPoints} 点)</span>
                    </div>
                    <div className="info-item">
                      <label>後方弦長:</label>
                      <span>{calculationResult.parameters.q} m ({calculationResult.parameters.qPoints} 点)</span>
                    </div>
                    <div className="info-item">
                      <label>構成:</label>
                      <span>{calculationResult.parameters.isSymmetric ? '対称 (正矢)' : '非対称 (偏心矢)'}</span>
                    </div>
                  </div>
                )}

                {calculationResult.statistics && (
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h4>データ数</h4>
                      <p className="stat-value">{calculationResult.statistics.count}</p>
                    </div>
                    <div className="stat-card">
                      <h4>平均値</h4>
                      <p className="stat-value">{calculationResult.statistics.mean.toFixed(3)}</p>
                      <p className="stat-unit">mm</p>
                    </div>
                    <div className="stat-card">
                      <h4>標準偏差</h4>
                      <p className="stat-value">{calculationResult.statistics.sigma.toFixed(3)}</p>
                      <p className="stat-unit">mm</p>
                    </div>
                    <div className="stat-card">
                      <h4>RMS</h4>
                      <p className="stat-value">{calculationResult.statistics.rms.toFixed(3)}</p>
                      <p className="stat-unit">mm</p>
                    </div>
                    <div className="stat-card">
                      <h4>最大値</h4>
                      <p className="stat-value">{calculationResult.statistics.max.toFixed(3)}</p>
                      <p className="stat-unit">mm</p>
                    </div>
                    <div className="stat-card">
                      <h4>最小値</h4>
                      <p className="stat-value">{calculationResult.statistics.min.toFixed(3)}</p>
                      <p className="stat-unit">mm</p>
                    </div>
                  </div>
                )}

                {calculationResult.characteristics && (
                  <div className="characteristics-preview">
                    <h4>検測特性（代表波長）</h4>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>波長 (m)</th>
                          <th>A</th>
                          <th>B</th>
                          <th>振幅</th>
                          <th>位相 (deg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculationResult.characteristics.map((char, idx) => (
                          <tr key={idx}>
                            <td>{char.wavelength}</td>
                            <td>{char.A.toFixed(6)}</td>
                            <td>{char.B.toFixed(6)}</td>
                            <td>{char.amplitude.toFixed(6)}</td>
                            <td>{char.phaseDeg.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 検測特性タブ */}
        {activeTab === 'characteristics' && (
          <div className="section">
            <h2>検測特性計算</h2>

            <div className="parameter-section">
              <h3>パラメータ設定</h3>
              <div className="param-grid">
                <div className="param-item">
                  <label>前方弦長 p (m):</label>
                  <input
                    type="number"
                    value={charP}
                    onChange={(e) => setCharP(parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="param-item">
                  <label>後方弦長 q (m):</label>
                  <input
                    type="number"
                    value={charQ}
                    onChange={(e) => setCharQ(parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                  />
                </div>
              </div>

              <div className="formula-display">
                <div><strong>A係数:</strong> A = 1 - (p·cos(ωq) + q·cos(ωp))/(p+q)</div>
                <div><strong>B係数:</strong> B = (-p·sin(ωq) + q·sin(ωp))/(p+q)</div>
                <div><strong>振幅特性:</strong> √(A² + B²)</div>
                <div><strong>位相特性:</strong> θ = arctan(B/A)</div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleCalculateCharacteristics}
                disabled={loadingChar}
              >
                {loadingChar ? '計算中...' : '検測特性を計算'}
              </button>
            </div>

            {characteristics && (
              <div className="result-section">
                <h3>検測特性（波長 1m 〜 200m）</h3>

                {/* 検測特性チャート */}
                <div className="chart-section">
                  <CharacteristicsChart
                    characteristics={characteristics}
                    title={`検測特性 (p=${charP}m, q=${charQ}m)`}
                  />
                </div>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>波長 (m)</th>
                        <th>A</th>
                        <th>B</th>
                        <th>振幅</th>
                        <th>位相 (rad)</th>
                        <th>位相 (deg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {characteristics.map((char, idx) => (
                        <tr key={idx}>
                          <td>{char.wavelength}</td>
                          <td>{char.A.toFixed(6)}</td>
                          <td>{char.B.toFixed(6)}</td>
                          <td>{char.amplitude.toFixed(6)}</td>
                          <td>{char.phase.toFixed(6)}</td>
                          <td>{char.phaseDeg.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-note">全 {characteristics.length} 波長の検測特性</p>
              </div>
            )}
          </div>
        )}

        {/* 偏心矢変換タブ */}
        {activeTab === 'convert' && (
          <div className="section">
            <h2>偏心矢変換</h2>

            <div className="parameter-section">
              <h3>変換パラメータ</h3>
              <div className="conversion-params">
                <div className="param-group">
                  <h4>変換元 (p1, q1)</h4>
                  <div className="param-grid">
                    <div className="param-item">
                      <label>前方弦長 p1 (m):</label>
                      <input
                        type="number"
                        value={p1}
                        onChange={(e) => setP1(parseFloat(e.target.value))}
                        step="0.1"
                        min="0.1"
                      />
                    </div>
                    <div className="param-item">
                      <label>後方弦長 q1 (m):</label>
                      <input
                        type="number"
                        value={q1}
                        onChange={(e) => setQ1(parseFloat(e.target.value))}
                        step="0.1"
                        min="0.1"
                      />
                    </div>
                  </div>
                </div>

                <div className="param-group">
                  <h4>変換先 (p2, q2)</h4>
                  <div className="param-grid">
                    <div className="param-item">
                      <label>前方弦長 p2 (m):</label>
                      <input
                        type="number"
                        value={p2}
                        onChange={(e) => setP2(parseFloat(e.target.value))}
                        step="0.1"
                        min="0.1"
                      />
                    </div>
                    <div className="param-item">
                      <label>後方弦長 q2 (m):</label>
                      <input
                        type="number"
                        value={q2}
                        onChange={(e) => setQ2(parseFloat(e.target.value))}
                        step="0.1"
                        min="0.1"
                      />
                    </div>
                  </div>
                </div>

                <div className="param-item">
                  <label>基準波長 (m):</label>
                  <input
                    type="number"
                    value={wavelength}
                    onChange={(e) => setWavelength(parseFloat(e.target.value))}
                    step="1"
                    min="1"
                  />
                </div>
              </div>

              <div className="formula-display">
                <div><strong>変換係数α:</strong> α = (A1·A2 + B1·B2)/(A1² + B1²)</div>
                <div><strong>変換係数β:</strong> β = (A1·B2 - A2·B1)/(A1² + B1²)</div>
              </div>
            </div>

            <div className="data-section">
              <h3>変換元データ</h3>
              <div className="button-group">
                <button
                  className="btn btn-primary"
                  onClick={() => setConversionData(generateSampleData())}
                >
                  サンプルデータ生成
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConvert}
                  disabled={converting || conversionData.length === 0}
                >
                  {converting ? '変換中...' : '偏心矢を変換'}
                </button>
              </div>

              {conversionData.length > 0 && (
                <div className="data-info">
                  <p>データ数: {conversionData.length} 点</p>
                </div>
              )}
            </div>

            {conversionResult && conversionResult.success && (
              <div className="result-section">
                <h3>変換結果</h3>

                {/* 変換比較チャート */}
                {conversionData && conversionResult.data && (
                  <div className="chart-section">
                    <ConversionComparisonChart
                      sourceData={conversionData}
                      convertedData={conversionResult.data}
                      sourceLabel={`変換元 (p=${p1}m, q=${q1}m)`}
                      convertedLabel={`変換後 (p=${p2}m, q=${q2}m)`}
                      title="偏心矢変換比較"
                    />
                  </div>
                )}

                {conversionResult.parameters && (
                  <div className="info-grid">
                    <div className="info-item">
                      <label>変換元:</label>
                      <span>p1={conversionResult.parameters.source.p}m, q1={conversionResult.parameters.source.q}m</span>
                    </div>
                    <div className="info-item">
                      <label>変換先:</label>
                      <span>p2={conversionResult.parameters.target.p}m, q2={conversionResult.parameters.target.q}m</span>
                    </div>
                    <div className="info-item">
                      <label>基準波長:</label>
                      <span>{conversionResult.parameters.wavelength}m</span>
                    </div>
                  </div>
                )}

                {conversionResult.statistics && (
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h4>データ数</h4>
                      <p className="stat-value">{conversionResult.statistics.count}</p>
                    </div>
                    <div className="stat-card">
                      <h4>平均値</h4>
                      <p className="stat-value">{conversionResult.statistics.mean.toFixed(3)}</p>
                    </div>
                    <div className="stat-card">
                      <h4>標準偏差</h4>
                      <p className="stat-value">{conversionResult.statistics.sigma.toFixed(3)}</p>
                    </div>
                    <div className="stat-card">
                      <h4>RMS</h4>
                      <p className="stat-value">{conversionResult.statistics.rms.toFixed(3)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 係数計算タブ */}
        {activeTab === 'coefficients' && (
          <div className="section">
            <h2>A, B係数計算</h2>

            <div className="parameter-section">
              <h3>パラメータ設定</h3>
              <div className="param-grid">
                <div className="param-item">
                  <label>前方弦長 p (m):</label>
                  <input
                    type="number"
                    value={coeffP}
                    onChange={(e) => setCoeffP(parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="param-item">
                  <label>後方弦長 q (m):</label>
                  <input
                    type="number"
                    value={coeffQ}
                    onChange={(e) => setCoeffQ(parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="param-item">
                  <label>波長 (m):</label>
                  <input
                    type="number"
                    value={coeffWavelength}
                    onChange={(e) => setCoeffWavelength(parseFloat(e.target.value))}
                    step="1"
                    min="1"
                  />
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleCalculateABCoefficients}
                disabled={loadingCoeff}
              >
                {loadingCoeff ? '計算中...' : 'A, B係数を計算'}
              </button>
            </div>

            {abCoefficients && (
              <div className="result-section">
                <h3>計算結果</h3>
                <div className="coefficient-results">
                  <div className="coeff-card">
                    <h4>A係数</h4>
                    <p className="coeff-value">{abCoefficients.A}</p>
                  </div>
                  <div className="coeff-card">
                    <h4>B係数</h4>
                    <p className="coeff-value">{abCoefficients.B}</p>
                  </div>
                  <div className="coeff-card">
                    <h4>振幅</h4>
                    <p className="coeff-value">{abCoefficients.amplitude}</p>
                  </div>
                  <div className="coeff-card">
                    <h4>位相</h4>
                    <p className="coeff-value">{abCoefficients.phase} rad</p>
                    <p className="coeff-detail">{abCoefficients.phaseDeg}°</p>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <label>前方弦長 p:</label>
                    <span>{abCoefficients.p} m</span>
                  </div>
                  <div className="info-item">
                    <label>後方弦長 q:</label>
                    <span>{abCoefficients.q} m</span>
                  </div>
                  <div className="info-item">
                    <label>波長:</label>
                    <span>{abCoefficients.wavelength} m</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* アルゴリズム情報タブ */}
        {activeTab === 'info' && algorithmInfo && (
          <div className="section">
            <h2>アルゴリズム情報</h2>

            <div className="info-grid">
              <div className="info-item">
                <label>アルゴリズム名:</label>
                <span>{algorithmInfo.name}</span>
              </div>
              <div className="info-item">
                <label>バージョン:</label>
                <span>{algorithmInfo.version}</span>
              </div>
              <div className="info-item">
                <label>説明:</label>
                <span>{algorithmInfo.description}</span>
              </div>
            </div>

            <div className="spec-section">
              <h3>準拠仕様書</h3>
              <ul>
                {algorithmInfo.specification.map((spec, idx) => (
                  <li key={idx}>{spec}</li>
                ))}
              </ul>
            </div>

            <div className="formula-section">
              <h3>計算式</h3>
              <div className="formula-list">
                <div className="formula-item">
                  <label>偏心矢:</label>
                  <code>{algorithmInfo.formulas.versine}</code>
                </div>
                <div className="formula-item">
                  <label>A係数:</label>
                  <code>{algorithmInfo.formulas.coefficientA}</code>
                </div>
                <div className="formula-item">
                  <label>B係数:</label>
                  <code>{algorithmInfo.formulas.coefficientB}</code>
                </div>
                <div className="formula-item">
                  <label>振幅:</label>
                  <code>{algorithmInfo.formulas.amplitude}</code>
                </div>
                <div className="formula-item">
                  <label>位相:</label>
                  <code>{algorithmInfo.formulas.phase}</code>
                </div>
                <div className="formula-item">
                  <label>変換係数α:</label>
                  <code>{algorithmInfo.formulas.conversionAlpha}</code>
                </div>
                <div className="formula-item">
                  <label>変換係数β:</label>
                  <code>{algorithmInfo.formulas.conversionBeta}</code>
                </div>
              </div>
            </div>

            <div className="param-section">
              <h3>デフォルトパラメータ</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>サンプリング間隔:</label>
                  <span>{algorithmInfo.parameters.samplingInterval} m</span>
                </div>
                <div className="info-item">
                  <label>計算精度:</label>
                  <span>{algorithmInfo.parameters.precision} 桁</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EccentricVersinePage;

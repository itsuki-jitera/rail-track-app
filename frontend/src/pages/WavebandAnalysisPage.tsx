/**
 * FFT解析ページ
 * PDF P18-20の仕様に基づく実装
 * 波長帯別の軌道狂い解析
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

interface WavebandResult {
  wavelength: string;
  range: string;
  amplitude: number;
  frequency: number;
  contribution: number;
}

export const WavebandAnalysisPage: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<WavebandResult[]>([]);
  const [settings, setSettings] = useState({
    wavebands: {
      short: { min: 1, max: 5, enabled: true },
      medium: { min: 5, max: 25, enabled: true },
      long: { min: 25, max: 70, enabled: true },
      veryLong: { min: 70, max: 200, enabled: true }
    },
    samplingInterval: 0.25,
    windowFunction: 'hanning'
  });

  const analyzeWaveband = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/fft-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.results);
        alert('FFT解析が完了しました');
      }
    } catch (error) {
      console.error('解析エラー:', error);
      alert('FFT解析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  const exportResults = () => {
    const csv = [
      ['波長帯', '範囲(m)', '振幅(mm)', '周波数(1/m)', '寄与率(%)'],
      ...results.map(r => [
        r.wavelength,
        r.range,
        r.amplitude.toFixed(2),
        r.frequency.toFixed(4),
        r.contribution.toFixed(1)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fft_analysis_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📊 FFT解析（波長帯別解析）</h1>
        <p>周波数領域での軌道狂い成分を解析します（PDF P18-20準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>解析設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>サンプリング間隔 (m)</label>
              <input
                type="number"
                step="0.05"
                value={settings.samplingInterval}
                onChange={(e) => setSettings({
                  ...settings,
                  samplingInterval: Number(e.target.value)
                })}
              />
              <small>標準: 0.25m (検測車データ)</small>
            </div>

            <div className="form-group">
              <label>窓関数</label>
              <select
                value={settings.windowFunction}
                onChange={(e) => setSettings({
                  ...settings,
                  windowFunction: e.target.value
                })}
              >
                <option value="hanning">ハニング窓</option>
                <option value="hamming">ハミング窓</option>
                <option value="blackman">ブラックマン窓</option>
                <option value="rectangular">矩形窓</option>
              </select>
            </div>

            <div className="info-box">
              <h3>📏 波長帯設定</h3>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.wavebands.short.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      wavebands: {
                        ...settings.wavebands,
                        short: { ...settings.wavebands.short, enabled: e.target.checked }
                      }
                    })}
                  />
                  短波長 (1-5m) - レール継目、まくらぎ
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.wavebands.medium.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      wavebands: {
                        ...settings.wavebands,
                        medium: { ...settings.wavebands.medium, enabled: e.target.checked }
                      }
                    })}
                  />
                  中波長 (5-25m) - 道床沈下
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.wavebands.long.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      wavebands: {
                        ...settings.wavebands,
                        long: { ...settings.wavebands.long, enabled: e.target.checked }
                      }
                    })}
                  />
                  長波長 (25-70m) - 路盤沈下
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.wavebands.veryLong.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      wavebands: {
                        ...settings.wavebands,
                        veryLong: { ...settings.wavebands.veryLong, enabled: e.target.checked }
                      }
                    })}
                  />
                  超長波長 (70-200m) - 地盤沈下
                </label>
              </div>
            </div>

            <div className="action-buttons">
              <PresetButtons.Calculate
                label="FFT解析を実行"
                onClick={analyzeWaveband}
                loading={analyzing}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>解析結果</h2>
          </div>
          <div className="card-body">
            {results.length === 0 ? (
              <p className="text-muted">FFT解析を実行してください</p>
            ) : (
              <>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>波長帯</th>
                        <th>範囲</th>
                        <th>振幅</th>
                        <th>周波数</th>
                        <th>寄与率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, idx) => (
                        <tr key={idx}>
                          <td><strong>{result.wavelength}</strong></td>
                          <td>{result.range}</td>
                          <td>{result.amplitude.toFixed(2)}mm</td>
                          <td>{result.frequency.toFixed(4)}/m</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: `${result.contribution}%`,
                                height: '20px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '4px'
                              }} />
                              <span>{result.contribution.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="stats-grid mt-3">
                  <div className="stat-item">
                    <h3>総波長帯数</h3>
                    <p><strong>{results.length}</strong>帯</p>
                  </div>
                  <div className="stat-item">
                    <h3>最大振幅</h3>
                    <p><strong>
                      {Math.max(...results.map(r => r.amplitude)).toFixed(2)}
                    </strong>mm</p>
                  </div>
                  <div className="stat-item">
                    <h3>主要波長帯</h3>
                    <p><strong>
                      {results.reduce((max, r) => r.contribution > max.contribution ? r : max, results[0])?.wavelength || '-'}
                    </strong></p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>FFT解析について</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>🔬 解析手法</h3>
              <ul>
                <li>高速フーリエ変換(FFT)により周波数成分を抽出</li>
                <li>波長帯ごとのパワースペクトル密度を算出</li>
                <li>各波長帯の寄与率を評価</li>
                <li>軌道狂いの主要原因を特定</li>
              </ul>
            </div>

            <div className="warning-box">
              <h3>⚠️ 解析時の注意</h3>
              <ul>
                <li>データ長は2のべき乗に近い方が高速</li>
                <li>エイリアシングを避けるため適切なサンプリング間隔を選択</li>
                <li>窓関数は漏れと分解能のトレードオフを考慮</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>📖 波長帯と原因の対応</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>短波長 (1-5m)</td>
                    <td>レール継目不整、まくらぎ支持力</td>
                  </tr>
                  <tr>
                    <td>中波長 (5-25m)</td>
                    <td>道床沈下、締固め不良</td>
                  </tr>
                  <tr>
                    <td>長波長 (25-70m)</td>
                    <td>路盤沈下、構造物接続部</td>
                  </tr>
                  <tr>
                    <td>超長波長 (70-200m)</td>
                    <td>地盤沈下、軟弱地盤</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Export
          label="結果をCSV出力"
          onClick={exportResults}
          disabled={results.length === 0}
        />
      </div>
    </div>
  );
};

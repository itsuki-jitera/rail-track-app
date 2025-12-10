/**
 * σ値・良化率解析ページ
 * PDF P27の仕様に基づく実装
 * 軌道整正の品質評価と改善効果を解析
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

interface QualityMetrics {
  section: string;
  beforeSigma: number;
  afterSigma: number;
  improvementRate: number;
  standardDeviation: number;
  maxValue: number;
  avgValue: number;
}

export const QualityAnalysisPage: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState<QualityMetrics[]>([]);
  const [overallMetrics, setOverallMetrics] = useState({
    totalImprovement: 0,
    avgSigmaBefore: 0,
    avgSigmaAfter: 0,
    qualityGrade: ''
  });

  const analyzeQuality = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/quality-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
        setOverallMetrics(data.overall);
        alert('品質解析が完了しました');
      }
    } catch (error) {
      console.error('解析エラー:', error);
      alert('品質解析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  const exportQualityReport = () => {
    const csv = [
      ['区間', '整正前σ', '整正後σ', '良化率(%)', '標準偏差', '最大値', '平均値'],
      ...metrics.map(m => [
        m.section,
        m.beforeSigma.toFixed(2),
        m.afterSigma.toFixed(2),
        m.improvementRate.toFixed(1),
        m.standardDeviation.toFixed(2),
        m.maxValue.toFixed(2),
        m.avgValue.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality_analysis_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getQualityColor = (rate: number) => {
    if (rate >= 30) return '#28a745';
    if (rate >= 20) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📈 σ値・良化率解析</h1>
        <p>軌道整正の品質評価と改善効果を解析します（PDF P27準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>品質解析実行</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📊 解析内容</h3>
              <ul>
                <li>整正前後のσ値（標準偏差）を算出</li>
                <li>良化率（改善率）の評価</li>
                <li>区間別の品質評価</li>
                <li>総合的な整正効果の判定</li>
              </ul>
            </div>

            <div className="action-buttons">
              <PresetButtons.Calculate
                label="品質解析を実行"
                onClick={analyzeQuality}
                loading={analyzing}
              />
            </div>
          </div>
        </div>

        {metrics.length > 0 && (
          <>
            <div className="card">
              <div className="card-header">
                <h2>総合評価</h2>
              </div>
              <div className="card-body">
                <div className="stats-grid">
                  <div className="stat-item highlight">
                    <h3>総合良化率</h3>
                    <p className="improvement-rate">
                      {overallMetrics.totalImprovement.toFixed(1)}%
                    </p>
                  </div>
                  <div className="stat-item">
                    <h3>整正前 平均σ</h3>
                    <p><strong>{overallMetrics.avgSigmaBefore.toFixed(2)}</strong>mm</p>
                  </div>
                  <div className="stat-item">
                    <h3>整正後 平均σ</h3>
                    <p><strong>{overallMetrics.avgSigmaAfter.toFixed(2)}</strong>mm</p>
                  </div>
                  <div className="stat-item">
                    <h3>品質等級</h3>
                    <p><strong>{overallMetrics.qualityGrade}</strong></p>
                  </div>
                </div>

                <div className="quality-indicator">
                  {overallMetrics.totalImprovement >= 30 ? (
                    <div className="quality-good">
                      良好 - 整正効果が十分に得られています
                    </div>
                  ) : overallMetrics.totalImprovement >= 20 ? (
                    <div className="quality-warning">
                      要注意 - 一部区間で改善の余地があります
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      <p>整正効果が不十分です。再整正を検討してください。</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>区間別評価</h2>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>区間</th>
                        <th>整正前σ</th>
                        <th>整正後σ</th>
                        <th>良化率</th>
                        <th>標準偏差</th>
                        <th>最大値</th>
                        <th>平均値</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric, idx) => (
                        <tr key={idx}>
                          <td><strong>{metric.section}</strong></td>
                          <td>{metric.beforeSigma.toFixed(2)}mm</td>
                          <td>{metric.afterSigma.toFixed(2)}mm</td>
                          <td>
                            <span style={{ color: getQualityColor(metric.improvementRate) }}>
                              <strong>{metric.improvementRate.toFixed(1)}%</strong>
                            </span>
                          </td>
                          <td>{metric.standardDeviation.toFixed(2)}mm</td>
                          <td>{metric.maxValue.toFixed(2)}mm</td>
                          <td>{metric.avgValue.toFixed(2)}mm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="card">
          <div className="card-header">
            <h2>σ値・良化率について</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📐 σ値（標準偏差）</h3>
              <ul>
                <li>軌道狂いのばらつきを示す統計量</li>
                <li>σ値が小さいほど軌道の品質が高い</li>
                <li>整正後のσ値で軌道の平滑性を評価</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>📊 良化率の計算式</h3>
              <p style={{ textAlign: 'center', fontSize: '16px', margin: '12px 0' }}>
                <strong>良化率 = (整正前σ - 整正後σ) / 整正前σ × 100 (%)</strong>
              </p>
            </div>

            <div className="info-box">
              <h3>🎯 品質判定基準</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>良化率 30%以上</td>
                    <td><span style={{ color: '#28a745' }}>優良</span></td>
                  </tr>
                  <tr>
                    <td>良化率 20-30%</td>
                    <td><span style={{ color: '#ffc107' }}>良好</span></td>
                  </tr>
                  <tr>
                    <td>良化率 20%未満</td>
                    <td><span style={{ color: '#dc3545' }}>要改善</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="warning-box">
              <h3>⚠️ 評価時の注意</h3>
              <ul>
                <li>区間の特性（曲線部、構造物等）を考慮</li>
                <li>気象条件や作業条件の影響を確認</li>
                <li>経年変化の追跡が重要</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Export
          label="品質レポート出力"
          onClick={exportQualityReport}
          disabled={metrics.length === 0}
        />
      </div>
    </div>
  );
};

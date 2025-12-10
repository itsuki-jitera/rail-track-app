/**
 * 整備前後比較ページ
 * PDF P28-29の仕様に基づく実装
 * 軌道整備前後のデータを比較・評価
 */

import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { PresetButtons, StandardButton } from '../components/StandardButton';
import './PageStyles.css';

// Chart.jsのコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ComparisonData {
  position: number[];
  beforeData: {
    leveling: number[];
    lining: number[];
    sigma: number;
    maxDeviation: number;
  };
  afterData: {
    leveling: number[];
    lining: number[];
    sigma: number;
    maxDeviation: number;
  };
  improvementRate: number;
}

export const BeforeAfterPage: React.FC = () => {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [selectedSection, setSelectedSection] = useState({
    start: 0,
    end: 1000
  });
  const [displayMode, setDisplayMode] = useState<'overlay' | 'sideBySide'>('overlay');
  const [showStatistics, setShowStatistics] = useState(true);

  useEffect(() => {
    loadComparisonData();
  }, [selectedSection]);

  const loadComparisonData = async () => {
    try {
      const response = await fetch(`/api/analysis/before-after?start=${selectedSection.start}&end=${selectedSection.end}`);
      const data = await response.json();
      if (data.success) {
        setComparisonData(data.data);
      }
    } catch (error) {
      console.error('データ読込エラー:', error);
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '軌道狂い前後比較'
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '位置 (m)'
        }
      },
      y: {
        title: {
          display: true,
          text: '軌道狂い (mm)'
        }
      }
    }
  };

  const levelingChartData = {
    labels: comparisonData?.position || [],
    datasets: [
      {
        label: '整備前（レベリング）',
        data: comparisonData?.beforeData.leveling || [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5]
      },
      {
        label: '整備後（レベリング）',
        data: comparisonData?.afterData.leveling || [],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.1)'
      }
    ]
  };

  const liningChartData = {
    labels: comparisonData?.position || [],
    datasets: [
      {
        label: '整備前（ライニング）',
        data: comparisonData?.beforeData.lining || [],
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [5, 5]
      },
      {
        label: '整備後（ライニング）',
        data: comparisonData?.afterData.lining || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)'
      }
    ]
  };

  const exportReport = async () => {
    try {
      const response = await fetch('/api/export/comparison-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: selectedSection,
          data: comparisonData
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `比較レポート_${selectedSection.start}-${selectedSection.end}m.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('レポート出力エラー:', error);
      alert('レポート出力に失敗しました');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔄 整備前後比較</h1>
        <p>軌道整備前後のデータを比較・評価します（PDF P28-29準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>比較区間設定</h2>
          </div>
          <div className="card-body">
            <div className="form-inline">
              <div className="form-group">
                <label>開始位置 (m)</label>
                <input
                  type="number"
                  value={selectedSection.start}
                  onChange={(e) => setSelectedSection({
                    ...selectedSection,
                    start: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>終了位置 (m)</label>
                <input
                  type="number"
                  value={selectedSection.end}
                  onChange={(e) => setSelectedSection({
                    ...selectedSection,
                    end: Number(e.target.value)
                  })}
                />
              </div>

              <StandardButton
                label="データ読込"
                icon="📊"
                type="primary"
                onClick={loadComparisonData}
              />
            </div>

            <div className="form-group mt-3">
              <label>表示モード</label>
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as 'overlay' | 'sideBySide')}
              >
                <option value="overlay">重ね表示</option>
                <option value="sideBySide">並列表示</option>
              </select>
            </div>
          </div>
        </div>

        {comparisonData && showStatistics && (
          <div className="card">
            <div className="card-header">
              <h2>統計情報</h2>
            </div>
            <div className="card-body">
              <div className="stats-grid">
                <div className="stat-item">
                  <h3>整備前</h3>
                  <p>σ値: <strong>{comparisonData.beforeData.sigma.toFixed(2)}mm</strong></p>
                  <p>最大偏差: <strong>{comparisonData.beforeData.maxDeviation.toFixed(1)}mm</strong></p>
                </div>

                <div className="stat-item">
                  <h3>整備後</h3>
                  <p>σ値: <strong>{comparisonData.afterData.sigma.toFixed(2)}mm</strong></p>
                  <p>最大偏差: <strong>{comparisonData.afterData.maxDeviation.toFixed(1)}mm</strong></p>
                </div>

                <div className="stat-item highlight">
                  <h3>改善効果</h3>
                  <p>良化率: <strong className="improvement-rate">
                    {comparisonData.improvementRate.toFixed(1)}%
                  </strong></p>
                  <p>σ値改善: <strong>
                    {(comparisonData.beforeData.sigma - comparisonData.afterData.sigma).toFixed(2)}mm
                  </strong></p>
                </div>
              </div>

              <div className="quality-indicator">
                {comparisonData.improvementRate >= 40 ? (
                  <div className="quality-good">
                    ✅ 目標良化率40%を達成しています
                  </div>
                ) : (
                  <div className="quality-warning">
                    ⚠️ 良化率が目標の40%未満です
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>レベリング比較</h2>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Line options={chartOptions} data={levelingChartData} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>ライニング比較</h2>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Line options={chartOptions} data={liningChartData} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>改善区間分析</h2>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>区間</th>
                    <th>整備前σ値</th>
                    <th>整備後σ値</th>
                    <th>良化率</th>
                    <th>評価</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>0-200m</td>
                    <td>3.2mm</td>
                    <td>1.8mm</td>
                    <td>43.8%</td>
                    <td>良好</td>
                  </tr>
                  <tr>
                    <td>200-400m</td>
                    <td>2.8mm</td>
                    <td>1.6mm</td>
                    <td>42.9%</td>
                    <td>良好</td>
                  </tr>
                  <tr>
                    <td>400-600m</td>
                    <td>3.5mm</td>
                    <td>2.2mm</td>
                    <td>37.1%</td>
                    <td>要注意</td>
                  </tr>
                  <tr>
                    <td>600-800m</td>
                    <td>2.9mm</td>
                    <td>1.5mm</td>
                    <td>48.3%</td>
                    <td>優良</td>
                  </tr>
                  <tr>
                    <td>800-1000m</td>
                    <td>3.1mm</td>
                    <td>1.7mm</td>
                    <td>45.2%</td>
                    <td>良好</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>評価基準</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📊 良化率の判定基準</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>優良:</td>
                    <td>45%以上</td>
                  </tr>
                  <tr>
                    <td>良好:</td>
                    <td>40%以上45%未満</td>
                  </tr>
                  <tr>
                    <td>要注意:</td>
                    <td>35%以上40%未満</td>
                  </tr>
                  <tr>
                    <td>不良:</td>
                    <td>35%未満</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="info-box">
              <h3>📌 σ値の目標値</h3>
              <ul>
                <li>新幹線: 1.5mm以下</li>
                <li>在来線（特急）: 2.0mm以下</li>
                <li>在来線（普通）: 2.5mm以下</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Export onClick={exportReport} label="比較レポート出力" />
      </div>
    </div>
  );
};
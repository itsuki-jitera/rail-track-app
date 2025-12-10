/**
 * 縦曲線設定ページ
 * PDF P24-26の仕様に基づく実装
 * 縦断線形（勾配・縦曲線）の設定
 */

import React, { useState } from 'react';
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

interface VerticalCurve {
  id: string;
  startPos: number;
  endPos: number;
  type: 'crest' | 'sag';
  radius: number;
  startGradient: number;
  endGradient: number;
  vcl: number; // 縦曲線長
  vcPosition: number; // 縦曲線中心位置
}

interface GradientSection {
  startPos: number;
  endPos: number;
  gradient: number;
  description: string;
}

export const VerticalCurvePage: React.FC = () => {
  const [verticalCurves, setVerticalCurves] = useState<VerticalCurve[]>([]);
  const [gradientSections, setGradientSections] = useState<GradientSection[]>([]);
  const [profileData, setProfileData] = useState<any>(null);

  const [newCurve, setNewCurve] = useState<Partial<VerticalCurve>>({
    startPos: 0,
    endPos: 0,
    type: 'crest',
    radius: 10000,
    startGradient: 0,
    endGradient: 0
  });

  const [newGradient, setNewGradient] = useState<GradientSection>({
    startPos: 0,
    endPos: 0,
    gradient: 0,
    description: ''
  });

  const addVerticalCurve = () => {
    if (!newCurve.startPos || !newCurve.endPos || newCurve.startPos >= newCurve.endPos) {
      alert('縦曲線の区間を正しく設定してください');
      return;
    }

    const vcl = newCurve.endPos! - newCurve.startPos!;
    const vcPosition = (newCurve.startPos! + newCurve.endPos!) / 2;

    const curve: VerticalCurve = {
      id: `VC-${Date.now()}`,
      startPos: newCurve.startPos!,
      endPos: newCurve.endPos!,
      type: newCurve.type as 'crest' | 'sag',
      radius: newCurve.radius!,
      startGradient: newCurve.startGradient!,
      endGradient: newCurve.endGradient!,
      vcl,
      vcPosition
    };

    setVerticalCurves([...verticalCurves, curve]);
    setNewCurve({
      startPos: 0,
      endPos: 0,
      type: 'crest',
      radius: 10000,
      startGradient: 0,
      endGradient: 0
    });
  };

  const addGradientSection = () => {
    if (newGradient.startPos >= newGradient.endPos) {
      alert('勾配区間を正しく設定してください');
      return;
    }

    setGradientSections([...gradientSections, { ...newGradient }]);
    setNewGradient({
      startPos: 0,
      endPos: 0,
      gradient: 0,
      description: ''
    });
  };

  const removeVerticalCurve = (id: string) => {
    setVerticalCurves(verticalCurves.filter(vc => vc.id !== id));
  };

  const removeGradientSection = (index: number) => {
    setGradientSections(gradientSections.filter((_, i) => i !== index));
  };

  const calculateProfile = async () => {
    try {
      const response = await fetch('/api/vertical-profile/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curves: verticalCurves,
          gradients: gradientSections
        })
      });

      const result = await response.json();
      if (result.success) {
        setProfileData(result.data);
        alert('縦断線形の計算が完了しました');
      }
    } catch (error) {
      console.error('計算エラー:', error);
      alert('縦断線形の計算に失敗しました');
    }
  };

  const saveVerticalProfile = async () => {
    try {
      const response = await fetch('/api/vertical-profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curves: verticalCurves,
          gradients: gradientSections,
          profile: profileData
        })
      });

      if (response.ok) {
        alert('縦曲線設定を保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const chartData = profileData ? {
    labels: profileData.positions,
    datasets: [
      {
        label: '計画高',
        data: profileData.elevations,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)'
      },
      {
        label: '勾配',
        data: profileData.gradients,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        yAxisID: 'y1'
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '縦断線形'
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
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: '標高 (m)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '勾配 (‰)'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📉 縦曲線設定</h1>
        <p>縦断線形（勾配・縦曲線）を設定します（PDF P24-26準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>勾配区間設定</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>開始位置 (m)</label>
                <input
                  type="number"
                  value={newGradient.startPos}
                  onChange={(e) => setNewGradient({
                    ...newGradient,
                    startPos: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>終了位置 (m)</label>
                <input
                  type="number"
                  value={newGradient.endPos}
                  onChange={(e) => setNewGradient({
                    ...newGradient,
                    endPos: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>勾配 (‰)</label>
                <input
                  type="number"
                  value={newGradient.gradient}
                  onChange={(e) => setNewGradient({
                    ...newGradient,
                    gradient: Number(e.target.value)
                  })}
                  step="0.1"
                  min="-35"
                  max="35"
                />
                <small>上り勾配は正、下り勾配は負で入力</small>
              </div>

              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={newGradient.description}
                  onChange={(e) => setNewGradient({
                    ...newGradient,
                    description: e.target.value
                  })}
                  placeholder="例: 駅進入部、橋梁区間"
                />
              </div>
            </div>

            <PresetButtons.Add onClick={addGradientSection} label="勾配区間を追加" />

            {gradientSections.length > 0 && (
              <div className="mt-3">
                <h3>設定済み勾配区間</h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>区間</th>
                        <th>勾配</th>
                        <th>説明</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradientSections.map((section, index) => (
                        <tr key={index}>
                          <td>{section.startPos}-{section.endPos}m</td>
                          <td>{section.gradient}‰</td>
                          <td>{section.description || '-'}</td>
                          <td>
                            <PresetButtons.Delete
                              onClick={() => removeGradientSection(index)}
                              size="small"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>縦曲線設定</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>開始位置 (m)</label>
                <input
                  type="number"
                  value={newCurve.startPos}
                  onChange={(e) => setNewCurve({
                    ...newCurve,
                    startPos: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>終了位置 (m)</label>
                <input
                  type="number"
                  value={newCurve.endPos}
                  onChange={(e) => setNewCurve({
                    ...newCurve,
                    endPos: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>縦曲線タイプ</label>
                <select
                  value={newCurve.type}
                  onChange={(e) => setNewCurve({
                    ...newCurve,
                    type: e.target.value as 'crest' | 'sag'
                  })}
                >
                  <option value="crest">クレスト（凸）</option>
                  <option value="sag">サグ（凹）</option>
                </select>
              </div>

              <div className="form-group">
                <label>縦曲線半径 (m)</label>
                <input
                  type="number"
                  value={newCurve.radius}
                  onChange={(e) => setNewCurve({
                    ...newCurve,
                    radius: Number(e.target.value)
                  })}
                  min="5000"
                  max="30000"
                />
                <small>標準: 10,000m（新幹線）、5,000m（在来線）</small>
              </div>

              <div className="form-group">
                <label>始端勾配 (‰)</label>
                <input
                  type="number"
                  value={newCurve.startGradient}
                  onChange={(e) => setNewCurve({
                    ...newCurve,
                    startGradient: Number(e.target.value)
                  })}
                  step="0.1"
                />
              </div>

              <div className="form-group">
                <label>終端勾配 (‰)</label>
                <input
                  type="number"
                  value={newCurve.endGradient}
                  onChange={(e) => setNewCurve({
                    ...newCurve,
                    endGradient: Number(e.target.value)
                  })}
                  step="0.1"
                />
              </div>
            </div>

            <PresetButtons.Add onClick={addVerticalCurve} label="縦曲線を追加" />

            {verticalCurves.length > 0 && (
              <div className="mt-3">
                <h3>設定済み縦曲線</h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>区間</th>
                        <th>タイプ</th>
                        <th>半径</th>
                        <th>縦曲線長</th>
                        <th>勾配変化</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verticalCurves.map((curve) => (
                        <tr key={curve.id}>
                          <td>{curve.startPos}-{curve.endPos}m</td>
                          <td>{curve.type === 'crest' ? 'クレスト' : 'サグ'}</td>
                          <td>{curve.radius}m</td>
                          <td>{curve.vcl.toFixed(1)}m</td>
                          <td>{curve.startGradient}‰→{curve.endGradient}‰</td>
                          <td>
                            <PresetButtons.Delete
                              onClick={() => removeVerticalCurve(curve.id)}
                              size="small"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {(gradientSections.length > 0 || verticalCurves.length > 0) && (
          <div className="card">
            <div className="card-header">
              <h2>縦断線形計算</h2>
            </div>
            <div className="card-body">
              <PresetButtons.Calculate onClick={calculateProfile} label="縦断線形を計算" />

              {profileData && chartData && (
                <div className="chart-container mt-3">
                  <Line options={chartOptions} data={chartData} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>縦曲線設定の基準値</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📐 縦曲線半径の標準値</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>新幹線（標準）:</td>
                    <td>10,000m以上</td>
                  </tr>
                  <tr>
                    <td>新幹線（最小）:</td>
                    <td>5,000m</td>
                  </tr>
                  <tr>
                    <td>在来線（標準）:</td>
                    <td>5,000m以上</td>
                  </tr>
                  <tr>
                    <td>在来線（最小）:</td>
                    <td>2,000m</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="info-box">
              <h3>📊 勾配の制限値</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>新幹線最大勾配:</td>
                    <td>15‰（特例20‰）</td>
                  </tr>
                  <tr>
                    <td>在来線最大勾配:</td>
                    <td>25‰（特例35‰）</td>
                  </tr>
                  <tr>
                    <td>駅構内:</td>
                    <td>原則水平（最大3‰）</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="warning-box">
              <h3>⚠️ 設計時の注意</h3>
              <ul>
                <li>縦曲線と平面曲線の競合を避ける</li>
                <li>トンネル内はサグカーブを避ける（排水のため）</li>
                <li>橋梁区間では縦曲線を避ける</li>
                <li>駅進入部は必ず緩勾配とする</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Save
          onClick={saveVerticalProfile}
          disabled={!profileData}
          label="縦曲線設定を保存"
        />
      </div>
    </div>
  );
};
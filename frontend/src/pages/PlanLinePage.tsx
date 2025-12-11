/**
 * 計画線設定ページ
 * PDF P12-14の仕様に基づく実装
 * 軌道整正の目標となる計画線を設定
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
import { InteractiveChart } from '../components/InteractiveChart';
import { AdvancedPlanLineEditor } from '../components/AdvancedPlanLineEditor';
import { FullscreenPlanLineEditor } from '../components/FullscreenPlanLineEditor';
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

interface PlanLinePoint {
  position: number;
  targetLevel: number;
  targetAlignment: number;
}

interface PlanLineSection {
  startPos: number;
  endPos: number;
  type: 'straight' | 'curve' | 'transition';
  radius?: number;
  cant?: number;
  gradient?: number;
}

export const PlanLinePage: React.FC = () => {
  // サンプルデータを初期値として設定
  const samplePlanPoints: PlanLinePoint[] = [
    { position: 0, targetLevel: 0, targetAlignment: 0 },
    { position: 50, targetLevel: 5, targetAlignment: 2 },
    { position: 100, targetLevel: 10, targetAlignment: 5 },
    { position: 150, targetLevel: 12, targetAlignment: 3 },
    { position: 200, targetLevel: 15, targetAlignment: -2 },
    { position: 250, targetLevel: 13, targetAlignment: -5 },
    { position: 300, targetLevel: 10, targetAlignment: -3 },
    { position: 350, targetLevel: 8, targetAlignment: 0 },
    { position: 400, targetLevel: 5, targetAlignment: 2 },
    { position: 450, targetLevel: 3, targetAlignment: 3 },
    { position: 500, targetLevel: 0, targetAlignment: 0 }
  ];

  const [planPoints, setPlanPoints] = useState<PlanLinePoint[]>(samplePlanPoints);
  const [sections, setSections] = useState<PlanLineSection[]>([
    { startPos: 0, endPos: 100, type: 'straight', gradient: 10 },
    { startPos: 100, endPos: 200, type: 'curve', radius: 600, cant: 50, gradient: 5 },
    { startPos: 200, endPos: 300, type: 'transition', gradient: -5 },
    { startPos: 300, endPos: 500, type: 'straight', gradient: -10 }
  ]);
  const [calculationMethod, setCalculationMethod] = useState<'convex' | 'spline' | 'linear'>('convex');
  const [smoothingFactor, setSmoothingFactor] = useState(0.5);

  // 編集モード用の状態
  const [editMode, setEditMode] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [editingPoint, setEditingPoint] = useState<PlanLinePoint | null>(null);

  const [newSection, setNewSection] = useState<PlanLineSection>({
    startPos: 0,
    endPos: 0,
    type: 'straight',
    radius: undefined,
    cant: undefined,
    gradient: 0
  });

  const addSection = () => {
    if (newSection.startPos >= newSection.endPos) {
      alert('終了位置は開始位置より後に設定してください');
      return;
    }

    setSections([...sections, { ...newSection }]);
    setNewSection({
      startPos: 0,
      endPos: 0,
      type: 'straight',
      radius: undefined,
      cant: undefined,
      gradient: 0
    });
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const calculatePlanLine = async () => {
    try {
      const response = await fetch('/api/plan-line/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections,
          method: calculationMethod,
          smoothingFactor
        })
      });

      const result = await response.json();
      if (result.success) {
        setPlanPoints(result.data);
        alert('計画線の計算が完了しました');
      }
    } catch (error) {
      console.error('計算エラー:', error);
      alert('計画線の計算に失敗しました');
    }
  };

  // 計画線の点を編集
  const handlePointEdit = (index: number) => {
    setSelectedPointIndex(index);
    setEditingPoint({ ...planPoints[index] });
    setEditMode(true);
  };

  // 編集した点を適用
  const applyPointEdit = () => {
    if (selectedPointIndex !== null && editingPoint) {
      const newPoints = [...planPoints];
      newPoints[selectedPointIndex] = editingPoint;
      setPlanPoints(newPoints);
      setEditMode(false);
      setSelectedPointIndex(null);
      setEditingPoint(null);
    }
  };

  // 編集をキャンセル
  const cancelEdit = () => {
    setEditMode(false);
    setSelectedPointIndex(null);
    setEditingPoint(null);
  };

  const savePlanLine = async () => {
    try {
      const response = await fetch('/api/plan-line/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: planPoints,
          sections,
          method: calculationMethod
        })
      });

      if (response.ok) {
        alert('計画線設定を保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const chartData = {
    labels: planPoints.map(p => p.position),
    datasets: [
      {
        label: '計画線（レベル）',
        data: planPoints.map(p => p.targetLevel),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        yAxisID: 'y'
      },
      {
        label: '計画線（通り）',
        data: planPoints.map(p => p.targetAlignment),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '計画線プレビュー'
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
          text: 'レベル (mm)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '通り (mm)'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  // 統合型エディタでの保存処理
  const handleEditorSave = (savedData: any[]) => {
    setPlanPoints(savedData);
    savePlanLine();
  };

  return (
    <div className="page-container" style={{ position: 'relative', overflow: 'auto', height: '100vh' }}>
      <div className="page-header">
        <h1>📈 計画線設定</h1>
        <p>軌道整正の目標となる計画線を設定します（PDF P17-20準拠）</p>
      </div>

      {/* フルスクリーン統合型エディタ（すべての機能を含む） */}
      <div style={{ height: 'calc(100vh - 200px)', margin: '20px 0' }}>
        <FullscreenPlanLineEditor
          initialData={planPoints}
          onSave={handleEditorSave}
        />
      </div>

      {/* 既存の設定セクション（折りたたみ可能） - 固定位置フローティングボタン */}
      <details style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: 'auto',
        maxWidth: '90vw',
        zIndex: 1000,
        background: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <summary style={{
          cursor: 'pointer',
          padding: '14px 24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '12px',
          fontWeight: 'bold',
          fontSize: '15px',
          textAlign: 'center',
          transition: 'all 0.3s',
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
        }}>
          📋 詳細設定（オプション）
        </summary>
      <div className="content-grid" style={{
        marginTop: '20px',
        maxHeight: '70vh',
        overflowY: 'auto',
        padding: '20px',
        background: 'white',
        borderRadius: '0 0 12px 12px'
      }}>
        {/* 編集パネル（統合型エディタ使用時は非表示） */}
        {editMode && editingPoint && (
          <div className="card" style={{ background: '#fffbf0', border: '2px solid #ffa500' }}>
            <div className="card-header">
              <h2>🖊️ 計画線の点を編集中</h2>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>位置 (m)</label>
                  <input
                    type="number"
                    value={editingPoint.position}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                  <small>※ 位置は変更できません</small>
                </div>

                <div className="form-group">
                  <label>目標レベル (mm)</label>
                  <input
                    type="number"
                    value={editingPoint.targetLevel}
                    onChange={(e) => setEditingPoint({
                      ...editingPoint,
                      targetLevel: Number(e.target.value)
                    })}
                    step="1"
                  />
                </div>

                <div className="form-group">
                  <label>目標通り (mm)</label>
                  <input
                    type="number"
                    value={editingPoint.targetAlignment}
                    onChange={(e) => setEditingPoint({
                      ...editingPoint,
                      targetAlignment: Number(e.target.value)
                    })}
                    step="1"
                  />
                </div>
              </div>

              <div className="action-buttons">
                <PresetButtons.Save onClick={applyPointEdit} label="適用" />
                <StandardButton
                  label="キャンセル"
                  onClick={cancelEdit}
                  type="secondary"
                />
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>計算方法設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>計画線計算方法</label>
              <select
                value={calculationMethod}
                onChange={(e) => setCalculationMethod(e.target.value as 'convex' | 'spline' | 'linear')}
              >
                <option value="convex">凸型計画線（標準）</option>
                <option value="spline">スプライン補間</option>
                <option value="linear">線形補間</option>
              </select>
            </div>

            {calculationMethod === 'convex' && (
              <div className="info-box">
                <p>📌 凸型計画線は、軌道狂いを上方向に修正する際に使用される標準的な方法です。</p>
                <p>下方向への修正を最小限に抑え、道床への負荷を軽減します。</p>
              </div>
            )}

            <div className="form-group">
              <label>平滑化係数</label>
              <input
                type="number"
                value={smoothingFactor}
                onChange={(e) => setSmoothingFactor(Number(e.target.value))}
                min="0"
                max="1"
                step="0.1"
              />
              <small>0（平滑化なし）～ 1（最大平滑化）</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>区間設定</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>開始位置 (m)</label>
                <input
                  type="number"
                  value={newSection.startPos}
                  onChange={(e) => setNewSection({
                    ...newSection,
                    startPos: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>終了位置 (m)</label>
                <input
                  type="number"
                  value={newSection.endPos}
                  onChange={(e) => setNewSection({
                    ...newSection,
                    endPos: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>区間タイプ</label>
                <select
                  value={newSection.type}
                  onChange={(e) => setNewSection({
                    ...newSection,
                    type: e.target.value as 'straight' | 'curve' | 'transition'
                  })}
                >
                  <option value="straight">直線</option>
                  <option value="curve">曲線</option>
                  <option value="transition">緩和曲線</option>
                </select>
              </div>

              {newSection.type === 'curve' && (
                <>
                  <div className="form-group">
                    <label>曲線半径 (m)</label>
                    <input
                      type="number"
                      value={newSection.radius || ''}
                      onChange={(e) => setNewSection({
                        ...newSection,
                        radius: Number(e.target.value)
                      })}
                      placeholder="例: 600"
                    />
                  </div>

                  <div className="form-group">
                    <label>カント (mm)</label>
                    <input
                      type="number"
                      value={newSection.cant || ''}
                      onChange={(e) => setNewSection({
                        ...newSection,
                        cant: Number(e.target.value)
                      })}
                      placeholder="例: 105"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>縦断勾配 (‰)</label>
                <input
                  type="number"
                  value={newSection.gradient || 0}
                  onChange={(e) => setNewSection({
                    ...newSection,
                    gradient: Number(e.target.value)
                  })}
                  step="0.1"
                  placeholder="例: 15.0"
                />
              </div>
            </div>

            <PresetButtons.Add onClick={addSection} label="区間を追加" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>設定済み区間</h2>
          </div>
          <div className="card-body">
            {sections.length === 0 ? (
              <p className="text-muted">区間が設定されていません</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>区間</th>
                      <th>タイプ</th>
                      <th>半径</th>
                      <th>カント</th>
                      <th>勾配</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section, index) => (
                      <tr key={index}>
                        <td>{section.startPos}-{section.endPos}m</td>
                        <td>
                          {section.type === 'straight' ? '直線' :
                           section.type === 'curve' ? '曲線' : '緩和曲線'}
                        </td>
                        <td>{section.radius ? `${section.radius}m` : '-'}</td>
                        <td>{section.cant ? `${section.cant}mm` : '-'}</td>
                        <td>{section.gradient}‰</td>
                        <td>
                          <PresetButtons.Delete
                            onClick={() => removeSection(index)}
                            size="small"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sections.length > 0 && (
              <PresetButtons.Calculate onClick={calculatePlanLine} label="計画線を計算" />
            )}
          </div>
        </div>

        {/* 計画線プレビューとデータ表示 */}
        {planPoints.length > 0 && (
          <>
            <div className="card">
              <div className="card-header">
                <h2>🎯 インタラクティブ計画線エディタ</h2>
              </div>
              <div className="card-body">
                <InteractiveChart
                  data={planPoints}
                  onDataChange={setPlanPoints}
                  height={400}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>計画線データ編集</h2>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>位置 (m)</th>
                        <th>目標レベル (mm)</th>
                        <th>目標通り (mm)</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planPoints.map((point, index) => (
                        <tr key={index}
                            style={selectedPointIndex === index ?
                              { backgroundColor: '#fff3cd' } : {}}>
                          <td>{point.position}</td>
                          <td>{point.targetLevel}</td>
                          <td>{point.targetAlignment}</td>
                          <td>
                            <StandardButton
                              label="編集"
                              onClick={() => handlePointEdit(index)}
                              size="small"
                              type="primary"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="info-box" style={{ marginTop: '20px' }}>
                  <h3>💡 編集のヒント</h3>
                  <ul>
                    <li>「編集」ボタンをクリックして、その点の値を変更できます</li>
                    <li>レベル値を増やすと線路を上げ、減らすと下げます</li>
                    <li>通り値を増やすと右に、減らすと左に移動します</li>
                    <li>変更は少しずつ（5mm程度）行うことをお勧めします</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="card">
          <div className="card-header">
            <h2>計画線設定の注意事項</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📐 曲線諸元の標準値</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>新幹線最小半径:</td>
                    <td>2,500m（本線）</td>
                  </tr>
                  <tr>
                    <td>在来線最小半径:</td>
                    <td>600m（本線）</td>
                  </tr>
                  <tr>
                    <td>最大カント:</td>
                    <td>200mm（新幹線）、105mm（在来線）</td>
                  </tr>
                  <tr>
                    <td>最大勾配:</td>
                    <td>15‰（新幹線）、25‰（在来線）</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="warning-box">
              <h3>⚠️ 設定時の注意</h3>
              <ul>
                <li>緩和曲線区間は必ず設定してください</li>
                <li>カント逓減は規定値以下にしてください</li>
                <li>構造物境界での急激な変化は避けてください</li>
                <li>縦曲線と平面曲線の競合に注意してください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      </details>

      {/* 保存ボタンは統合型エディタ内に含まれるため不要 */}
    </div>
  );
};
/**
 * 計画線設定ページ
 * PDF P12-14の仕様に基づく実装
 * 軌道整正の目標となる計画線を設定
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
import { InteractiveChart } from '../components/InteractiveChart';
import { AdvancedPlanLineEditor } from '../components/AdvancedPlanLineEditor';
import { FullscreenPlanLineEditor } from '../components/FullscreenPlanLineEditor';
import { useGlobalWorkspace, workspaceSelectors } from '../contexts/GlobalWorkspaceContext';
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
  // グローバル状態を使用
  const { state, dispatch, canSetPlanLine, getNextRequiredStep } = useGlobalWorkspace();

  // グローバル状態からデータを取得
  const restoredWaveform = workspaceSelectors.getRestoredWaveform(state);
  const existingPlanLine = workspaceSelectors.getPlanLine(state);
  const isReadyForPlanLine = workspaceSelectors.isReadyForPlanLine(state);

  // 実データが読み込まれるまで空配列で初期化（既存の計画線があれば使用）
  const [planPoints, setPlanPoints] = useState<PlanLinePoint[]>([]);
  const [sections, setSections] = useState<PlanLineSection[]>([]);

  // 計算方法設定
  const [calculationMethod, setCalculationMethod] = useState<'convex' | 'spline' | 'linear'>('convex');
  const [smoothingFactor, setSmoothingFactor] = useState(0.5);

  // グローバル状態から復元波形データを取得して初期化
  useEffect(() => {
    if (restoredWaveform && restoredWaveform.positions && restoredWaveform.positions.length > 0) {
      // 復元波形データから初期計画線を生成
      const initialPoints: PlanLinePoint[] = [];

      // データの全長を計算
      const totalLength = restoredWaveform.positions[restoredWaveform.positions.length - 1] - restoredWaveform.positions[0];

      // 全長に応じてサンプリング間隔を調整
      let interval: number;
      if (totalLength <= 100) {
        interval = 1;  // 100m以下：0.25m間隔（全データ）
      } else if (totalLength <= 500) {
        interval = 4;  // 500m以下：1m間隔
      } else if (totalLength <= 1000) {
        interval = 10; // 1km以下：2.5m間隔
      } else if (totalLength <= 5000) {
        interval = 20; // 5km以下：5m間隔
      } else {
        interval = 40; // 5km超：10m間隔
      }

      for (let i = 0; i < restoredWaveform.positions.length; i += interval) {
        initialPoints.push({
          position: restoredWaveform.positions[i],
          targetLevel: restoredWaveform.level[i] || 0,
          targetAlignment: restoredWaveform.alignment[i] || 0,
        });
      }

      console.log(`計画線データを生成: ${initialPoints.length}点（元データ: ${restoredWaveform.positions.length}点）`);
      console.log(`全長: ${totalLength.toFixed(1)}m, サンプリング: ${interval * 0.25}m間隔`);
      setPlanPoints(initialPoints);
    } else if (existingPlanLine && existingPlanLine.positions) {
      // 既存の計画線データがあれば使用
      const points: PlanLinePoint[] = existingPlanLine.positions.map((pos, idx) => ({
        position: pos,
        targetLevel: existingPlanLine.targetLevel[idx],
        targetAlignment: existingPlanLine.targetAlignment[idx],
      }));
      setPlanPoints(points);
    }
  }, [restoredWaveform, existingPlanLine]);

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
      // APIコールをスキップして直接グローバル状態に保存
      // （バックエンドAPIが未実装の可能性があるため）

      // グローバル状態に計画線を保存
      dispatch({
        type: 'SET_PLAN_LINE',
        payload: {
          positions: planPoints.map(p => p.position),
          targetLevel: planPoints.map(p => p.targetLevel),
          targetAlignment: planPoints.map(p => p.targetAlignment),
          fixedPoints: [],
          method: calculationMethod,
        }
      });

      console.log('計画線を保存しました:', {
        点数: planPoints.length,
        メソッド: calculationMethod
      });

      alert('計画線設定を保存しました');

      // オプション：ローカルストレージにも保存
      localStorage.setItem('planLine', JSON.stringify({
        points: planPoints,
        sections,
        method: calculationMethod,
        savedAt: new Date().toISOString()
      }));

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

      {/* データ未読込時の警告表示 */}
      {!isReadyForPlanLine && (
        <div className="warning-box" style={{
          margin: '20px',
          padding: '30px',
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px'
        }}>
          <h3>⚠️ 作業を開始する前に</h3>
          <p>計画線を設定するには、以下の手順で作業を進めてください：</p>
          <ol style={{ lineHeight: '2em' }}>
            <li style={{ fontWeight: state.status.dataLoaded ? 'normal' : 'bold', color: state.status.dataLoaded ? '#28a745' : '#000' }}>
              {state.status.dataLoaded ? '✓' : '•'} <strong>「🚃 キヤデータ読込」</strong>でMTTデータをアップロード（ファイル名は先頭「X」で6文字）
            </li>
            <li style={{ fontWeight: state.status.sectionCut ? 'normal' : 'bold', color: state.status.sectionCut ? '#28a745' : '#000' }}>
              {state.status.sectionCut ? '✓' : '•'} <strong>「📍 作業区間設定」</strong>で必要区間を切り取り（前後500m以上余分に切取）
            </li>
            <li><strong>「📐 曲線諸元設定」</strong>で曲線データを入力（曲線区間がある場合）</li>
            <li><strong>「⚠️ 移動量制限」</strong>で制限箇所を設定</li>
            <li><strong>「📏 手検測入力」</strong>で手検測データを入力（必要に応じて）</li>
            <li style={{ fontWeight: state.status.waveformCalculated ? 'normal' : 'bold', color: state.status.waveformCalculated ? '#28a745' : '#000' }}>
              {state.status.waveformCalculated ? '✓' : '•'} <strong>「⚙️ 復元波形計算」</strong>を実行
            </li>
            <li>その後、<strong>計画線を設定</strong>できるようになります</li>
          </ol>
          {getNextRequiredStep() && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#fff3e0', borderRadius: '6px' }}>
              <strong>🔔 次の作業：</strong> {getNextRequiredStep()}
            </div>
          )}
          <div style={{ marginTop: '20px', padding: '15px', background: '#e7f3ff', borderRadius: '6px' }}>
            <strong>💡 ヒント：</strong>
            <ul style={{ marginTop: '10px' }}>
              <li>WB区間の始終点から50m以上離れた点で切取ってください</li>
              <li>作業開始・終了地点はW区間を避けてください</li>
              <li>水準狂いとカントを重ね合わせて位置合わせを正確に行ってください</li>
            </ul>
          </div>
        </div>
      )}

      {/* フルスクリーン統合型エディタ（データがある場合のみ表示） */}
      <div style={{ height: 'calc(100vh - 200px)', margin: '20px 0' }}>
        {isReadyForPlanLine && planPoints.length > 0 ? (
          <FullscreenPlanLineEditor
            initialData={planPoints}
            onSave={handleEditorSave}
          />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ textAlign: 'center', color: '#6c757d' }}>
              <h2>📊 データ待機中</h2>
              <p>上記の手順に従って、まずは必要な作業を完了してください</p>
              {getNextRequiredStep() && (
                <div style={{ marginTop: '20px', fontSize: '1.1em', color: '#ff6b6b' }}>
                  <strong>次のステップ：</strong> {getNextRequiredStep()}
                </div>
              )}
            </div>
          </div>
        )}
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
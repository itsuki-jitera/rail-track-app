/**
 * 移動量算出ページ
 * PDF P24-26の仕様に基づく実装
 * 軌道整正に必要な移動量を算出
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import { useGlobalWorkspace, workspaceSelectors } from '../contexts/GlobalWorkspaceContext';
import './PageStyles.css';

interface MovementResult {
  distance: number;
  currentValue: number;
  targetValue: number;
  movement: number;
  priority: 'high' | 'medium' | 'low';
}

export const MovementCalcPage: React.FC = () => {
  // グローバル状態を使用
  const { state } = useGlobalWorkspace();
  const restoredWaveform = workspaceSelectors.getRestoredWaveform(state);
  const planLine = workspaceSelectors.getPlanLine(state);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<MovementResult[]>([]);
  const [settings, setSettings] = useState({
    targetType: 'plan-line',
    smoothingFactor: 0.5,
    maxMovement: 30,
    minMovement: 2,
    considerFixedPoints: true,
    considerLimits: true
  });

  const calculateMovement = async () => {
    // データチェック
    if (!planLine || !restoredWaveform) {
      alert('計画線と復元波形データが必要です。前の手順を完了してください。');
      return;
    }

    setCalculating(true);
    try {
      const response = await fetch('/api/calculate-movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planLine,
          restoredWaveform,
          correctionMode: settings.targetType,
          settings
        })
      });

      const data = await response.json();
      if (data.success) {
        // APIからの生データを処理
        const movements = data.data.movements;
        const processedResults: MovementResult[] = [];

        if (movements && movements.positions) {
          for (let i = 0; i < movements.positions.length; i++) {
            const movement = Math.abs(movements.levelMovements[i] || 0);

            // 優先度判定（5mm以上が実際の整正対象）
            let priority: 'high' | 'medium' | 'low' = 'low';
            if (movement >= 10) priority = 'high';
            else if (movement >= 5) priority = 'medium';

            processedResults.push({
              distance: movements.positions[i],
              currentValue: restoredWaveform.level?.[i] || 0,
              targetValue: planLine.targetLevel?.[i] || 0,
              movement: movements.levelMovements[i] || 0,
              priority
            });
          }
        }

        setResults(processedResults);

        // 整正が必要な箇所の集計
        const needsCorrection = processedResults.filter(r => Math.abs(r.movement) >= 5).length;
        const highPriority = processedResults.filter(r => r.priority === 'high').length;

        alert(`移動量算出完了\n総計算点数: ${processedResults.length}点\n整正必要箇所: ${needsCorrection}点\n高優先度: ${highPriority}点`);
      }
    } catch (error) {
      console.error('計算エラー:', error);
      alert('移動量算出に失敗しました');
    } finally {
      setCalculating(false);
    }
  };

  const exportMovement = () => {
    const csv = [
      ['距離(m)', '現在値(mm)', '目標値(mm)', '移動量(mm)', '優先度'],
      ...results.map(r => [
        r.distance.toFixed(1),
        r.currentValue.toFixed(1),
        r.targetValue.toFixed(1),
        r.movement.toFixed(1),
        r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movement_calc_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📐 移動量算出</h1>
        <p>軌道整正に必要な移動量を算出します（PDF P24-26準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>算出設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>目標線種別</label>
              <select
                value={settings.targetType}
                onChange={(e) => setSettings({
                  ...settings,
                  targetType: e.target.value
                })}
              >
                <option value="plan-line">計画線</option>
                <option value="smooth-curve">平滑曲線</option>
                <option value="current-optimized">現況最適化</option>
              </select>
            </div>

            <div className="form-group">
              <label>平滑化係数</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.smoothingFactor}
                onChange={(e) => setSettings({
                  ...settings,
                  smoothingFactor: Number(e.target.value)
                })}
              />
              <small>0: 厳密, 1: 最大平滑</small>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>最大移動量 (mm)</label>
                <input
                  type="number"
                  value={settings.maxMovement}
                  onChange={(e) => setSettings({
                    ...settings,
                    maxMovement: Number(e.target.value)
                  })}
                  placeholder="例: 30"
                />
              </div>

              <div className="form-group">
                <label>最小移動量 (mm)</label>
                <input
                  type="number"
                  value={settings.minMovement}
                  onChange={(e) => setSettings({
                    ...settings,
                    minMovement: Number(e.target.value)
                  })}
                  placeholder="例: 2"
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.considerFixedPoints}
                  onChange={(e) => setSettings({
                    ...settings,
                    considerFixedPoints: e.target.checked
                  })}
                />
                固定点を考慮
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.considerLimits}
                  onChange={(e) => setSettings({
                    ...settings,
                    considerLimits: e.target.checked
                  })}
                />
                移動量制限を考慮
              </label>
            </div>

            <div className="action-buttons">
              <PresetButtons.Calculate
                label="移動量を算出"
                onClick={calculateMovement}
                loading={calculating}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>算出結果</h2>
          </div>
          <div className="card-body">
            {results.length === 0 ? (
              <p className="text-muted">移動量算出を実行してください</p>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-item">
                    <h3>総計算点数</h3>
                    <p><strong>{results.length}</strong>点</p>
                  </div>
                  <div className="stat-item">
                    <h3>平均移動量</h3>
                    <p><strong>
                      {(results.reduce((sum, r) => sum + Math.abs(r.movement), 0) / results.length).toFixed(1)}
                    </strong>mm</p>
                  </div>
                  <div className="stat-item">
                    <h3>最大移動量</h3>
                    <p><strong>
                      {Math.max(...results.map(r => Math.abs(r.movement))).toFixed(1)}
                    </strong>mm</p>
                  </div>
                  <div className="stat-item">
                    <h3>高優先度箇所</h3>
                    <p><strong>
                      {results.filter(r => r.priority === 'high').length}
                    </strong>箇所</p>
                  </div>
                </div>

                <div className="table-container mt-3">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>距離(m)</th>
                        <th>現在値</th>
                        <th>目標値</th>
                        <th>移動量</th>
                        <th>優先度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.slice(0, 20).map((result, idx) => (
                        <tr key={idx}>
                          <td>{result.distance.toFixed(1)}</td>
                          <td>{result.currentValue.toFixed(1)}mm</td>
                          <td>{result.targetValue.toFixed(1)}mm</td>
                          <td>{result.movement.toFixed(1)}mm</td>
                          <td>
                            <span className={`priority-${result.priority}`}>
                              {result.priority === 'high' ? '高' : result.priority === 'medium' ? '中' : '低'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.length > 20 && (
                    <p className="text-muted">他 {results.length - 20} 点...</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>移動量算出の説明</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📊 算出アルゴリズム</h3>
              <ul>
                <li>計画線との差分を基本移動量として算出</li>
                <li>固定点制約を考慮した最適化処理</li>
                <li>移動量制限値の適用</li>
                <li>平滑化係数による調整</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>🎯 優先度判定基準</h3>
              <ul>
                <li><strong>高:</strong> 移動量20mm以上</li>
                <li><strong>中:</strong> 移動量10-20mm</li>
                <li><strong>低:</strong> 移動量10mm未満</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Export
          label="結果をCSV出力"
          onClick={exportMovement}
          disabled={results.length === 0}
        />
      </div>
    </div>
  );
};

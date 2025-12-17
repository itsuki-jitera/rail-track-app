/**
 * 手検測入力ページ
 * PDF P15の仕様に基づく実装
 * 手動で計測した軌道データを入力
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import CorrelationMatcher from '../components/CorrelationMatcher';
import { useGlobalWorkspace, workspaceSelectors } from '../contexts/GlobalWorkspaceContext';
import './PageStyles.css';

interface MeasurementPoint {
  id: string;
  distance: number;
  leftRail: number;
  rightRail: number;
  cant: number;
  gauge: number;
  measuredBy: string;
  timestamp: Date;
}

export const FieldMeasurementPage: React.FC = () => {
  // グローバル状態から復元波形データを取得
  const { state } = useGlobalWorkspace();
  const restoredWaveform = workspaceSelectors.getRestoredWaveform(state);

  const [measurements, setMeasurements] = useState<MeasurementPoint[]>([]);
  const [newPoint, setNewPoint] = useState({
    distance: 0,
    leftRail: 0,
    rightRail: 0,
    cant: 0,
    gauge: 1067,
    measuredBy: ''
  });
  const [showCorrelationMatcher, setShowCorrelationMatcher] = useState(false);

  const addMeasurement = () => {
    if (!newPoint.distance) {
      alert('距離を入力してください');
      return;
    }

    const point: MeasurementPoint = {
      id: `MP-${Date.now()}`,
      ...newPoint,
      timestamp: new Date()
    };

    setMeasurements([...measurements, point].sort((a, b) => a.distance - b.distance));
    setNewPoint({
      distance: 0,
      leftRail: 0,
      rightRail: 0,
      cant: 0,
      gauge: 1067,
      measuredBy: ''
    });
  };

  const removeMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
  };

  const saveMeasurements = async () => {
    try {
      const response = await fetch('/api/field-measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurements })
      });

      if (response.ok) {
        alert('手検測データを保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const exportToCSV = () => {
    const csv = [
      ['距離(m)', '左レール(mm)', '右レール(mm)', 'カント(mm)', '軌間(mm)', '測定者', '測定日時'],
      ...measurements.map(m => [
        m.distance,
        m.leftRail,
        m.rightRail,
        m.cant,
        m.gauge,
        m.measuredBy,
        m.timestamp.toLocaleString('ja-JP')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field_measurement_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📝 手検測入力</h1>
        <p>手動で計測した軌道データを入力します（PDF P15準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>測定データ入力</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>距離 (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPoint.distance}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    distance: Number(e.target.value)
                  })}
                  placeholder="例: 1234.5"
                />
              </div>

              <div className="form-group">
                <label>左レール高低 (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPoint.leftRail}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    leftRail: Number(e.target.value)
                  })}
                  placeholder="例: 5.2"
                />
              </div>

              <div className="form-group">
                <label>右レール高低 (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPoint.rightRail}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    rightRail: Number(e.target.value)
                  })}
                  placeholder="例: 4.8"
                />
              </div>

              <div className="form-group">
                <label>カント (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPoint.cant}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    cant: Number(e.target.value)
                  })}
                  placeholder="例: 105"
                />
              </div>

              <div className="form-group">
                <label>軌間 (mm)</label>
                <input
                  type="number"
                  value={newPoint.gauge}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    gauge: Number(e.target.value)
                  })}
                  placeholder="例: 1067"
                />
              </div>

              <div className="form-group">
                <label>測定者</label>
                <input
                  type="text"
                  value={newPoint.measuredBy}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    measuredBy: e.target.value
                  })}
                  placeholder="測定者名"
                />
              </div>
            </div>

            <div className="action-buttons">
              <PresetButtons.Add
                label="測定点を追加"
                onClick={addMeasurement}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>入力済みデータ一覧</h2>
          </div>
          <div className="card-body">
            {measurements.length === 0 ? (
              <p className="text-muted">測定データがありません</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>距離(m)</th>
                      <th>左レール</th>
                      <th>右レール</th>
                      <th>カント</th>
                      <th>軌間</th>
                      <th>測定者</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((point) => (
                      <tr key={point.id}>
                        <td>{point.distance.toFixed(1)}</td>
                        <td>{point.leftRail.toFixed(1)}mm</td>
                        <td>{point.rightRail.toFixed(1)}mm</td>
                        <td>{point.cant.toFixed(1)}mm</td>
                        <td>{point.gauge}mm</td>
                        <td>{point.measuredBy || '-'}</td>
                        <td>
                          <PresetButtons.Delete
                            size="small"
                            onClick={() => removeMeasurement(point.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="info-box mt-3">
              <p>登録済み測定点数: <strong>{measurements.length}</strong>点</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>手検測入力の注意事項</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📋 入力ガイド</h3>
              <ul>
                <li>測定点は距離順に自動ソートされます</li>
                <li>カントは左レール高を正として入力</li>
                <li>軌間は標準1067mmですが変更可能</li>
                <li>測定者名は任意ですが記録推奨</li>
              </ul>
            </div>

            <div className="warning-box">
              <h3>⚠️ データ品質のポイント</h3>
              <ul>
                <li>測定間隔は一定に保つことを推奨</li>
                <li>異常値がないか入力後に確認</li>
                <li>定期的に保存してデータを保護</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 相関マッチング機能（新機能） */}
        {restoredWaveform && restoredWaveform.positions && (
          <div className="card">
            <div className="card-header">
              <h2>🎯 位置合わせ（相関マッチング）</h2>
            </div>
            <div className="card-body">
              <div className="info-box" style={{ marginBottom: '20px' }}>
                <p>手検測データとチャートデータの相関を計算し、最適な位置合わせを行います。</p>
                <p>±20m以内の範囲で自動的に最適位置を検出します。</p>
              </div>
              <button
                onClick={() => setShowCorrelationMatcher(!showCorrelationMatcher)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: showCorrelationMatcher ? '#f44336' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                {showCorrelationMatcher ? '❌ 相関マッチングを閉じる' : '🔍 相関マッチングを開始'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 相関マッチングコンポーネント */}
      {showCorrelationMatcher && restoredWaveform && (
        <div style={{ margin: '20px' }}>
          <CorrelationMatcher
            chartData={{
              positions: restoredWaveform.positions || [],
              values: restoredWaveform.level || []
            }}
            onMatchComplete={(result) => {
              console.log('マッチング完了:', result);
              alert(`最適位置: ${result.bestOffset.toFixed(2)}m, 相関係数: ${(result.bestCorrelation * 100).toFixed(1)}%`);
            }}
          />
        </div>
      )}

      <div className="action-buttons">
        <PresetButtons.Save
          label="データを保存"
          onClick={saveMeasurements}
        />
        <PresetButtons.Export
          label="CSV出力"
          onClick={exportToCSV}
        />
      </div>
    </div>
  );
};

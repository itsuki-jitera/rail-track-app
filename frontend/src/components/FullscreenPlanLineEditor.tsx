import React, { useState, useEffect, useRef } from 'react';
import { DraggableLineChart } from './DraggableLineChart';
import './FullscreenPlanLineEditor.css';

interface DataPoint {
  position: number;
  targetLevel: number;
  targetAlignment: number;
  isFixed?: boolean;
}

interface FullscreenPlanLineEditorProps {
  initialData?: DataPoint[];
  onSave?: (data: DataPoint[]) => void;
}

export const FullscreenPlanLineEditor: React.FC<FullscreenPlanLineEditorProps> = ({
  initialData = [],
  onSave
}) => {
  // 区間長の選択肢
  const sectionLengths = [25, 50, 100, 200];
  const [selectedLength, setSelectedLength] = useState(50); // デフォルトは50m

  // データ生成パターンの種類
  type PatternType = 'realistic' | 'slight' | 'moderate' | 'severe' | 'straight';
  const [selectedPattern, setSelectedPattern] = useState<PatternType>('realistic');

  // 表示範囲の制御（実データ用）
  const [displayRange, setDisplayRange] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const [viewMode, setViewMode] = useState<'window' | 'all'>('window'); // window: 区間表示, all: 全体表示

  // より現実的なデフォルトデータを生成
  const generateRealisticDefaultData = (length: number = selectedLength, pattern: PatternType = selectedPattern): DataPoint[] => {
    const data: DataPoint[] = [];
    const interval = length <= 50 ? 2.5 : 5; // 短い区間は細かく、長い区間は粗く

    // パターンに応じた振幅設定
    const amplitudes = {
      straight: { long: 0.5, mid: 0.2, short: 0.1, alignLong: 0.3, alignShort: 0.1 },
      slight: { long: 2, mid: 1, short: 0.5, alignLong: 1, alignShort: 0.5 },
      realistic: { long: 4, mid: 2, short: 1, alignLong: 2, alignShort: 1 },
      moderate: { long: 8, mid: 4, short: 2, alignLong: 4, alignShort: 2 },
      severe: { long: 15, mid: 8, short: 4, alignLong: 8, alignShort: 4 }
    };

    const amp = amplitudes[pattern];

    for (let position = 0; position <= length; position += interval) {
      // 実際の軌道狂いパターンをシミュレート
      // 長周期成分（区間長の60-80%周期）
      const longWave = amp.long * Math.sin(2 * Math.PI * position / (length * 0.7));

      // 中周期成分（10-20m周期）
      const midWave = amp.mid * Math.sin(2 * Math.PI * position / 15 + Math.PI / 4);

      // 短周期成分（2-5m周期）
      const shortWave = amp.short * Math.sin(2 * Math.PI * position / 3.5 + Math.PI / 3);

      // レベル（高低）の値
      const targetLevel = longWave + midWave + shortWave + (pattern === 'straight' ? 0 : 3);

      // 通り（左右）の値：レベルより小さめの変化
      const targetAlignment =
        amp.alignLong * Math.sin(2 * Math.PI * position / (length * 0.6)) +
        amp.alignShort * Math.sin(2 * Math.PI * position / 12 + Math.PI / 6);

      data.push({
        position,
        targetLevel: Math.round(targetLevel * 10) / 10, // 0.1mm単位に丸める
        targetAlignment: Math.round(targetAlignment * 10) / 10,
        isFixed: position === 0 || position === length // 始点と終点は固定
      });
    }

    return data;
  };

  // デフォルトデータ
  const [data, setData] = useState<DataPoint[]>(
    initialData.length > 0 ? initialData : generateRealisticDefaultData(50, 'realistic')
  );
  const [selectedTab, setSelectedTab] = useState<'data' | 'stats' | 'settings'>('data');
  const [hasChanges, setHasChanges] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showLimits, setShowLimits] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'level' | 'alignment' | null>(null);
  const [editValue, setEditValue] = useState('');

  // 初期データが設定されたときに表示範囲を調整
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      const totalLength = initialData[initialData.length - 1].position - initialData[0].position;

      // 全体が100m以下なら全部表示、それ以上なら100m区間を表示
      if (totalLength <= 100) {
        setDisplayRange({
          start: initialData[0].position,
          end: initialData[initialData.length - 1].position
        });
        setViewMode('all');
      } else {
        // 最初の100mを表示
        setDisplayRange({
          start: initialData[0].position,
          end: Math.min(initialData[0].position + 100, initialData[initialData.length - 1].position)
        });
        setViewMode('window');
      }
    }
  }, [initialData]);

  // 区間長やパターンが変更されたときの処理
  const handleSectionChange = (newLength: number, newPattern: PatternType) => {
    // 注意: この関数は「デモデータを生成」ボタンでのみ使用
    // 実際の測定データがある場合は、データを上書きしないようにする
    if (window.confirm('現在のデータを破棄して、デモデータを生成しますか？\n（測定データがある場合は「キャンセル」を押してください）')) {
      setSelectedLength(newLength);
      setSelectedPattern(newPattern);
      const newData = generateRealisticDefaultData(newLength, newPattern);
      setData(newData);
      setHasChanges(true);
    }
  };

  // データ変更ハンドラ
  const handleDataChange = (newData: DataPoint[]) => {
    setData(newData);
    setHasChanges(true);
  };

  // 保存処理
  const handleSave = () => {
    if (onSave) {
      onSave(data);
    }
    setHasChanges(false);
    console.log('データを保存しました:', data);
  };

  // インライン編集開始
  const startEdit = (index: number, field: 'level' | 'alignment') => {
    setEditingIndex(index);
    setEditingField(field);
    setEditValue(String(field === 'level' ? data[index].targetLevel : data[index].targetAlignment));
  };

  // インライン編集確定
  const confirmEdit = () => {
    if (editingIndex !== null && editingField !== null) {
      const newData = [...data];
      const value = parseFloat(editValue);

      if (!isNaN(value)) {
        if (editingField === 'level') {
          newData[editingIndex].targetLevel = Math.max(-30, Math.min(30, value));
        } else {
          newData[editingIndex].targetAlignment = Math.max(-20, Math.min(20, value));
        }
        handleDataChange(newData);
      }
    }
    setEditingIndex(null);
    setEditingField(null);
    setEditValue('');
  };

  // インライン編集キャンセル
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingField(null);
    setEditValue('');
  };

  // 点の追加
  const addPoint = () => {
    const newPosition = prompt('追加する位置 (m) を入力してください:');
    if (newPosition) {
      const position = parseFloat(newPosition);
      if (!isNaN(position) && !data.some(p => p.position === position)) {
        const newData = [...data, {
          position,
          targetLevel: 0,
          targetAlignment: 0
        }].sort((a, b) => a.position - b.position);
        handleDataChange(newData);
      }
    }
  };

  // 点の削除
  const deletePoint = (index: number) => {
    if (data[index].isFixed) {
      alert('固定点は削除できません');
      return;
    }
    if (confirm(`位置 ${data[index].position}m の点を削除しますか？`)) {
      const newData = data.filter((_, i) => i !== index);
      handleDataChange(newData);
    }
  };

  return (
    <div className="fullscreen-editor">
      {/* ツールバー */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <h2>📈 計画線エディタ</h2>

          {/* 実データがある場合の表示 */}
          {initialData && initialData.length > 0 && (
            <>
              <div className="toolbar-control-group" style={{
                background: '#e7f3ff',
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid #3b82f6'
              }}>
                <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>
                  📊 測定データ表示中 ({data.length}点)
                </span>
              </div>

              {/* 表示範囲コントロール（長いデータの場合のみ） */}
              {data.length > 0 && data[data.length - 1].position > 100 && (
                <div className="toolbar-control-group">
                  <label className="control-label">表示範囲:</label>
                  <select
                    className="control-select"
                    value={viewMode}
                    onChange={(e) => {
                      const mode = e.target.value as 'window' | 'all';
                      setViewMode(mode);
                      if (mode === 'all') {
                        setDisplayRange({
                          start: data[0].position,
                          end: data[data.length - 1].position
                        });
                      } else {
                        setDisplayRange({
                          start: data[0].position,
                          end: Math.min(data[0].position + 100, data[data.length - 1].position)
                        });
                      }
                    }}
                  >
                    <option value="window">100m区間</option>
                    <option value="all">全体表示</option>
                  </select>

                  {viewMode === 'window' && (
                    <>
                      <input
                        type="range"
                        min={data[0].position}
                        max={Math.max(data[0].position, data[data.length - 1].position - 100)}
                        value={displayRange.start}
                        onChange={(e) => {
                          const start = Number(e.target.value);
                          setDisplayRange({
                            start,
                            end: start + 100
                          });
                        }}
                        style={{
                          width: '200px',
                          marginLeft: '10px'
                        }}
                        title={`位置: ${displayRange.start.toFixed(0)}m - ${displayRange.end.toFixed(0)}m`}
                      />
                      <span style={{ fontSize: '12px', marginLeft: '10px', color: '#64748b' }}>
                        {displayRange.start.toFixed(0)}m - {displayRange.end.toFixed(0)}m
                      </span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="toolbar-center">
          <button
            className={`toolbar-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="グリッド"
          >
            📊
          </button>
          <button
            className={`toolbar-btn ${showLimits ? 'active' : ''}`}
            onClick={() => setShowLimits(!showLimits)}
            title="制限値"
          >
            🚧
          </button>
          <button
            className="toolbar-btn"
            onClick={addPoint}
            title="点を追加"
          >
            ➕
          </button>
        </div>

        <div className="toolbar-right">
          <span className={`status-indicator ${hasChanges ? 'unsaved' : 'saved'}`}>
            {hasChanges ? '● 編集あり' : '✓ 保存済み'}
          </span>
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            💾 保存
          </button>
        </div>
      </div>

      {/* メインチャートエリア */}
      <div className="chart-container">
        <DraggableLineChart
          data={viewMode === 'window'
            ? data.filter(d => d.position >= displayRange.start && d.position <= displayRange.end)
            : data}
          onDataChange={(newData) => {
            // 表示範囲のデータのみ更新された場合、全体データを更新
            if (viewMode === 'window') {
              const updatedData = [...data];
              newData.forEach(newPoint => {
                const index = updatedData.findIndex(p => p.position === newPoint.position);
                if (index !== -1) {
                  updatedData[index] = newPoint;
                }
              });
              handleDataChange(updatedData);
            } else {
              handleDataChange(newData);
            }
          }}
          showGrid={showGrid}
          showLimits={showLimits}
        />
      </div>

      {/* 下部タブパネル */}
      <div className="bottom-panel">
        <div className="tab-header">
          <button
            className={`tab-btn ${selectedTab === 'data' ? 'active' : ''}`}
            onClick={() => setSelectedTab('data')}
          >
            📊 データ一覧
          </button>
          <button
            className={`tab-btn ${selectedTab === 'stats' ? 'active' : ''}`}
            onClick={() => setSelectedTab('stats')}
          >
            📈 統計情報
          </button>
          <button
            className={`tab-btn ${selectedTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSelectedTab('settings')}
          >
            ⚙️ 設定
          </button>
        </div>

        <div className="tab-content">
          {selectedTab === 'data' && (
            <div className="data-tab">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>位置 (m)</th>
                    <th>レベル (mm)</th>
                    <th>通り (mm)</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point, index) => (
                    <tr key={index} className={point.isFixed ? 'fixed-row' : ''}>
                      <td>{point.position}</td>
                      <td>
                        {editingIndex === index && editingField === 'level' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={confirmEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                            className="inline-edit"
                          />
                        ) : (
                          <span
                            className="editable"
                            onDoubleClick={() => !point.isFixed && startEdit(index, 'level')}
                            style={point.isFixed ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                          >
                            {point.targetLevel.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingIndex === index && editingField === 'alignment' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={confirmEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                            className="inline-edit"
                          />
                        ) : (
                          <span
                            className="editable"
                            onDoubleClick={() => !point.isFixed && startEdit(index, 'alignment')}
                            style={point.isFixed ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                          >
                            {point.targetAlignment.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td>
                        {!point.isFixed ? (
                          <button
                            className="delete-btn"
                            onClick={() => deletePoint(index)}
                            title="削除"
                          >
                            🗑️
                          </button>
                        ) : (
                          <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>固定</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedTab === 'stats' && (
            <div className="stats-tab">
              <div className="stats-grid">
                <div className="stat-card">
                  <h4>データ点数</h4>
                  <p className="stat-value">{data.length}</p>
                </div>
                <div className="stat-card">
                  <h4>最大レベル</h4>
                  <p className="stat-value">{Math.max(...data.map(p => p.targetLevel)).toFixed(1)}mm</p>
                </div>
                <div className="stat-card">
                  <h4>最小レベル</h4>
                  <p className="stat-value">{Math.min(...data.map(p => p.targetLevel)).toFixed(1)}mm</p>
                </div>
                <div className="stat-card">
                  <h4>レベル平均</h4>
                  <p className="stat-value">
                    {(data.reduce((sum, p) => sum + p.targetLevel, 0) / data.length).toFixed(1)}mm
                  </p>
                </div>
                <div className="stat-card">
                  <h4>最大通り</h4>
                  <p className="stat-value">{Math.max(...data.map(p => p.targetAlignment)).toFixed(1)}mm</p>
                </div>
                <div className="stat-card">
                  <h4>最小通り</h4>
                  <p className="stat-value">{Math.min(...data.map(p => p.targetAlignment)).toFixed(1)}mm</p>
                </div>
                <div className="stat-card">
                  <h4>固定点数</h4>
                  <p className="stat-value">{data.filter(p => p.isFixed).length}</p>
                </div>
                <div className="stat-card">
                  <h4>区間距離</h4>
                  <p className="stat-value">{Math.max(...data.map(p => p.position))}m</p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'settings' && (
            <div className="settings-tab">
              <div className="settings-grid">
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                    />
                    グリッド表示
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={showLimits}
                      onChange={(e) => setShowLimits(e.target.checked)}
                    />
                    制限値ライン表示
                  </label>
                </div>
              </div>

              {/* デモデータ生成（実データがない場合のみ） */}
              {(!initialData || initialData.length === 0) && (
                <div style={{ marginTop: '20px', padding: '15px', background: '#fff3e0', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#f59e0b' }}>🎯 デモデータ生成</h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select
                      value={selectedLength}
                      onChange={(e) => setSelectedLength(Number(e.target.value))}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      {sectionLengths.map(length => (
                        <option key={length} value={length}>{length}m</option>
                      ))}
                    </select>
                    <select
                      value={selectedPattern}
                      onChange={(e) => setSelectedPattern(e.target.value as PatternType)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="straight">ほぼ直線</option>
                      <option value="slight">軽微 (±2mm)</option>
                      <option value="realistic">標準 (±5mm)</option>
                      <option value="moderate">中程度 (±10mm)</option>
                      <option value="severe">大きい (±20mm)</option>
                    </select>
                    <button
                      onClick={() => handleSectionChange(selectedLength, selectedPattern)}
                      style={{
                        padding: '6px 12px',
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      生成
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
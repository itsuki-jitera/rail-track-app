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
  // デフォルトデータ
  const defaultData: DataPoint[] = initialData.length > 0 ? initialData : [
    { position: 0, targetLevel: 0, targetAlignment: 0, isFixed: true },
    { position: 50, targetLevel: 5, targetAlignment: 2 },
    { position: 100, targetLevel: 10, targetAlignment: 5 },
    { position: 150, targetLevel: 12, targetAlignment: 3 },
    { position: 200, targetLevel: 15, targetAlignment: -2 },
    { position: 250, targetLevel: 13, targetAlignment: -5 },
    { position: 300, targetLevel: 10, targetAlignment: -3 },
    { position: 350, targetLevel: 8, targetAlignment: 0 },
    { position: 400, targetLevel: 5, targetAlignment: 2 },
    { position: 450, targetLevel: 3, targetAlignment: 3 },
    { position: 500, targetLevel: 0, targetAlignment: 0, isFixed: true }
  ];

  const [data, setData] = useState<DataPoint[]>(defaultData);
  const [selectedTab, setSelectedTab] = useState<'data' | 'stats' | 'settings'>('data');
  const [hasChanges, setHasChanges] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showLimits, setShowLimits] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'level' | 'alignment' | null>(null);
  const [editValue, setEditValue] = useState('');

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
          data={data}
          onDataChange={handleDataChange}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
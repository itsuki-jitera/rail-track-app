import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './AdvancedPlanLineEditor.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  position: number;
  targetLevel: number;
  targetAlignment: number;
  isFixed?: boolean;
  hasWarning?: boolean;
}

interface AdvancedPlanLineEditorProps {
  initialData?: DataPoint[];
  onSave?: (data: DataPoint[]) => void;
  height?: number;
}

export const AdvancedPlanLineEditor: React.FC<AdvancedPlanLineEditorProps> = ({
  initialData = [],
  onSave,
  height = 600
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
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragInfo, setDragInfo] = useState<{
    index: number;
    dataset: 'level' | 'alignment';
  } | null>(null);
  const [editMode, setEditMode] = useState<'drag' | 'value' | 'add'>('drag');
  const [showGrid, setShowGrid] = useState(true);
  const [showLimits, setShowLimits] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [inlineEditIndex, setInlineEditIndex] = useState<number | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>('');
  const [inlineEditType, setInlineEditType] = useState<'level' | 'alignment' | null>(null);

  const chartRef = useRef<any>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 自動保存機能
  useEffect(() => {
    if (autoSave && hasChanges) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, 3000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [data, autoSave, hasChanges]);

  // データ更新時の処理
  const updateData = useCallback((newData: DataPoint[]) => {
    setData(newData);
    setHasChanges(true);
  }, []);

  // 保存処理
  const handleSave = useCallback(() => {
    // データ補完処理
    const completedData = data.map(point => ({
      ...point,
      targetLevel: isNaN(point.targetLevel) ? 0 : point.targetLevel,
      targetAlignment: isNaN(point.targetAlignment) ? 0 : point.targetAlignment
    }));

    if (onSave) {
      onSave(completedData);
    }
    setHasChanges(false);
    console.log('計画線データを保存しました', completedData);
  }, [data, onSave]);

  // インライン編集の開始
  const startInlineEdit = (index: number, type: 'level' | 'alignment', e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineEditIndex(index);
    setInlineEditType(type);
    setInlineEditValue(String(type === 'level' ? data[index].targetLevel : data[index].targetAlignment));
  };

  // インライン編集の確定
  const confirmInlineEdit = () => {
    if (inlineEditIndex !== null && inlineEditType !== null) {
      const newData = [...data];
      const value = parseFloat(inlineEditValue);

      if (!isNaN(value)) {
        if (inlineEditType === 'level') {
          newData[inlineEditIndex].targetLevel = Math.max(-30, Math.min(30, value));
        } else {
          newData[inlineEditIndex].targetAlignment = Math.max(-20, Math.min(20, value));
        }
        updateData(newData);
      }
    }
    setInlineEditIndex(null);
    setInlineEditType(null);
    setInlineEditValue('');
  };

  // インライン編集のキャンセル
  const cancelInlineEdit = () => {
    setInlineEditIndex(null);
    setInlineEditType(null);
    setInlineEditValue('');
  };

  // 点の追加
  const addPoint = (position: number) => {
    // 既存の点の間に新しい点を追加
    const newPoint: DataPoint = {
      position,
      targetLevel: 0,
      targetAlignment: 0
    };

    // 前後の点から補間
    const sortedData = [...data].sort((a, b) => a.position - b.position);
    const index = sortedData.findIndex(p => p.position > position);

    if (index > 0 && index < sortedData.length) {
      const prevPoint = sortedData[index - 1];
      const nextPoint = sortedData[index];
      const ratio = (position - prevPoint.position) / (nextPoint.position - prevPoint.position);

      newPoint.targetLevel = prevPoint.targetLevel + (nextPoint.targetLevel - prevPoint.targetLevel) * ratio;
      newPoint.targetAlignment = prevPoint.targetAlignment + (nextPoint.targetAlignment - prevPoint.targetAlignment) * ratio;
    }

    const newData = [...data, newPoint].sort((a, b) => a.position - b.position);
    updateData(newData);
  };

  // 点の削除
  const deletePoint = (index: number) => {
    if (data[index].isFixed) {
      alert('固定点は削除できません');
      return;
    }
    const newData = data.filter((_, i) => i !== index);
    updateData(newData);
  };

  // グラフデータの準備
  const chartData = {
    labels: data.map(p => p.position),
    datasets: [
      {
        label: 'レベル（高低）',
        data: data.map(p => p.targetLevel),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: data.map(p => p.isFixed ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'),
        pointBorderWidth: 2,
        tension: 0.2,
        yAxisID: 'y'
      },
      {
        label: '通り（左右）',
        data: data.map(p => p.targetAlignment),
        borderColor: 'rgb(236, 72, 153)',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: data.map(p => p.isFixed ? 'rgb(239, 68, 68)' : 'rgb(236, 72, 153)'),
        pointBorderWidth: 2,
        tension: 0.2,
        yAxisID: 'y1'
      }
    ]
  };

  // 制限値ラインの追加
  if (showLimits) {
    chartData.datasets.push({
      label: '上限',
      data: data.map(() => 25),
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderDash: [5, 5],
      pointRadius: 0,
      yAxisID: 'y',
      fill: false
    } as any);

    chartData.datasets.push({
      label: '下限',
      data: data.map(() => -25),
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderDash: [5, 5],
      pointRadius: 0,
      yAxisID: 'y',
      fill: false
    } as any);
  }

  // ドラッグ機能の実装
  useEffect(() => {
    if (!chartRef.current || editMode !== 'drag') return;

    const chart = chartRef.current;
    const canvas = chart.canvas;
    let isDraggingPoint = false;
    let dragPointIndex: number | null = null;
    let dragDatasetIndex: number | null = null;

    const handleMouseDown = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const canvasPosition = chart.getElementsAtEventForMode(
        event,
        'nearest',
        { intersect: true },
        false
      );

      if (canvasPosition.length > 0) {
        isDraggingPoint = true;
        dragPointIndex = canvasPosition[0].index;
        dragDatasetIndex = canvasPosition[0].datasetIndex;
        canvas.style.cursor = 'grabbing';
        setDragInfo({
          index: dragPointIndex,
          dataset: dragDatasetIndex === 0 ? 'level' : 'alignment'
        });
        event.preventDefault();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingPoint || dragPointIndex === null || dragDatasetIndex === null) return;

      const rect = canvas.getBoundingClientRect();
      const y = event.clientY - rect.top;

      const yAxis = dragDatasetIndex === 0 ? chart.scales.y : chart.scales.y1;
      const yValue = yAxis.getValueForPixel(y);

      if (yValue !== undefined && !data[dragPointIndex].isFixed) {
        const newData = [...data];
        if (dragDatasetIndex === 0) {
          newData[dragPointIndex].targetLevel = Math.max(-30, Math.min(30, yValue));
        } else {
          newData[dragPointIndex].targetAlignment = Math.max(-20, Math.min(20, yValue));
        }
        updateData(newData);
      }
    };

    const handleMouseUp = () => {
      isDraggingPoint = false;
      dragPointIndex = null;
      dragDatasetIndex = null;
      canvas.style.cursor = 'default';
      setDragInfo(null);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [chartRef.current, editMode, data, updateData]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'point'
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: !isDragging,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            if (items.length > 0) {
              return `位置: ${items[0].label}m`;
            }
            return '';
          },
          label: (item: TooltipItem<'line'>) => {
            const value = item.parsed.y.toFixed(1);
            return `${item.dataset.label}: ${value}mm`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '位置 (m)',
          color: '#666'
        },
        grid: {
          display: showGrid,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'レベル (mm)',
          color: 'rgb(59, 130, 246)'
        },
        min: -30,
        max: 30,
        grid: {
          display: showGrid,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '通り (mm)',
          color: 'rgb(236, 72, 153)'
        },
        min: -20,
        max: 20,
        grid: {
          drawOnChartArea: false
        }
      }
    },
    onHover: (event, activeElements) => {
      const chart = chartRef.current;
      if (chart && editMode === 'drag') {
        chart.canvas.style.cursor = activeElements.length > 0 ? 'grab' : 'crosshair';
      }
    }
  };

  return (
    <div className="advanced-editor-container" style={{ height: `${height}px` }}>
      {/* ツールバー */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${editMode === 'drag' ? 'active' : ''}`}
            onClick={() => setEditMode('drag')}
            title="ドラッグモード"
          >
            🖱️
          </button>
          <button
            className={`toolbar-btn ${editMode === 'value' ? 'active' : ''}`}
            onClick={() => setEditMode('value')}
            title="数値編集モード"
          >
            🔢
          </button>
          <button
            className={`toolbar-btn ${editMode === 'add' ? 'active' : ''}`}
            onClick={() => setEditMode('add')}
            title="点追加モード"
          >
            ➕
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="グリッド表示"
          >
            📊
          </button>
          <button
            className={`toolbar-btn ${showLimits ? 'active' : ''}`}
            onClick={() => setShowLimits(!showLimits)}
            title="制限値表示"
          >
            🚧
          </button>
          <button
            className={`toolbar-btn ${autoSave ? 'active' : ''}`}
            onClick={() => setAutoSave(!autoSave)}
            title="自動保存"
          >
            🔄
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="toolbar-btn save-btn"
            onClick={handleSave}
            disabled={!hasChanges}
            title="保存"
          >
            💾 保存
          </button>
        </div>

        <div className="toolbar-status">
          {hasChanges ? '📝 編集中' : '✅ 保存済み'}
          {autoSave && ' (自動保存ON)'}
        </div>
      </div>

      {/* メインエリア */}
      <div className="editor-main">
        {/* グラフエリア */}
        <div className="graph-area">
          <Line ref={chartRef} options={chartOptions} data={chartData} />

          {/* ドラッグ中の値表示 */}
          {isDragging && dragInfo && (
            <div className="drag-indicator">
              <div>位置: {data[dragInfo.index].position}m</div>
              <div>
                {dragInfo.dataset === 'level' ? 'レベル' : '通り'}:
                {dragInfo.dataset === 'level'
                  ? data[dragInfo.index].targetLevel.toFixed(1)
                  : data[dragInfo.index].targetAlignment.toFixed(1)}mm
              </div>
            </div>
          )}

          {/* オーバーレイUI */}
          <div className="graph-overlay">
            {selectedPoint !== null && (
              <div className="point-info">
                <h4>選択中の点</h4>
                <p>位置: {data[selectedPoint].position}m</p>
                <p>レベル: {data[selectedPoint].targetLevel.toFixed(1)}mm</p>
                <p>通り: {data[selectedPoint].targetAlignment.toFixed(1)}mm</p>
                {data[selectedPoint].isFixed && <p className="fixed-label">🔒 固定点</p>}
              </div>
            )}
          </div>
        </div>

        {/* サイドパネル */}
        <div className="side-panel">
          <div className="panel-section">
            <h3>📊 データ一覧</h3>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>位置</th>
                    <th>レベル</th>
                    <th>通り</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point, index) => (
                    <tr
                      key={index}
                      className={selectedPoint === index ? 'selected' : ''}
                      onClick={() => setSelectedPoint(index)}
                    >
                      <td>{point.position}m</td>
                      <td>
                        {inlineEditIndex === index && inlineEditType === 'level' ? (
                          <input
                            type="number"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={confirmInlineEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmInlineEdit();
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            autoFocus
                            className="inline-edit"
                          />
                        ) : (
                          <span
                            onDoubleClick={(e) => startInlineEdit(index, 'level', e)}
                            className="editable-value"
                          >
                            {point.targetLevel.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td>
                        {inlineEditIndex === index && inlineEditType === 'alignment' ? (
                          <input
                            type="number"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={confirmInlineEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmInlineEdit();
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            autoFocus
                            className="inline-edit"
                          />
                        ) : (
                          <span
                            onDoubleClick={(e) => startInlineEdit(index, 'alignment', e)}
                            className="editable-value"
                          >
                            {point.targetAlignment.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td>
                        {!point.isFixed && (
                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePoint(index);
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-section">
            <h3>📈 統計情報</h3>
            <div className="stats">
              <div className="stat-item">
                <span>総点数:</span>
                <span>{data.length}</span>
              </div>
              <div className="stat-item">
                <span>最大レベル:</span>
                <span>{Math.max(...data.map(p => p.targetLevel)).toFixed(1)}mm</span>
              </div>
              <div className="stat-item">
                <span>最小レベル:</span>
                <span>{Math.min(...data.map(p => p.targetLevel)).toFixed(1)}mm</span>
              </div>
              <div className="stat-item">
                <span>固定点数:</span>
                <span>{data.filter(p => p.isFixed).length}</span>
              </div>
            </div>
          </div>

          <div className="panel-section">
            <h3>💡 操作ヒント</h3>
            <div className="hints">
              <p>• ダブルクリックで数値を直接編集</p>
              <p>• ドラッグで点を移動</p>
              <p>• 右クリックで点を追加/削除</p>
              <p>• Tab/Shiftで点を移動</p>
              <p>• Ctrl+Sで保存</p>
            </div>
          </div>
        </div>
      </div>

      {/* ステータスバー */}
      <div className="editor-statusbar">
        <span>モード: {editMode === 'drag' ? 'ドラッグ' : editMode === 'value' ? '数値編集' : '点追加'}</span>
        <span>｜</span>
        <span>データ点数: {data.length}</span>
        <span>｜</span>
        <span>選択: {selectedPoint !== null ? `${data[selectedPoint].position}m` : 'なし'}</span>
        <span>｜</span>
        <span className={hasChanges ? 'has-changes' : 'no-changes'}>
          {hasChanges ? '● 未保存の変更あり' : '● すべて保存済み'}
        </span>
      </div>
    </div>
  );
};
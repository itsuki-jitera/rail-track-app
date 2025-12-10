/**
 * インタラクティブな復元波形・計画線編集チャート
 * Interactive Restoration Waveform Chart with Editable Plan Line
 *
 * 機能:
 * - 計画線ポイントのドラッグ&ドロップ編集
 * - ポイントの追加/削除
 * - 直線・曲線モード切り替え
 * - 編集履歴 (Undo/Redo)
 * - リアルタイムプレビュー
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { RestorationWaveformResult, DataPoint } from '../types';
import { PlanLineToolbar, EditMode } from './PlanLineToolbar';

interface EditableRestorationChartProps {
  originalData: DataPoint[];
  result: RestorationWaveformResult;
  measurementLabel?: string;
  onPlanLineUpdate?: (planLine: DataPoint[]) => void;
  onSave?: (planLine: DataPoint[]) => void;
}

interface PlanLinePoint {
  distance: number;
  value: number;
  id: string;
}

interface EditHistory {
  planLine: PlanLinePoint[];
  timestamp: number;
}

const API_BASE_URL = 'http://localhost:5000/api';

export const EditableRestorationChart: React.FC<EditableRestorationChartProps> = ({
  originalData,
  result,
  measurementLabel = '測定値',
  onPlanLineUpdate,
  onSave
}) => {
  // 編集モード
  const [editMode, setEditMode] = useState<EditMode>('view');

  // 計画線データ（編集可能）
  const [editablePlanLine, setEditablePlanLine] = useState<PlanLinePoint[]>([]);

  // 編集履歴 (Undo/Redo)
  const [history, setHistory] = useState<EditHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 選択中のポイント
  const [, setSelectedPointId] = useState<string | null>(null);

  // 初期化: result.data.planLineからeditablePlanLineを生成
  useEffect(() => {
    if (result.data?.planLine) {
      const initialPlanLine = result.data.planLine.map((point, index) => ({
        distance: point.distance,
        value: point.value,
        id: `plan-point-${index}`
      }));
      setEditablePlanLine(initialPlanLine);

      // 初期状態を履歴に追加
      setHistory([{ planLine: initialPlanLine, timestamp: Date.now() }]);
      setHistoryIndex(0);
    }
  }, [result.data?.planLine]);

  // 履歴に追加
  const addToHistory = useCallback((planLine: PlanLinePoint[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ planLine: [...planLine], timestamp: Date.now() });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setEditablePlanLine([...history[historyIndex - 1].planLine]);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setEditablePlanLine([...history[historyIndex + 1].planLine]);
    }
  }, [history, historyIndex]);

  // Plotly restyle イベント（ドラッグ更新）
  const handleRestyle = useCallback((event: any) => {
    if (editMode !== 'edit-drag') return;

    // Plotlyのrestyleイベントから更新されたデータを取得
    const updates = event[0];
    if (updates && updates['x'] && updates['y']) {
      const newX = updates['x'][0];
      const newY = updates['y'][0];

      if (Array.isArray(newX) && Array.isArray(newY)) {
        const newPlanLine = newX.map((distance: number, index: number) => ({
          distance,
          value: newY[index],
          id: editablePlanLine[index]?.id || `plan-point-${index}`
        }));

        setEditablePlanLine(newPlanLine);
        addToHistory(newPlanLine);
        if (onPlanLineUpdate) {
          onPlanLineUpdate(newPlanLine.map(p => ({ distance: p.distance, value: p.value })));
        }
      }
    }
  }, [editMode, editablePlanLine, addToHistory, onPlanLineUpdate]);

  // Plotly relayout イベント（グラフの再レイアウト）
  const handleRelayout = useCallback((event: any) => {
    // グラフのズーム・パン操作など
    console.log('Relayout:', event);
  }, []);

  // ポイントクリック
  const handlePointClick = useCallback((event: any) => {
    const clickedPoint = event.points[0];
    if (!clickedPoint) return;

    const curveIndex = clickedPoint.curveNumber;
    const pointIndex = clickedPoint.pointIndex;

    // 計画線（編集可能ライン）がクリックされた場合
    if (curveIndex === 2) { // 計画線のトレースインデックス
      if (editMode === 'edit-delete') {
        // 削除モード
        setEditablePlanLine(prev => {
          const newPlanLine = prev.filter((_, i) => i !== pointIndex);
          addToHistory(newPlanLine);
          if (onPlanLineUpdate) {
            onPlanLineUpdate(newPlanLine.map(p => ({ distance: p.distance, value: p.value })));
          }
          return newPlanLine;
        });
      } else {
        // ポイント選択
        setSelectedPointId(editablePlanLine[pointIndex]?.id || null);
      }
    }
  }, [editMode, editablePlanLine, addToHistory, onPlanLineUpdate]);

  // グラフクリック（新しいポイント追加）
  const handleGraphClick = useCallback((event: any) => {
    if (editMode !== 'edit-add') return;

    const clickedPoint = event.points[0];
    if (!clickedPoint) return;

    const newDistance = clickedPoint.x;
    const newValue = clickedPoint.y;

    setEditablePlanLine(prev => {
      // 距離順にソートされた位置に挿入
      const newPoint: PlanLinePoint = {
        distance: newDistance,
        value: newValue,
        id: `plan-point-${Date.now()}`
      };

      const insertIndex = prev.findIndex(p => p.distance > newDistance);
      const newPlanLine = [...prev];
      if (insertIndex === -1) {
        newPlanLine.push(newPoint);
      } else {
        newPlanLine.splice(insertIndex, 0, newPoint);
      }

      addToHistory(newPlanLine);
      if (onPlanLineUpdate) {
        onPlanLineUpdate(newPlanLine.map(p => ({ distance: p.distance, value: p.value })));
      }

      return newPlanLine;
    });
  }, [editMode, addToHistory, onPlanLineUpdate]);

  // 計画線の平滑化
  const handleSmoothPlanLine = useCallback(async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/restoration/smooth-section`, {
        planLine: editablePlanLine.map(p => ({ distance: p.distance, value: p.value })),
        options: {
          smoothingFactor: 0.5
        }
      });

      if (response.data.success && response.data.smoothedPlanLine) {
        const smoothedPlanLine = response.data.smoothedPlanLine.map((point: DataPoint, index: number) => ({
          distance: point.distance,
          value: point.value,
          id: `plan-point-smoothed-${index}`
        }));
        setEditablePlanLine(smoothedPlanLine);
        addToHistory(smoothedPlanLine);
        if (onPlanLineUpdate) {
          onPlanLineUpdate(smoothedPlanLine.map((p: any) => ({ distance: p.distance, value: p.value })));
        }
      }
    } catch (error) {
      console.error('平滑化エラー:', error);
      alert('計画線の平滑化に失敗しました');
    }
  }, [editablePlanLine, addToHistory, onPlanLineUpdate]);

  // Plotlyデータ
  const plotData = useMemo(() => {
    const traces: any[] = [];

    // 1. 現況測定波形
    traces.push({
      name: `現況測定波形 (${measurementLabel})`,
      x: originalData.map(d => d.distance),
      y: originalData.map(d => d.value),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#94a3b8', width: 1 },
      hovertemplate: '<b>現況測定</b><br>距離: %{x:.2f}m<br>値: %{y:.2f}mm<extra></extra>'
    });

    // 2. 復元波形
    if (result.data?.restorationWaveform) {
      traces.push({
        name: '復元波形',
        x: result.data.restorationWaveform.map(d => d.distance),
        y: result.data.restorationWaveform.map(d => d.value),
        type: 'scatter',
        mode: 'lines',
        line: { color: '#3b82f6', width: 2 },
        hovertemplate: '<b>復元波形</b><br>距離: %{x:.2f}m<br>値: %{y:.2f}mm<extra></extra>'
      });
    }

    // 3. 計画線（編集可能）
    traces.push({
      name: '計画線 (編集可能)',
      x: editablePlanLine.map(p => p.distance),
      y: editablePlanLine.map(p => p.value),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#10b981', width: 2, dash: 'dash' },
      marker: {
        size: editMode === 'view' ? 4 : 10,
        color: editMode === 'view' ? '#10b981' : '#f59e0b',
        symbol: 'circle',
        line: {
          color: editMode === 'view' ? '#10b981' : '#ffffff',
          width: 2
        }
      },
      hovertemplate: '<b>計画線</b><br>距離: %{x:.2f}m<br>値: %{y:.2f}mm<extra></extra>',
      customdata: editablePlanLine.map(p => p.id)
    });

    // 4. 移動量
    if (result.data?.movementAmounts) {
      traces.push({
        name: '移動量',
        x: result.data.movementAmounts.map(d => d.distance),
        y: result.data.movementAmounts.map(d => d.amount),
        type: 'scatter',
        mode: 'lines',
        line: { color: '#ef4444', width: 1.5 },
        yaxis: 'y2',
        hovertemplate: '<b>移動量</b><br>距離: %{x:.2f}m<br>量: %{y:.2f}mm<extra></extra>'
      });
    }

    return traces;
  }, [originalData, result, editablePlanLine, measurementLabel, editMode]);

  // Plotlyレイアウト
  const plotLayout = useMemo(() => ({
    title: {
      text: `復元波形と計画線（${editMode === 'view' ? '表示モード' : '編集モード'}）`,
      font: { size: 16 }
    },
    xaxis: {
      title: {
        text: '距離 (m)'
      },
      gridcolor: '#e5e7eb'
    },
    yaxis: {
      title: {
        text: `${measurementLabel} (mm)`
      },
      gridcolor: '#e5e7eb'
    },
    yaxis2: {
      title: {
        text: '移動量 (mm)'
      },
      overlaying: 'y' as const,
      side: 'right' as const,
      gridcolor: 'transparent'
    },
    hovermode: 'closest' as const,
    showlegend: true,
    legend: {
      x: 0,
      y: 1,
      bgcolor: 'rgba(255,255,255,0.8)'
    },
    dragmode: (editMode === 'edit-drag' ? 'pan' : 'zoom') as 'pan' | 'zoom',
    plot_bgcolor: '#f9fafb',
    paper_bgcolor: 'white',
    margin: { t: 60, b: 60, l: 70, r: 70 }
  }), [measurementLabel, editMode]);

  // Plotly設定
  const plotConfig = useMemo(() => ({
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['select2d' as any, 'lasso2d' as any],
    responsive: true
  }), []);

  // リセット処理
  const handleReset = useCallback(() => {
    if (result.data?.planLine) {
      const resetPlanLine = result.data.planLine.map((point, index) => ({
        distance: point.distance,
        value: point.value,
        id: `plan-point-${index}`
      }));
      setEditablePlanLine(resetPlanLine);
      addToHistory(resetPlanLine);
      if (onPlanLineUpdate) {
        onPlanLineUpdate(resetPlanLine.map(p => ({ distance: p.distance, value: p.value })));
      }
    }
  }, [result.data?.planLine, addToHistory, onPlanLineUpdate]);

  // 保存処理
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editablePlanLine.map(p => ({ distance: p.distance, value: p.value })));
    }
  }, [editablePlanLine, onSave]);

  // エクスポート処理
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const apiUrl = format === 'csv'
        ? `${API_BASE_URL}/restoration/export/plan-line-csv`
        : `${API_BASE_URL}/restoration/export/plan-line-json`;

      const response = await axios.post(apiUrl, {
        planLine: editablePlanLine.map(p => ({ distance: p.distance, value: p.value })),
        metadata: {
          projectName: `レールトラック復元 - ${measurementLabel}`,
          date: new Date().toISOString(),
          description: `計画線データ（${editablePlanLine.length}ポイント）`
        }
      }, {
        responseType: format === 'csv' ? 'text' : 'json'
      });

      // ファイルダウンロード処理
      const blob = new Blob(
        [format === 'csv' ? response.data : JSON.stringify(response.data, null, 2)],
        { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plan_line_${new Date().toISOString().slice(0,10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`計画線を${format.toUpperCase()}形式でエクスポートしました`);
    } catch (error) {
      console.error(`${format.toUpperCase()}エクスポートエラー:`, error);
      alert(`${format.toUpperCase()}形式でのエクスポートに失敗しました`);
    }
  }, [editablePlanLine, measurementLabel]);

  // インポート処理
  const handleImport = useCallback(async (file: File) => {
    try {
      const fileContent = await file.text();
      const isJson = file.name.toLowerCase().endsWith('.json');

      const apiUrl = isJson
        ? `${API_BASE_URL}/restoration/import/plan-line-json`
        : `${API_BASE_URL}/restoration/import/plan-line-csv`;

      const response = await axios.post(apiUrl, {
        [isJson ? 'jsonContent' : 'csvContent']: isJson
          ? JSON.parse(fileContent)
          : fileContent
      });

      if (response.data.success && response.data.planLine) {
        const importedPlanLine = response.data.planLine.map((point: DataPoint, index: number) => ({
          distance: point.distance,
          value: point.value,
          id: `plan-point-imported-${index}`
        }));

        setEditablePlanLine(importedPlanLine);
        addToHistory(importedPlanLine);

        if (onPlanLineUpdate) {
          onPlanLineUpdate(importedPlanLine.map((p: any) => ({ distance: p.distance, value: p.value })));
        }

        console.log(`計画線をインポートしました（${response.data.statistics.pointCount}ポイント）`);
        alert(`計画線をインポートしました\n${response.data.statistics.pointCount}ポイント`);
      }
    } catch (error) {
      console.error('インポートエラー:', error);
      alert('ファイルのインポートに失敗しました。形式を確認してください。');
    }
  }, [addToHistory, onPlanLineUpdate]);

  return (
    <div className="editable-restoration-chart">
      {/* ツールバー */}
      <PlanLineToolbar
        editMode={editMode}
        onEditModeChange={setEditMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSmooth={handleSmoothPlanLine}
        onReset={handleReset}
        onSave={onSave ? handleSave : undefined}
        onExport={handleExport}
        onImport={handleImport}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        pointCount={editablePlanLine.length}
        historyPosition={`${historyIndex + 1}/${history.length}`}
      />

      {/* ヘルプメッセージ */}
      {editMode !== 'view' && (
        <div className="help-message">
          {editMode === 'edit-add' && '📌 グラフ上をクリックして新しいポイントを追加できます'}
          {editMode === 'edit-delete' && '📌 計画線のポイントをクリックして削除できます'}
          {editMode === 'edit-straight' && '📌 2つのポイントを選択して区間を直線に設定します'}
          {editMode === 'edit-curve' && '📌 区間を選択して曲線（円弧）に設定します'}
        </div>
      )}

      {/* Plotlyチャート */}
      <div className="chart-container">
        <Plot
          data={plotData}
          layout={plotLayout}
          config={plotConfig}
          style={{ width: '100%', height: '600px' }}
          onClick={editMode === 'edit-add' ? handleGraphClick : handlePointClick}
          onRelayout={handleRelayout}
          onRestyle={handleRestyle}
          useResizeHandler={true}
        />
      </div>

      <style>{`
        .editable-restoration-chart {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .help-message {
          padding: 14px 18px;
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border: 2px solid #93c5fd;
          border-radius: 8px;
          color: #1e40af;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
        }

        .chart-container {
          margin-top: 16px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  );
};

export default EditableRestorationChart;

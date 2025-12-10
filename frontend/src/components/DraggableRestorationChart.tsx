/**
 * ドラッグ可能な復元波形・計画線編集チャート
 * Draggable Restoration Chart with D3.js
 *
 * 機能:
 * - 計画線ポイントの真のドラッグ&ドロップ
 * - リアルタイム更新
 * - スムーズなアニメーション
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { RestorationWaveformResult, DataPoint } from '../types';
import { PlanLineToolbar, EditMode } from './PlanLineToolbar';
import axios from 'axios';

interface DraggableRestorationChartProps {
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

const API_BASE_URL = 'http://localhost:5000/api';

export const DraggableRestorationChart: React.FC<DraggableRestorationChartProps> = ({
  originalData,
  result,
  measurementLabel = '測定値',
  onPlanLineUpdate,
  onSave
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editMode, setEditMode] = useState<EditMode>('edit-drag'); // デフォルトをドラッグモードに変更
  const [editablePlanLine, setEditablePlanLine] = useState<PlanLinePoint[]>([]);
  const [history, setHistory] = useState<PlanLinePoint[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // 初期化
  useEffect(() => {
    if (result.data?.planLine) {
      const initialPlanLine = result.data.planLine.map((point, index) => ({
        distance: point.distance,
        value: point.value,
        id: `plan-point-${index}`
      }));
      setEditablePlanLine(initialPlanLine);
      setHistory([initialPlanLine]);
      setHistoryIndex(0);
    }
  }, [result.data?.planLine]);

  // D3.jsチャートの描画
  useEffect(() => {
    if (!svgRef.current || editablePlanLine.length === 0) return;

    const margin = { top: 40, right: 80, bottom: 60, left: 70 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // SVGをクリア
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // スケール設定
    const xExtent = d3.extent([...originalData, ...editablePlanLine], d => d.distance) as [number, number];
    const yExtent = d3.extent([...originalData, ...editablePlanLine], d => d.value) as [number, number];

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height, 0]);

    // 軸の追加
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .text("距離 (m)");

    g.append("g")
      .call(d3.axisLeft(yScale))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .text(`${measurementLabel} (mm)`);

    // 現況測定波形のライン
    const originalLine = d3.line<DataPoint>()
      .x(d => xScale(d.distance))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(originalData)
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.5)
      .attr("d", originalLine);

    // 復元波形のライン
    if (result.data?.restorationWaveform) {
      const restorationLine = d3.line<DataPoint>()
        .x(d => xScale(d.distance))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(result.data.restorationWaveform)
        .attr("fill", "none")
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 2)
        .attr("d", restorationLine);
    }

    // 計画線のライン
    const planLine = d3.line<PlanLinePoint>()
      .x(d => xScale(d.distance))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const planLinePath = g.append("path")
      .datum(editablePlanLine)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("d", planLine);

    // 計画線のポイント（ドラッグ可能）
    const circles = g.selectAll(".plan-point")
      .data(editablePlanLine)
      .enter()
      .append("circle")
      .attr("class", "plan-point")
      .attr("cx", d => xScale(d.distance))
      .attr("cy", d => yScale(d.value))
      .attr("r", editMode === 'view' ? 4 : 8)
      .attr("fill", editMode === 'view' ? "#10b981" : "#f59e0b")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .style("cursor", editMode === 'edit-drag' ? "move" : "pointer");

    // ドラッグ動作の実装
    if (editMode === 'edit-drag') {
      const drag = d3.drag<SVGCircleElement, PlanLinePoint>()
        .on("start", function(event, d) {
          d3.select(this)
            .raise()
            .attr("stroke", "#ff0000")
            .attr("stroke-width", 3);
        })
        .on("drag", function(event, d) {
          const newX = Math.max(0, Math.min(width, event.x));
          const newY = Math.max(0, Math.min(height, event.y));

          // ポイントの位置を更新
          d.distance = xScale.invert(newX);
          d.value = yScale.invert(newY);

          // 円の位置を更新
          d3.select(this)
            .attr("cx", newX)
            .attr("cy", newY);

          // ラインを再描画
          planLinePath.attr("d", planLine);
        })
        .on("end", function(event, d) {
          d3.select(this)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2);

          // 状態を更新
          const updatedPlanLine = [...editablePlanLine];
          updatedPlanLine.sort((a, b) => a.distance - b.distance);
          setEditablePlanLine(updatedPlanLine);

          // 履歴に追加
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(updatedPlanLine);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);

          // コールバック実行
          if (onPlanLineUpdate) {
            onPlanLineUpdate(updatedPlanLine.map(p => ({ distance: p.distance, value: p.value })));
          }
        });

      circles.call(drag);
    }

    // クリックで削除（削除モード）
    if (editMode === 'edit-delete') {
      circles.on("click", function(event, d) {
        const newPlanLine = editablePlanLine.filter(p => p.id !== d.id);
        setEditablePlanLine(newPlanLine);

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newPlanLine);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        if (onPlanLineUpdate) {
          onPlanLineUpdate(newPlanLine.map(p => ({ distance: p.distance, value: p.value })));
        }
      });
    }

    // クリックで追加（追加モード）
    if (editMode === 'edit-add') {
      svg.on("click", function(event) {
        const [x, y] = d3.pointer(event, g.node());

        if (x >= 0 && x <= width && y >= 0 && y <= height) {
          const newPoint: PlanLinePoint = {
            distance: xScale.invert(x),
            value: yScale.invert(y),
            id: `plan-point-${Date.now()}`
          };

          const newPlanLine = [...editablePlanLine, newPoint];
          newPlanLine.sort((a, b) => a.distance - b.distance);
          setEditablePlanLine(newPlanLine);

          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(newPlanLine);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);

          if (onPlanLineUpdate) {
            onPlanLineUpdate(newPlanLine.map(p => ({ distance: p.distance, value: p.value })));
          }
        }
      });
    } else {
      svg.on("click", null);
    }

    // 凡例の追加
    const legend = svg.append("g")
      .attr("transform", `translate(${dimensions.width - 150}, 20)`);

    const legendData = [
      { label: "現況測定波形", color: "#94a3b8" },
      { label: "復元波形", color: "#3b82f6" },
      { label: "計画線", color: "#10b981" }
    ];

    legend.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 25)
      .attr("width", 18)
      .attr("height", 3)
      .attr("fill", d => d.color);

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 24)
      .attr("y", (d, i) => i * 25 + 4)
      .text(d => d.label)
      .style("font-size", "12px")
      .attr("alignment-baseline", "middle");

  }, [editablePlanLine, editMode, originalData, result, measurementLabel, dimensions, history, historyIndex, onPlanLineUpdate]);

  // ウィンドウリサイズ対応
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        if (container) {
          setDimensions({
            width: container.clientWidth,
            height: 500
          });
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Undo/Redo機能
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setEditablePlanLine(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setEditablePlanLine(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // 平滑化
  const handleSmooth = useCallback(async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/restoration/smooth-section`, {
        planLine: editablePlanLine.map(p => ({ distance: p.distance, value: p.value }))
      });

      if (response.data.success && response.data.planLine) {
        const smoothedPlanLine = response.data.planLine.map((point: DataPoint, index: number) => ({
          distance: point.distance,
          value: point.value,
          id: `plan-point-smoothed-${index}`
        }));

        setEditablePlanLine(smoothedPlanLine);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(smoothedPlanLine);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        if (onPlanLineUpdate) {
          onPlanLineUpdate(smoothedPlanLine.map(p => ({ distance: p.distance, value: p.value })));
        }
      }
    } catch (error) {
      console.error('平滑化エラー:', error);
    }
  }, [editablePlanLine, history, historyIndex, onPlanLineUpdate]);

  // リセット
  const handleReset = useCallback(() => {
    if (result.data?.planLine) {
      const resetPlanLine = result.data.planLine.map((point, index) => ({
        distance: point.distance,
        value: point.value,
        id: `plan-point-${index}`
      }));
      setEditablePlanLine(resetPlanLine);
      const newHistory = [resetPlanLine];
      setHistory(newHistory);
      setHistoryIndex(0);
    }
  }, [result.data?.planLine]);

  // 保存
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editablePlanLine.map(p => ({ distance: p.distance, value: p.value })));
    }
  }, [editablePlanLine, onSave]);

  // エクスポート
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    // 既存のエクスポート実装を使用
    console.log(`Export as ${format}`);
  }, []);

  // インポート
  const handleImport = useCallback(async (file: File) => {
    // 既存のインポート実装を使用
    console.log(`Import file: ${file.name}`);
  }, []);

  return (
    <div className="draggable-restoration-chart">
      <PlanLineToolbar
        editMode={editMode}
        onEditModeChange={setEditMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSmooth={handleSmooth}
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
      <div className={`help-message ${editMode === 'edit-drag' ? 'primary' : ''} ${editMode === 'view' ? 'info' : ''}`}>
        {editMode === 'view' && '👁️ 表示専用モード - 編集するには上のドラッグボタンを押してください'}
        {editMode === 'edit-drag' && (
          <div className="drag-help">
            <span className="drag-icon">✋</span>
            <div className="drag-text">
              <strong>計画線を直接ドラッグして編集できます！</strong>
              <span className="help-detail">青い点をつかんで上下に動かしてください</span>
            </div>
          </div>
        )}
        {editMode === 'edit-add' && '➕ グラフ上をクリックして新しいポイントを追加できます'}
        {editMode === 'edit-delete' && '🗑️ 計画線のポイントをクリックして削除できます'}
        {editMode === 'edit-straight' && '📏 2つのポイントを選択して区間を直線に設定します'}
        {editMode === 'edit-curve' && '〰️ 区間を選択して曲線（円弧）に設定します'}
      </div>

      {/* D3.js SVGチャート */}
      <div className={`chart-container mode-${editMode.replace('edit-', '')}`}>
        <svg ref={svgRef}></svg>
      </div>

      <style>{`
        .draggable-restoration-chart {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .help-message {
          padding: 14px 18px;
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 2px solid #fbbf24;
          border-radius: 8px;
          color: #92400e;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(251, 191, 36, 0.1);
        }

        .help-message.primary {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #1e40af;
          border: 2px solid #3b82f6;
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
          animation: highlight 2s ease-in-out;
        }

        .help-message.info {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #d1d5db;
          box-shadow: none;
        }

        @keyframes highlight {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }

        .drag-help {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .drag-icon {
          font-size: 28px;
          animation: wave 1.5s ease-in-out infinite;
        }

        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }

        .drag-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .drag-text strong {
          font-size: 15px;
          color: #1e40af;
        }

        .help-detail {
          font-size: 12px;
          color: #3730a3;
          opacity: 0.9;
        }

        .chart-container {
          margin-top: 16px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          width: 100%;
        }

        .chart-container svg {
          width: 100%;
          background: #f9fafb;
        }

        .plan-point {
          transition: all 0.2s ease;
        }

        .plan-point:hover {
          r: 10;
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
        }

        /* ドラッグ中のアニメーション */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2);
          }
        }

        /* モード別のカーソル表示 */
        .chart-container.mode-drag svg {
          cursor: grab;
        }

        .chart-container.mode-add svg {
          cursor: crosshair;
        }

        .chart-container.mode-delete svg {
          cursor: pointer;
        }

        /* ポイント追加時のプレビュー */
        .add-preview-point {
          fill: rgba(59, 130, 246, 0.5);
          stroke: #3b82f6;
          stroke-width: 2px;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default DraggableRestorationChart;
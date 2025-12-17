/**
 * リアルタイムプレビューコンポーネント
 * データ編集時の変更をリアルタイムで可視化
 * Phase 4実装 - リアルタイムプレビュー機能
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import './RealtimePreview.css';

interface DataPoint {
  distance: number;
  value: number;
  originalValue?: number;
  isDirty?: boolean;
}

interface PreviewProps {
  data: DataPoint[];
  originalData?: DataPoint[];
  title?: string;
  showDiff?: boolean;
  showStats?: boolean;
  autoScale?: boolean;
  refreshRate?: number; // ミリ秒
  onDataHover?: (point: DataPoint | null) => void;
  highlightChanges?: boolean;
  animateChanges?: boolean;
}

interface Statistics {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  changeRate?: number;
}

export const RealtimePreview: React.FC<PreviewProps> = ({
  data,
  originalData,
  title = 'リアルタイムプレビュー',
  showDiff = true,
  showStats = true,
  autoScale = true,
  refreshRate = 100,
  onDataHover,
  highlightChanges = true,
  animateChanges = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fps, setFps] = useState(0);
  const lastFrameTime = useRef(Date.now());
  const frameCount = useRef(0);

  // 統計計算
  const calculateStatistics = useCallback((points: DataPoint[]): Statistics => {
    if (points.length === 0) {
      return { min: 0, max: 0, mean: 0, stdDev: 0 };
    }

    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    const variance = values.reduce((sum, val) =>
      sum + Math.pow(val - mean, 2), 0
    ) / values.length;
    const stdDev = Math.sqrt(variance);

    // 変更率の計算
    let changeRate = 0;
    if (originalData && originalData.length === points.length) {
      const changes = points.map((p, i) =>
        Math.abs(p.value - (originalData[i]?.value || 0))
      );
      changeRate = changes.reduce((a, b) => a + b, 0) / points.length;
    }

    return { min, max, mean, stdDev, changeRate };
  }, [originalData]);

  // FPS計算
  const updateFPS = useCallback(() => {
    frameCount.current++;
    const now = Date.now();
    const elapsed = now - lastFrameTime.current;

    if (elapsed >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / elapsed));
      frameCount.current = 0;
      lastFrameTime.current = now;
    }
  }, []);

  // Canvas描画
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas サイズ設定
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // クリア
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (data.length === 0) return;

    // データ範囲計算
    const distances = data.map(p => p.distance);
    const values = data.map(p => p.value);
    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // パディング
    const padding = { top: 40, right: 60, bottom: 60, left: 80 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // スケール計算
    let xScale = scale.x;
    let yScale = scale.y;

    if (autoScale) {
      xScale = chartWidth / (maxDist - minDist || 1);
      yScale = chartHeight / (maxVal - minVal || 1);
    }

    // 座標変換関数
    const toScreenX = (dist: number) =>
      padding.left + (dist - minDist) * xScale + offset.x;
    const toScreenY = (val: number) =>
      padding.top + chartHeight - (val - minVal) * yScale + offset.y;

    // グリッド描画
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]);

    // 横グリッド
    const yGridCount = 10;
    for (let i = 0; i <= yGridCount; i++) {
      const y = padding.top + (chartHeight / yGridCount) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    // 縦グリッド
    const xGridCount = 20;
    for (let i = 0; i <= xGridCount; i++) {
      const x = padding.left + (chartWidth / xGridCount) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // 軸描画
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;

    // X軸
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // Y軸
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // 軸ラベル
    ctx.fillStyle = '#666666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // X軸ラベル
    ctx.fillText('距離 (m)', padding.left + chartWidth / 2, rect.height - 20);

    // Y軸ラベル
    ctx.save();
    ctx.translate(20, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('値 (mm)', 0, 0);
    ctx.restore();

    // 元データ描画（薄い線）
    if (showDiff && originalData && originalData.length > 0) {
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      originalData.forEach((point, i) => {
        const x = toScreenX(point.distance);
        const y = toScreenY(point.value);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // 現在のデータ描画
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = toScreenX(point.distance);
      const y = toScreenY(point.value);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // 変更点のハイライト
    if (highlightChanges && originalData) {
      data.forEach((point, i) => {
        if (point.isDirty ||
            (originalData[i] && Math.abs(point.value - originalData[i].value) > 0.1)) {
          const x = toScreenX(point.distance);
          const y = toScreenY(point.value);

          // 変更点を円でマーク
          ctx.fillStyle = animateChanges ?
            `rgba(255, 152, 0, ${0.5 + 0.5 * Math.sin(Date.now() * 0.005)})` :
            'rgba(255, 152, 0, 0.8)';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();

          // 差分線
          if (originalData[i]) {
            const origY = toScreenY(originalData[i].value);
            ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, origY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      });
    }

    // ホバー点の表示
    if (hoveredPoint) {
      const x = toScreenX(hoveredPoint.distance);
      const y = toScreenY(hoveredPoint.value);

      // 十字線
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // 横線
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // 縦線
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();

      ctx.setLineDash([]);

      // 点
      ctx.fillStyle = '#FF5252';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // ツールチップ
      const tooltipText = `距離: ${hoveredPoint.distance.toFixed(2)}m, 値: ${hoveredPoint.value.toFixed(2)}mm`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(x + 10, y - 30, tooltipText.length * 7, 25);
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tooltipText, x + 15, y - 15);
    }

    // FPS表示
    if (showStats) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(rect.width - 80, 10, 70, 25);
      ctx.fillStyle = '#00FF00';
      ctx.font = '14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${fps} FPS`, rect.width - 15, 28);
    }

    updateFPS();
  }, [data, originalData, scale, offset, hoveredPoint, autoScale,
      showDiff, highlightChanges, animateChanges, showStats, fps, updateFPS, calculateStatistics]);

  // アニメーションループ
  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  // データ変更時の統計更新
  useEffect(() => {
    if (showStats) {
      const stats = calculateStatistics(data);
      setStatistics(stats);
    }
  }, [data, showStats, calculateStatistics]);

  // マウスイベントハンドラー
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      // パン操作
      setOffset({
        x: offset.x + (x - dragStart.x),
        y: offset.y + (y - dragStart.y)
      });
      setDragStart({ x, y });
    } else {
      // ホバー検出
      const padding = { top: 40, right: 60, bottom: 60, left: 80 };
      const chartWidth = rect.width - padding.left - padding.right;
      const chartHeight = rect.height - padding.top - padding.bottom;

      if (x >= padding.left && x <= padding.left + chartWidth &&
          y >= padding.top && y <= padding.top + chartHeight) {

        // 最も近いデータ点を検索
        const distances = data.map(p => p.distance);
        const minDist = Math.min(...distances);
        const maxDist = Math.max(...distances);
        const xScale = chartWidth / (maxDist - minDist || 1);

        const dataX = minDist + (x - padding.left - offset.x) / xScale;

        let closestPoint = null;
        let minDistance = Infinity;

        data.forEach(point => {
          const dist = Math.abs(point.distance - dataX);
          if (dist < minDistance) {
            minDistance = dist;
            closestPoint = point;
          }
        });

        if (closestPoint && minDistance < 5 / xScale) {
          setHoveredPoint(closestPoint);
          onDataHover?.(closestPoint);
        } else {
          setHoveredPoint(null);
          onDataHover?.(null);
        }
      } else {
        setHoveredPoint(null);
        onDataHover?.(null);
      }
    }
  }, [data, isDragging, dragStart, offset, onDataHover]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // 左クリック
      setIsDragging(true);
      setDragStart({ x: e.clientX - canvasRef.current!.getBoundingClientRect().left, y: e.clientY - canvasRef.current!.getBoundingClientRect().top });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredPoint(null);
    onDataHover?.(null);
  }, [onDataHover]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale({
      x: scale.x * scaleFactor,
      y: scale.y * scaleFactor
    });
  }, [scale]);

  // リセットビュー
  const resetView = useCallback(() => {
    setScale({ x: 1, y: 1 });
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div className="realtime-preview">
      <div className="preview-header">
        <h3>{title}</h3>
        <div className="preview-controls">
          <button onClick={resetView} className="btn-reset">
            🔄 リセット
          </button>
          <label>
            <input
              type="checkbox"
              checked={autoScale}
              onChange={(e) => {/* autoScale toggle logic */}}
            />
            自動スケール
          </label>
        </div>
      </div>

      <div className="preview-canvas-container">
        <canvas
          ref={canvasRef}
          className="preview-canvas"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        />
      </div>

      {showStats && statistics && (
        <div className="preview-stats">
          <div className="stat-item">
            <span className="stat-label">最小値:</span>
            <span className="stat-value">{statistics.min.toFixed(2)}mm</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">最大値:</span>
            <span className="stat-value">{statistics.max.toFixed(2)}mm</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">平均:</span>
            <span className="stat-value">{statistics.mean.toFixed(2)}mm</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">標準偏差:</span>
            <span className="stat-value">{statistics.stdDev.toFixed(2)}</span>
          </div>
          {statistics.changeRate !== undefined && statistics.changeRate > 0 && (
            <div className="stat-item highlight">
              <span className="stat-label">変更率:</span>
              <span className="stat-value">{statistics.changeRate.toFixed(2)}mm</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
/**
 * 強化版ドラッグ&ドロップ計画線エディタ
 * 057資料18ページ「②復元波形計算、計画線の変更」の要件実装
 * 直感的なマウス操作で計画線を自由に編集可能
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Slider,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Undo,
  Redo,
  Save,
  RestartAlt,
  ZoomIn,
  ZoomOut,
  GridOn,
  Timeline,
  TouchApp,
  PanTool,
  Edit,
  Delete,
  Add,
  Remove,
  Straighten,
  ShowChart,
  AutoFixHigh
} from '@mui/icons-material';

interface DataPoint {
  distance: number;
  value: number;
}

interface ControlPoint {
  id: string;
  x: number;  // キャンバス座標
  y: number;  // キャンバス座標
  distance: number;  // 実際の距離
  value: number;     // 実際の値
  isSelected: boolean;
  isDragging: boolean;
  isLocked: boolean;
}

interface Props {
  restoredWaveform: DataPoint[];
  initialPlanLine?: DataPoint[];
  onPlanLineUpdate: (planLine: DataPoint[]) => void;
  height?: number;
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridInterval?: number;
}

const EnhancedDragDropPlanLineEditor: React.FC<Props> = ({
  restoredWaveform,
  initialPlanLine,
  onPlanLineUpdate,
  height = 500,
  showGrid: initialShowGrid = true,
  snapToGrid: initialSnapToGrid = false,
  gridInterval = 5
}) => {
  // キャンバス参照
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 表示設定
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [snapToGrid, setSnapToGrid] = useState(initialSnapToGrid);
  const [smoothness, setSmoothness] = useState(0.5);

  // 編集モード
  const [editMode, setEditMode] = useState<'select' | 'add' | 'delete'>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // コントロールポイント
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // 履歴管理
  const [history, setHistory] = useState<ControlPoint[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // フィードバック
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [tooltipText, setTooltipText] = useState('');

  // マウス位置
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // データ範囲計算
  const calculateDataRange = useCallback(() => {
    if (!restoredWaveform || restoredWaveform.length === 0) {
      return { minDist: 0, maxDist: 100, minVal: -50, maxVal: 50 };
    }

    const distances = restoredWaveform.map(p => p.distance);
    const values = restoredWaveform.map(p => p.value);

    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    const minVal = Math.min(...values) - 10;
    const maxVal = Math.max(...values) + 10;

    return { minDist, maxDist, minVal, maxVal };
  }, [restoredWaveform]);

  // 座標変換関数
  const dataToCanvas = useCallback((distance: number, value: number): { x: number, y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const { minDist, maxDist, minVal, maxVal } = calculateDataRange();

    const x = ((distance - minDist) / (maxDist - minDist)) * canvas.width * zoom + panX;
    const y = canvas.height - ((value - minVal) / (maxVal - minVal)) * canvas.height;

    return { x, y };
  }, [calculateDataRange, zoom, panX]);

  const canvasToData = useCallback((x: number, y: number): { distance: number, value: number } => {
    if (!canvasRef.current) return { distance: 0, value: 0 };

    const canvas = canvasRef.current;
    const { minDist, maxDist, minVal, maxVal } = calculateDataRange();

    const distance = ((x - panX) / (canvas.width * zoom)) * (maxDist - minDist) + minDist;
    const value = (1 - y / canvas.height) * (maxVal - minVal) + minVal;

    // グリッドスナップ
    if (snapToGrid) {
      const snappedValue = Math.round(value / gridInterval) * gridInterval;
      return { distance, value: snappedValue };
    }

    return { distance, value };
  }, [calculateDataRange, zoom, panX, snapToGrid, gridInterval]);

  // 初期化
  useEffect(() => {
    if (!restoredWaveform || restoredWaveform.length === 0) return;

    // 初期計画線の生成
    let planLine: DataPoint[];
    if (initialPlanLine && initialPlanLine.length > 0) {
      planLine = initialPlanLine;
    } else {
      // 移動平均による初期計画線
      const windowSize = Math.max(20, Math.floor(restoredWaveform.length / 50));
      planLine = restoredWaveform.map((point, i) => {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(restoredWaveform.length, i + Math.floor(windowSize / 2));
        const window = restoredWaveform.slice(start, end);
        const avgValue = window.reduce((sum, p) => sum + p.value, 0) / window.length;
        return { distance: point.distance, value: avgValue };
      });
    }

    // コントロールポイントの生成（20-30点程度）
    const numPoints = Math.min(30, Math.max(10, Math.floor(planLine.length / 50)));
    const step = Math.floor(planLine.length / numPoints);

    const points: ControlPoint[] = [];
    for (let i = 0; i < numPoints; i++) {
      const index = Math.min(i * step, planLine.length - 1);
      const dataPoint = planLine[index];
      const canvasPos = dataToCanvas(dataPoint.distance, dataPoint.value);

      points.push({
        id: `cp-${i}`,
        x: canvasPos.x,
        y: canvasPos.y,
        distance: dataPoint.distance,
        value: dataPoint.value,
        isSelected: false,
        isDragging: false,
        isLocked: false
      });
    }

    setControlPoints(points);
    addToHistory(points);
  }, [restoredWaveform, initialPlanLine, dataToCanvas]);

  // スプライン補間による曲線生成
  const generatePlanLine = useCallback((points: ControlPoint[]): DataPoint[] => {
    if (points.length === 0) return [];
    if (points.length === 1) return [{ distance: points[0].distance, value: points[0].value }];

    // ポイントを距離でソート
    const sortedPoints = [...points].sort((a, b) => a.distance - b.distance);

    // Catmull-Rom スプライン補間
    const result: DataPoint[] = [];
    const { minDist, maxDist } = calculateDataRange();
    const step = (maxDist - minDist) / 1000; // 1000点で補間

    for (let d = minDist; d <= maxDist; d += step) {
      // dに最も近い4点を見つける
      let p0, p1, p2, p3;

      for (let i = 0; i < sortedPoints.length - 1; i++) {
        if (d >= sortedPoints[i].distance && d <= sortedPoints[i + 1].distance) {
          p1 = sortedPoints[i];
          p2 = sortedPoints[i + 1];
          p0 = i > 0 ? sortedPoints[i - 1] : p1;
          p3 = i < sortedPoints.length - 2 ? sortedPoints[i + 2] : p2;

          // Catmull-Rom補間
          const t = (d - p1.distance) / (p2.distance - p1.distance);
          const t2 = t * t;
          const t3 = t2 * t;

          const v0 = p0.value;
          const v1 = p1.value;
          const v2 = p2.value;
          const v3 = p3.value;

          const tension = smoothness;
          const value = 0.5 * (
            (2 * v1) +
            (-v0 + v2) * t +
            (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
            (-v0 + 3 * v1 - 3 * v2 + v3) * t3
          ) * (1 - tension) + (v1 * (1 - t) + v2 * t) * tension;

          result.push({ distance: d, value });
          break;
        }
      }
    }

    return result;
  }, [calculateDataRange, smoothness]);

  // 履歴管理
  const addToHistory = (points: ControlPoint[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(points)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setControlPoints(JSON.parse(JSON.stringify(history[newIndex])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setControlPoints(JSON.parse(JSON.stringify(history[newIndex])));
    }
  };

  // マウスイベントハンドラ
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });
    setDragStart({ x, y });

    // パンモード（中ボタンまたはCtrl+左クリック）
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      setIsPanning(true);
      return;
    }

    // 左クリック
    if (e.button === 0) {
      // ポイント選択/ドラッグ開始
      const clickedPoint = findPointAt(x, y);

      if (clickedPoint) {
        if (editMode === 'delete') {
          // 削除モード
          deletePoint(clickedPoint.id);
        } else {
          // 選択/ドラッグモード
          if (!e.shiftKey) {
            // Shiftなし：単一選択
            setSelectedPoints(new Set([clickedPoint.id]));
          } else {
            // Shift：複数選択
            const newSelection = new Set(selectedPoints);
            if (newSelection.has(clickedPoint.id)) {
              newSelection.delete(clickedPoint.id);
            } else {
              newSelection.add(clickedPoint.id);
            }
            setSelectedPoints(newSelection);
          }

          setIsDragging(true);
          const selectedPoint = controlPoints.find(p => p.id === clickedPoint.id);
          if (selectedPoint) {
            setDragOffset({
              x: x - selectedPoint.x,
              y: y - selectedPoint.y
            });
          }
        }
      } else if (editMode === 'add') {
        // 追加モード：新しいポイントを追加
        const { distance, value } = canvasToData(x, y);
        addPoint(distance, value);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    // ホバー検出
    const hoveredPoint = findPointAt(x, y);
    setHoveredPoint(hoveredPoint ? hoveredPoint.id : null);

    // パン処理
    if (isPanning) {
      const dx = x - dragStart.x;
      setPanX(panX + dx);
      setDragStart({ x, y });
      return;
    }

    // ドラッグ処理
    if (isDragging && selectedPoints.size > 0) {
      const newPoints = controlPoints.map(point => {
        if (selectedPoints.has(point.id) && !point.isLocked) {
          const newX = x - dragOffset.x;
          const newY = y - dragOffset.y;
          const { distance, value } = canvasToData(newX, newY);

          return {
            ...point,
            x: newX,
            y: newY,
            distance,
            value,
            isDragging: true
          };
        }
        return point;
      });

      setControlPoints(newPoints);

      // リアルタイム更新
      const planLine = generatePlanLine(newPoints);
      onPlanLineUpdate(planLine);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && selectedPoints.size > 0) {
      // ドラッグ終了
      const newPoints = controlPoints.map(point => ({
        ...point,
        isDragging: false
      }));
      setControlPoints(newPoints);
      addToHistory(newPoints);
    }

    setIsDragging(false);
    setIsPanning(false);
  };

  // ポイント検索
  const findPointAt = (x: number, y: number): ControlPoint | null => {
    const threshold = 10; // クリック判定の閾値

    for (const point of controlPoints) {
      const dx = x - point.x;
      const dy = y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= threshold) {
        return point;
      }
    }

    return null;
  };

  // ポイント追加
  const addPoint = (distance: number, value: number) => {
    const canvasPos = dataToCanvas(distance, value);
    const newPoint: ControlPoint = {
      id: `cp-${Date.now()}`,
      x: canvasPos.x,
      y: canvasPos.y,
      distance,
      value,
      isSelected: false,
      isDragging: false,
      isLocked: false
    };

    const newPoints = [...controlPoints, newPoint].sort((a, b) => a.distance - b.distance);
    setControlPoints(newPoints);
    addToHistory(newPoints);

    // 計画線更新
    const planLine = generatePlanLine(newPoints);
    onPlanLineUpdate(planLine);
  };

  // ポイント削除
  const deletePoint = (pointId: string) => {
    const newPoints = controlPoints.filter(p => p.id !== pointId);
    setControlPoints(newPoints);
    addToHistory(newPoints);

    // 選択解除
    const newSelection = new Set(selectedPoints);
    newSelection.delete(pointId);
    setSelectedPoints(newSelection);

    // 計画線更新
    const planLine = generatePlanLine(newPoints);
    onPlanLineUpdate(planLine);
  };

  // 選択ポイント削除
  const deleteSelectedPoints = () => {
    const newPoints = controlPoints.filter(p => !selectedPoints.has(p.id));
    setControlPoints(newPoints);
    addToHistory(newPoints);
    setSelectedPoints(new Set());

    // 計画線更新
    const planLine = generatePlanLine(newPoints);
    onPlanLineUpdate(planLine);
  };

  // リセット
  const resetPlanLine = () => {
    if (history.length > 0) {
      setControlPoints(JSON.parse(JSON.stringify(history[0])));
      setHistoryIndex(0);
      setSelectedPoints(new Set());
    }
  };

  // 直線化
  const straightenPlanLine = () => {
    const avgValue = controlPoints.reduce((sum, p) => sum + p.value, 0) / controlPoints.length;
    const newPoints = controlPoints.map(point => {
      const canvasPos = dataToCanvas(point.distance, avgValue);
      return {
        ...point,
        y: canvasPos.y,
        value: avgValue
      };
    });

    setControlPoints(newPoints);
    addToHistory(newPoints);

    // 計画線更新
    const planLine = generatePlanLine(newPoints);
    onPlanLineUpdate(planLine);
  };

  // 自動最適化
  const autoOptimize = () => {
    // 復元波形に対して最適な計画線を生成
    const optimizedPoints = controlPoints.map(point => {
      // 近傍の復元波形データを取得
      const nearbyData = restoredWaveform.filter(
        p => Math.abs(p.distance - point.distance) < 10
      );

      if (nearbyData.length > 0) {
        // 加重平均で最適値を計算
        const weights = nearbyData.map(p => 1 / (1 + Math.abs(p.distance - point.distance)));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const optimalValue = nearbyData.reduce(
          (sum, p, i) => sum + p.value * weights[i], 0
        ) / totalWeight;

        const canvasPos = dataToCanvas(point.distance, optimalValue);
        return {
          ...point,
          y: canvasPos.y,
          value: optimalValue
        };
      }

      return point;
    });

    setControlPoints(optimizedPoints);
    addToHistory(optimizedPoints);

    // 計画線更新
    const planLine = generatePlanLine(optimizedPoints);
    onPlanLineUpdate(planLine);
  };

  // 保存
  const savePlanLine = () => {
    const planLine = generatePlanLine(controlPoints);
    onPlanLineUpdate(planLine);
    setShowSaveSuccess(true);
  };

  // キャンバス描画
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // グリッド描画
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;

      // 水平グリッド
      const { minVal, maxVal } = calculateDataRange();
      for (let v = Math.floor(minVal / gridInterval) * gridInterval; v <= maxVal; v += gridInterval) {
        const { y } = dataToCanvas(0, v);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 垂直グリッド
      const { minDist, maxDist } = calculateDataRange();
      const distInterval = (maxDist - minDist) / 20;
      for (let d = minDist; d <= maxDist; d += distInterval) {
        const { x } = dataToCanvas(d, 0);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    }

    // ゼロライン
    const { y: zeroY } = dataToCanvas(0, 0);
    ctx.strokeStyle = '#9e9e9e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(canvas.width, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 復元波形描画
    if (restoredWaveform.length > 0) {
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.beginPath();

      restoredWaveform.forEach((point, i) => {
        const { x, y } = dataToCanvas(point.distance, point.value);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // 計画線描画
    if (controlPoints.length > 1) {
      const planLine = generatePlanLine(controlPoints);

      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();

      planLine.forEach((point, i) => {
        const { x, y } = dataToCanvas(point.distance, point.value);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // コントロールポイント描画
    controlPoints.forEach(point => {
      // 接続線
      if (controlPoints.length > 1) {
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        const nextPoint = controlPoints.find(p => p.distance > point.distance);
        if (nextPoint) {
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(nextPoint.x, nextPoint.y);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }

      // ポイント本体
      const isHovered = hoveredPoint === point.id;
      const isSelected = selectedPoints.has(point.id);

      // 影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(point.x + 2, point.y + 2, 8, 0, Math.PI * 2);
      ctx.fill();

      // 外円
      if (isSelected) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // メイン円
      ctx.fillStyle = point.isLocked ? '#9E9E9E' :
                      point.isDragging ? '#FFC107' :
                      isSelected ? '#FF9800' :
                      isHovered ? '#8BC34A' :
                      '#4CAF50';

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 中心点
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(point.x, point.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // 値表示（ホバー時）
      if (isHovered) {
        ctx.fillStyle = 'rgba(33, 33, 33, 0.9)';
        ctx.fillRect(point.x + 15, point.y - 25, 100, 20);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px sans-serif';
        ctx.fillText(
          `${point.distance.toFixed(1)}m, ${point.value.toFixed(1)}mm`,
          point.x + 20,
          point.y - 10
        );
      }
    });

    // カーソル位置の情報表示
    if (mousePos.x > 0 && mousePos.y > 0) {
      const { distance, value } = canvasToData(mousePos.x, mousePos.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, canvas.height - 30, 200, 25);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `位置: ${distance.toFixed(1)}m, 値: ${value.toFixed(1)}mm`,
        15,
        canvas.height - 10
      );
    }

  }, [
    restoredWaveform,
    controlPoints,
    selectedPoints,
    hoveredPoint,
    mousePos,
    showGrid,
    gridInterval,
    zoom,
    panX,
    dataToCanvas,
    canvasToData,
    calculateDataRange,
    generatePlanLine
  ]);

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          🎯 強化版ドラッグ&ドロップ計画線エディタ
        </Typography>
        <Typography variant="body2" color="text.secondary">
          マウスで制御点をドラッグして計画線を自由に編集できます
        </Typography>
      </Box>

      {/* ツールバー */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 編集モード */}
        <ButtonGroup variant="contained" size="small">
          <Tooltip title="選択・移動モード">
            <Button
              onClick={() => setEditMode('select')}
              variant={editMode === 'select' ? 'contained' : 'outlined'}
              startIcon={<PanTool />}
            >
              選択
            </Button>
          </Tooltip>
          <Tooltip title="制御点追加モード">
            <Button
              onClick={() => setEditMode('add')}
              variant={editMode === 'add' ? 'contained' : 'outlined'}
              startIcon={<Add />}
            >
              追加
            </Button>
          </Tooltip>
          <Tooltip title="制御点削除モード">
            <Button
              onClick={() => setEditMode('delete')}
              variant={editMode === 'delete' ? 'contained' : 'outlined'}
              startIcon={<Delete />}
              color="error"
            >
              削除
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* 履歴操作 */}
        <ButtonGroup variant="outlined" size="small">
          <Tooltip title="元に戻す (Ctrl+Z)">
            <IconButton
              onClick={undo}
              disabled={historyIndex <= 0}
              size="small"
            >
              <Undo />
            </IconButton>
          </Tooltip>
          <Tooltip title="やり直し (Ctrl+Y)">
            <IconButton
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              size="small"
            >
              <Redo />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* 表示設定 */}
        <ButtonGroup variant="outlined" size="small">
          <Tooltip title="拡大">
            <IconButton
              onClick={() => setZoom(Math.min(zoom * 1.2, 5))}
              size="small"
            >
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="縮小">
            <IconButton
              onClick={() => setZoom(Math.max(zoom / 1.2, 0.5))}
              size="small"
            >
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="リセット表示">
            <IconButton
              onClick={() => {
                setZoom(1);
                setPanX(0);
              }}
              size="small"
            >
              <RestartAlt />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* 自動操作 */}
        <ButtonGroup variant="outlined" size="small">
          <Tooltip title="直線化">
            <Button
              onClick={straightenPlanLine}
              startIcon={<Straighten />}
              size="small"
            >
              直線化
            </Button>
          </Tooltip>
          <Tooltip title="自動最適化">
            <Button
              onClick={autoOptimize}
              startIcon={<AutoFixHigh />}
              size="small"
            >
              最適化
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* 設定 */}
        <FormControlLabel
          control={
            <Switch
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              size="small"
            />
          }
          label="グリッド"
        />

        <FormControlLabel
          control={
            <Switch
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              size="small"
            />
          }
          label="スナップ"
        />

        {/* 保存 */}
        <Button
          variant="contained"
          color="success"
          startIcon={<Save />}
          onClick={savePlanLine}
        >
          保存
        </Button>
      </Box>

      {/* 補間設定 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="body2" sx={{ minWidth: 80 }}>
          滑らかさ:
        </Typography>
        <Slider
          value={smoothness}
          onChange={(_, value) => setSmoothness(value as number)}
          min={0}
          max={1}
          step={0.1}
          sx={{ width: 200 }}
          valueLabelDisplay="auto"
        />
        <Chip
          label={`${(smoothness * 100).toFixed(0)}%`}
          size="small"
          color="primary"
        />
      </Box>

      {/* 情報表示 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip
          label={`制御点: ${controlPoints.length}個`}
          size="small"
          icon={<TouchApp />}
        />
        <Chip
          label={`選択: ${selectedPoints.size}個`}
          size="small"
          color={selectedPoints.size > 0 ? 'primary' : 'default'}
        />
        <Chip
          label={`ズーム: ${(zoom * 100).toFixed(0)}%`}
          size="small"
        />
        <Chip
          label={`モード: ${
            editMode === 'select' ? '選択' :
            editMode === 'add' ? '追加' : '削除'
          }`}
          size="small"
          color="secondary"
        />
      </Box>

      {/* 操作説明 */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>操作方法:</strong>
          • 制御点をドラッグして計画線を編集
          • Shift+クリックで複数選択
          • Ctrl+ドラッグまたは中ボタンで画面移動
          • 追加モードでクリックして制御点追加
          • 削除モードでクリックして制御点削除
        </Typography>
      </Alert>

      {/* キャンバス */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: height,
          border: '2px solid #e0e0e0',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: editMode === 'add' ? 'crosshair' :
                 editMode === 'delete' ? 'pointer' :
                 isDragging ? 'grabbing' :
                 isPanning ? 'move' :
                 'default'
        }}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={height}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </Box>

      {/* 保存成功通知 */}
      <Snackbar
        open={showSaveSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSaveSuccess(false)}
        message="計画線を保存しました"
      />
    </Paper>
  );
};

export { EnhancedDragDropPlanLineEditor };
export default EnhancedDragDropPlanLineEditor;
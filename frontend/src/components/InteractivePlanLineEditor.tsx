import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';

interface ControlPoint {
  index: number;
  value: number;
  isEditable: boolean;
}

interface InteractivePlanLineEditorProps {
  restoredWaveform: number[];
  initialPlanLine?: number[];
  dataInterval?: number;
  onPlanLineChange?: (newPlanLine: number[]) => void;
}

export const InteractivePlanLineEditor: React.FC<InteractivePlanLineEditorProps> = ({
  restoredWaveform,
  initialPlanLine,
  dataInterval: _dataInterval = 0.25,
  onPlanLineChange
}) => {
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [planLine, setPlanLine] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [kiyaFile, setKiyaFile] = useState<File | null>(null);
  const [selectedRail, setSelectedRail] = useState<'left' | 'right'>('left');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 初期計画線の生成 (移動平均による平滑化)
  const generateInitialPlanLine = useCallback(() => {
    if (initialPlanLine) {
      return initialPlanLine;
    }

    const windowSize = Math.min(200, Math.floor(restoredWaveform.length / 10));
    const smoothed = new Array(restoredWaveform.length);

    for (let i = 0; i < restoredWaveform.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(restoredWaveform.length, i + Math.floor(windowSize / 2));
      let sum = 0;
      let count = 0;

      for (let j = start; j < end; j++) {
        sum += restoredWaveform[j];
        count++;
      }

      smoothed[i] = sum / count;
    }

    return smoothed;
  }, [restoredWaveform, initialPlanLine]);

  // 初期化
  useEffect(() => {
    const initial = generateInitialPlanLine();
    setPlanLine(initial);

    // コントロールポイントの生成 (20個程度)
    const numPoints = Math.min(20, restoredWaveform.length);
    const step = Math.floor(restoredWaveform.length / numPoints);
    const points: ControlPoint[] = [];

    for (let i = 0; i < numPoints; i++) {
      const index = i * step;
      points.push({
        index: Math.min(index, restoredWaveform.length - 1),
        value: initial[Math.min(index, restoredWaveform.length - 1)],
        isEditable: true
      });
    }

    setControlPoints(points);
  }, [restoredWaveform, generateInitialPlanLine]);

  // スプライン補間
  const interpolateSpline = useCallback((points: ControlPoint[]): number[] => {
    if (points.length === 0) return planLine;

    const result = new Array(restoredWaveform.length);

    for (let i = 0; i < restoredWaveform.length; i++) {
      // 最も近い2つのコントロールポイントを見つけて線形補間
      let leftPoint = points[0];
      let rightPoint = points[points.length - 1];

      for (let j = 0; j < points.length - 1; j++) {
        if (i >= points[j].index && i < points[j + 1].index) {
          leftPoint = points[j];
          rightPoint = points[j + 1];
          break;
        }
      }

      // 線形補間
      if (leftPoint.index === rightPoint.index) {
        result[i] = leftPoint.value;
      } else {
        const t = (i - leftPoint.index) / (rightPoint.index - leftPoint.index);
        result[i] = leftPoint.value + t * (rightPoint.value - leftPoint.value);
      }
    }

    return result;
  }, [restoredWaveform.length, planLine]);

  // コントロールポイント更新
  const updateControlPoint = useCallback((pointIndex: number, newValue: number) => {
    const newPoints = [...controlPoints];
    newPoints[pointIndex].value = newValue;
    setControlPoints(newPoints);

    const newPlanLine = interpolateSpline(newPoints);
    setPlanLine(newPlanLine);

    if (onPlanLineChange) {
      onPlanLineChange(newPlanLine);
    }
  }, [controlPoints, interpolateSpline, onPlanLineChange]);

  // マウスドラッグハンドラ
  const handleMouseDown = (_e: React.MouseEvent<HTMLCanvasElement>, pointIndex: number) => {
    setIsDragging(true);
    setDraggedPointIndex(pointIndex);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || draggedPointIndex === null || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const _y = e.clientY - rect.top;

    // Y座標から値を計算
    const minValue = Math.min(...restoredWaveform);
    const maxValue = Math.max(...restoredWaveform);
    const range = maxValue - minValue;
    const padding = range * 0.1;

    const newValue = maxValue + padding - ((_y / canvas.height) * (range + 2 * padding));

    updateControlPoint(draggedPointIndex, newValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedPointIndex(null);
  };

  // キヤデータインポート処理
  const handleKiyaImport = async () => {
    if (!kiyaFile) return;

    try {
      const fileContent = await kiyaFile.text();
      const response = await axios.post('http://localhost:3002/api/restoration/import/kiya-o010', {
        csvContent: fileContent,
        railSide: selectedRail
      });

      if (response.data.success) {
        const importedPlanLine = response.data.planLine.map((p: any) => p.value);

        // 既存の波形データと長さを合わせる
        let alignedPlanLine = importedPlanLine;
        if (importedPlanLine.length !== restoredWaveform.length) {
          // リサンプリング（簡易的な線形補間）
          alignedPlanLine = new Array(restoredWaveform.length);
          const scale = (importedPlanLine.length - 1) / (restoredWaveform.length - 1);

          for (let i = 0; i < restoredWaveform.length; i++) {
            const sourceIndex = i * scale;
            const lowerIndex = Math.floor(sourceIndex);
            const upperIndex = Math.min(Math.ceil(sourceIndex), importedPlanLine.length - 1);
            const fraction = sourceIndex - lowerIndex;

            alignedPlanLine[i] = importedPlanLine[lowerIndex] * (1 - fraction) +
                                importedPlanLine[upperIndex] * fraction;
          }
        }

        setPlanLine(alignedPlanLine);
        if (onPlanLineChange) {
          onPlanLineChange(alignedPlanLine);
        }

        setShowImportDialog(false);
        alert(`キヤデータ（${selectedRail === 'left' ? '左' : '右'}レール）から計画線を生成しました`);
      }
    } catch (error) {
      console.error('Kiya import error:', error);
      alert('キヤデータのインポートに失敗しました');
    }
  };

  // キャンバス描画
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // クリア
    ctx.clearRect(0, 0, width, height);

    // スケール計算
    const minValue = Math.min(...restoredWaveform);
    const maxValue = Math.max(...restoredWaveform);
    const range = maxValue - minValue;
    const padding = range * 0.1;

    const scaleX = width / (restoredWaveform.length - 1);
    const scaleY = height / (range + 2 * padding);

    // 復元波形を描画
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    restoredWaveform.forEach((value, i) => {
      const x = i * scaleX;
      const y = height - ((value - (minValue - padding)) * scaleY);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // 計画線を描画
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();

    planLine.forEach((value, i) => {
      const x = i * scaleX;
      const y = height - ((value - (minValue - padding)) * scaleY);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
    ctx.setLineDash([]);

    // コントロールポイントを描画
    controlPoints.forEach((point, i) => {
      const x = point.index * scaleX;
      const y = height - ((point.value - (minValue - padding)) * scaleY);

      ctx.fillStyle = draggedPointIndex === i ? '#f59e0b' : '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

  }, [restoredWaveform, planLine, controlPoints, draggedPointIndex]);

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h4 style={{ margin: 0, color: '#374151' }}>計画線編集</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowImportDialog(true)}
              style={{
                padding: '6px 12px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              キヤデータ読込
            </button>
            <button
              onClick={() => {
                const newPlanLine = generateInitialPlanLine();
                setPlanLine(newPlanLine);
                if (onPlanLineChange) onPlanLineChange(newPlanLine);
              }}
              style={{
                padding: '6px 12px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              リセット
            </button>
            <button
              onClick={() => {
                const straightLine = new Array(restoredWaveform.length).fill(0);
                setPlanLine(straightLine);
                if (onPlanLineChange) onPlanLineChange(straightLine);
              }}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              直線化 (0mm)
            </button>
          </div>
        </div>

        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>
          緑色の点をドラッグして計画線を編集できます
        </p>

        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          onMouseDown={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // クリック位置に最も近いコントロールポイントを探す
            let nearestIndex = -1;
            let minDistance = Infinity;

            const scaleX = canvas.width / (restoredWaveform.length - 1);

            controlPoints.forEach((point, i) => {
              const pointX = point.index * scaleX;
              const distance = Math.abs(x - pointX);

              if (distance < minDistance && distance < 20) {
                minDistance = distance;
                nearestIndex = i;
              }
            });

            if (nearestIndex !== -1) {
              handleMouseDown(e, nearestIndex);
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            cursor: isDragging ? 'grabbing' : 'grab',
            width: '100%',
            height: 'auto'
          }}
        />
      </div>

      {/* キヤデータインポートダイアログ */}
      {showImportDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            maxWidth: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>
              キヤデータ（O010形式）インポート
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                CSVファイルを選択:
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setKiyaFile(e.target.files?.[0] || null)}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                使用するレール:
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="left"
                    checked={selectedRail === 'left'}
                    onChange={(e) => setSelectedRail(e.target.value as 'left' | 'right')}
                    style={{ marginRight: '6px' }}
                  />
                  左レール
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="right"
                    checked={selectedRail === 'right'}
                    onChange={(e) => setSelectedRail(e.target.value as 'left' | 'right')}
                    style={{ marginRight: '6px' }}
                  />
                  右レール
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowImportDialog(false);
                  setKiyaFile(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleKiyaImport}
                disabled={!kiyaFile}
                style={{
                  padding: '8px 16px',
                  background: kiyaFile ? '#8b5cf6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: kiyaFile ? 'pointer' : 'not-allowed'
                }}
              >
                インポート
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

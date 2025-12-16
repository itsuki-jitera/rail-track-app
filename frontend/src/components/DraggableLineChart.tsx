import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
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
  ChartEvent,
  ActiveElement,
  Chart
} from 'chart.js';

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
}

interface DraggableLineChartProps {
  data: DataPoint[];
  onDataChange: (data: DataPoint[]) => void;
  showGrid?: boolean;
  showLimits?: boolean;
}

export const DraggableLineChart: React.FC<DraggableLineChartProps> = ({
  data,
  onDataChange,
  showGrid = true,
  showLimits = true
}) => {
  const chartRef = useRef<Chart<'line'>>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragInfo, setDragInfo] = useState<{
    datasetIndex: number;
    index: number;
    startY: number;
  } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; value: number } | null>(null);

  // ドラッグ開始
  const handleMouseDown = useCallback((event: ChartEvent, elements: ActiveElement[]) => {
    if (elements.length > 0 && chartRef.current) {
      const element = elements[0];
      const datasetIndex = element.datasetIndex;
      const index = element.index;

      // 固定点はドラッグ不可
      if (data[index].isFixed) {
        return;
      }

      setIsDragging(true);
      setDragInfo({
        datasetIndex,
        index,
        startY: event.native?.clientY || 0
      });

      // カーソル変更
      if (chartRef.current.canvas) {
        chartRef.current.canvas.style.cursor = 'grabbing';
      }
    }
  }, [data]);

  // マウス移動処理
  useEffect(() => {
    if (!isDragging || !dragInfo || !chartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const chart = chartRef.current;
      if (!chart) return;

      const rect = chart.canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;

      // Y軸の値を計算
      const yAxis = dragInfo.datasetIndex === 0 ? chart.scales.y : chart.scales.y1;
      const value = yAxis.getValueForPixel(y);

      if (value !== undefined) {
        const newData = [...data];

        if (dragInfo.datasetIndex === 0) {
          // レベル（高低）の更新
          newData[dragInfo.index].targetLevel = Math.max(-30, Math.min(30, value));
        } else {
          // 通り（左右）の更新
          newData[dragInfo.index].targetAlignment = Math.max(-20, Math.min(20, value));
        }

        onDataChange(newData);

        // ホバー情報更新
        setHoverPoint({
          x: e.clientX,
          y: e.clientY,
          value: value
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragInfo(null);
      setHoverPoint(null);

      if (chartRef.current?.canvas) {
        chartRef.current.canvas.style.cursor = 'default';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragInfo, data, onDataChange]);

  // グラフデータ
  const chartData = {
    labels: data.map(p => p.position),
    datasets: [
      {
        label: 'レベル（高低）',
        data: data.map(p => p.targetLevel),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: data.map(p =>
          p.isFixed ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
        ),
        pointRadius: 8,
        pointHoverRadius: 10,
        pointBorderWidth: 2,
        pointBorderColor: '#fff',
        tension: 0,  // 直線で結ぶ（スムーズな曲線を無効化）
        yAxisID: 'y'
      },
      {
        label: '通り（左右）',
        data: data.map(p => p.targetAlignment),
        borderColor: 'rgb(236, 72, 153)',
        backgroundColor: data.map(p =>
          p.isFixed ? 'rgb(239, 68, 68)' : 'rgb(236, 72, 153)'
        ),
        pointRadius: 8,
        pointHoverRadius: 10,
        pointBorderWidth: 2,
        pointBorderColor: '#fff',
        tension: 0,  // 直線で結ぶ（スムーズな曲線を無効化）
        yAxisID: 'y1'
      }
    ]
  };

  // 制限値ライン
  if (showLimits) {
    chartData.datasets.push(
      {
        label: '上限',
        data: data.map(() => 25),
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderDash: [5, 5],
        pointRadius: 0,
        yAxisID: 'y',
        fill: false
      } as any,
      {
        label: '下限',
        data: data.map(() => -25),
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderDash: [5, 5],
        pointRadius: 0,
        yAxisID: 'y',
        fill: false
      } as any
    );
  }

  // 固定スケール設定（編集時に軸が動かないように）
  const getFixedScale = (values: number[], dataType: 'level' | 'alignment') => {
    if (values.length === 0) {
      return dataType === 'level' ? { min: -30, max: 30 } : { min: -20, max: 20 };
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // データ範囲に基づいて適切な固定範囲を設定
    // ただし、編集中でも変わらないように余裕を持たせる
    if (dataType === 'alignment') {
      // 通り狂い：最小でも±10mm表示
      if (maxValue < 5 && minValue > -5) {
        return { min: -10, max: 10 };  // 小さい値なら±10mm固定
      } else {
        // データ範囲+50%マージンで固定
        const margin = Math.max(10, Math.abs(maxValue - minValue) * 0.5);
        return { min: minValue - margin, max: maxValue + margin };
      }
    } else {
      // 高低狂い：最小でも±10mm表示
      if (maxValue < 5 && minValue > -5) {
        return { min: -10, max: 10 };  // 小さい値なら±10mm固定
      } else {
        // データ範囲+50%マージンで固定
        const margin = Math.max(10, Math.abs(maxValue - minValue) * 0.5);
        return { min: minValue - margin, max: maxValue + margin };
      }
    }
  };

  // 初回のみスケールを計算（その後は固定）
  const [levelScale] = useState(() => getFixedScale(data.map(p => p.targetLevel), 'level'));
  const [alignmentScale] = useState(() => getFixedScale(data.map(p => p.targetAlignment), 'alignment'));

  // グラフオプション
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'point'
    },
    onHover: (event, activeElements) => {
      if (chartRef.current?.canvas) {
        chartRef.current.canvas.style.cursor = activeElements.length > 0 ? 'grab' : 'default';
      }
    },
    onClick: handleMouseDown as any,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 14
          }
        }
      },
      title: {
        display: true,
        text: '計画線エディタ - 点をドラッグして編集',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: 20
      },
      tooltip: {
        enabled: !isDragging,
        callbacks: {
          title: (items) => `位置: ${items[0].label}m`,
          label: (item) => {
            const point = data[item.dataIndex];
            const isFixed = point.isFixed ? ' [固定点]' : '';
            return `${item.dataset.label}: ${item.parsed.y.toFixed(1)}mm${isFixed}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '位置 (m)',
          font: {
            size: 14
          }
        },
        grid: {
          display: showGrid,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'レベル (mm)',
          color: 'rgb(59, 130, 246)',
          font: {
            size: 14
          }
        },
        min: levelScale.min,
        max: levelScale.max,
        ticks: {
          stepSize: Math.abs(levelScale.max - levelScale.min) > 20 ? 5 : 2
        },
        grid: {
          display: showGrid,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: '通り (mm)',
          color: 'rgb(236, 72, 153)',
          font: {
            size: 14
          }
        },
        min: alignmentScale.min,
        max: alignmentScale.max,
        ticks: {
          stepSize: Math.abs(alignmentScale.max - alignmentScale.min) > 15 ? 5 : 2
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Line ref={chartRef} data={chartData} options={options} />

      {/* ドラッグ中の値表示 */}
      {isDragging && hoverPoint && dragInfo && (
        <div
          style={{
            position: 'fixed',
            left: hoverPoint.x + 15,
            top: hoverPoint.y - 40,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <div>位置: {data[dragInfo.index].position}m</div>
          <div style={{ color: dragInfo.datasetIndex === 0 ? '#60a5fa' : '#f472b6' }}>
            {dragInfo.datasetIndex === 0 ? 'レベル' : '通り'}: {hoverPoint.value.toFixed(1)}mm
          </div>
        </div>
      )}

      {/* 操作説明 */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '13px',
        color: '#666',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        💡 グラフ上の点をクリックしてドラッグすると値を変更できます（赤い点は固定）
      </div>
    </div>
  );
};
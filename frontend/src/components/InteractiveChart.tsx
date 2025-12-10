import React, { useRef, useEffect, useState } from 'react';
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
  InteractionItem
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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
}

interface InteractiveChartProps {
  data: DataPoint[];
  onDataChange: (newData: DataPoint[]) => void;
  height?: number;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  onDataChange,
  height = 400
}) => {
  const chartRef = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragDataset, setDragDataset] = useState<'level' | 'alignment' | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; value: number; position: number } | null>(null);

  const chartData = {
    labels: data.map(p => p.position),
    datasets: [
      {
        label: '計画線（レベル）',
        data: data.map(p => p.targetLevel),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(75, 192, 192)',
        pointBorderWidth: 2,
        tension: 0.2,
        yAxisID: 'y'
      },
      {
        label: '計画線（通り）',
        data: data.map(p => p.targetAlignment),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(255, 99, 132)',
        pointBorderWidth: 2,
        tension: 0.2,
        yAxisID: 'y1'
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'point'
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '計画線編集（ドラッグで値を変更）'
      },
      tooltip: {
        callbacks: {
          title: (context) => `位置: ${context[0].label}m`,
          label: (context) => {
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y;
            return `${datasetLabel}: ${value.toFixed(1)}mm`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '位置 (m)'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'レベル (mm)',
          color: 'rgb(75, 192, 192)'
        },
        min: -20,
        max: 30
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '通り (mm)',
          color: 'rgb(255, 99, 132)'
        },
        grid: {
          drawOnChartArea: false
        },
        min: -20,
        max: 20
      }
    },
    onHover: (event, activeElements) => {
      const chart = chartRef.current;
      if (chart) {
        chart.canvas.style.cursor = activeElements.length > 0 ? 'grab' : 'default';
      }
    }
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const canvas = chart.canvas;

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const canvasPosition = ChartJS.instances[0].getElementsAtEventForMode(
        e as any,
        'nearest',
        { intersect: true },
        false
      );

      if (canvasPosition.length > 0) {
        const firstPoint = canvasPosition[0];
        setIsDragging(true);
        setDragIndex(firstPoint.index);
        setDragDataset(firstPoint.datasetIndex === 0 ? 'level' : 'alignment');
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || dragIndex === null || !dragDataset) return;

      const rect = canvas.getBoundingClientRect();
      const chart = chartRef.current;

      if (!chart) return;

      // マウス位置をチャート座標に変換
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const chartArea = chart.chartArea;
      if (!chartArea) return;

      // Y軸の値を計算
      const yAxis = dragDataset === 'level' ? chart.scales.y : chart.scales.y1;
      const yValue = yAxis.getValueForPixel(y);

      if (yValue !== undefined) {
        const newData = [...data];

        // 値を更新（-20〜30mmの範囲内に制限）
        if (dragDataset === 'level') {
          newData[dragIndex].targetLevel = Math.max(-20, Math.min(30, yValue));
        } else {
          newData[dragIndex].targetAlignment = Math.max(-20, Math.min(20, yValue));
        }

        onDataChange(newData);

        // ホバー情報を更新
        setHoverInfo({
          x: e.clientX,
          y: e.clientY,
          value: yValue,
          position: data[dragIndex].position
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragIndex(null);
      setDragDataset(null);
      setHoverInfo(null);
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragIndex, dragDataset, data, onDataChange]);

  return (
    <div style={{ position: 'relative', height: `${height}px` }}>
      <Line ref={chartRef} options={options} data={chartData} />

      {/* ドラッグ中の値表示 */}
      {isDragging && hoverInfo && (
        <div
          style={{
            position: 'fixed',
            left: hoverInfo.x + 10,
            top: hoverInfo.y - 40,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <div>位置: {hoverInfo.position}m</div>
          <div>
            {dragDataset === 'level' ? 'レベル' : '通り'}: {hoverInfo.value.toFixed(1)}mm
          </div>
        </div>
      )}

      {/* 操作説明 */}
      <div style={{
        marginTop: '10px',
        padding: '10px',
        background: '#f0f8ff',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>💡 ドラッグ操作:</strong>
        グラフ上の点をクリックしてドラッグすると値を変更できます。
        青い点はレベル（高低）、赤い点は通り（左右）を調整します。
      </div>
    </div>
  );
};
/**
 * アノテーション機能付きグラフコンポーネント
 * 曲線・構造物情報をグラフ上に表示
 */
import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { Line } from 'react-chartjs-2'
import { useKiyaStore } from '../stores/kiyaStore'
import './ChartDisplay.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
)

interface TrackData {
  distance: number
  irregularity: number
}

interface ChartWithAnnotationsProps {
  originalData: TrackData[]
  restoredData?: TrackData[]
}

export const ChartWithAnnotations: React.FC<ChartWithAnnotationsProps> = ({
  originalData,
  restoredData
}) => {
  const { curves, structures, selectedCurveId, selectCurve } = useKiyaStore()

  // グラフのラベルとデータ
  const labels = originalData.map(d => d.distance.toFixed(1))

  const datasets = [
    {
      label: '元データ (Original)',
      data: originalData.map(d => d.irregularity),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      tension: 0.1,
      pointRadius: 1,
      pointHoverRadius: 5,
    }
  ]

  if (restoredData) {
    datasets.push({
      label: '復元データ (Restored)',
      data: restoredData.map(d => d.irregularity),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
      tension: 0.1,
      pointRadius: 1,
      pointHoverRadius: 5,
    })
  }

  const data = {
    labels,
    datasets
  }

  // 曲線アノテーションの生成
  const curveAnnotations = useMemo(() => {
    if (curves.length === 0) return {}

    const annotations: any = {}

    curves.forEach((curve) => {
      if (!curve.end || !curve.radius) return

      // 距離をkmからmに変換
      const xMin = curve.start * 1000
      const xMax = curve.end * 1000

      const isSelected = selectedCurveId === curve.id

      annotations[`curve_${curve.id}`] = {
        type: 'box',
        xMin: xMin,
        xMax: xMax,
        backgroundColor: curve.direction === 'left'
          ? (isSelected ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255, 193, 7, 0.1)')
          : (isSelected ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)'),
        borderColor: curve.direction === 'left'
          ? (isSelected ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255, 193, 7, 0.4)')
          : (isSelected ? 'rgba(33, 150, 243, 0.8)' : 'rgba(33, 150, 243, 0.4)'),
        borderWidth: isSelected ? 2 : 1,
        label: {
          display: true,
          content: `R${curve.radius}`,
          position: 'start',
          font: {
            size: isSelected ? 11 : 9
          },
          color: curve.direction === 'left' ? '#f57c00' : '#1976d2'
        },
        click: () => {
          selectCurve(curve.id)
        }
      }
    })

    return annotations
  }, [curves, selectedCurveId, selectCurve])

  // 構造物アノテーションの生成
  const structureAnnotations = useMemo(() => {
    if (structures.length === 0) return {}

    const annotations: any = {}

    structures.forEach((structure) => {
      if (!structure.end) return

      const xMin = structure.start * 1000
      const xMax = structure.end * 1000

      const isTunnel = structure.type === 'tunnel'
      const isBridge = structure.type === 'bridge'

      if (!isTunnel && !isBridge) return

      annotations[`structure_${structure.id}`] = {
        type: 'box',
        xMin: xMin,
        xMax: xMax,
        yScaleID: 'y',
        yMin: (ctx: any) => ctx.chart.scales.y.min,
        yMax: (ctx: any) => ctx.chart.scales.y.max,
        backgroundColor: isTunnel
          ? 'rgba(158, 158, 158, 0.15)'
          : 'rgba(139, 195, 74, 0.15)',
        borderColor: isTunnel
          ? 'rgba(97, 97, 97, 0.3)'
          : 'rgba(104, 159, 56, 0.3)',
        borderWidth: 1,
        borderDash: [5, 5],
        label: {
          display: (xMax - xMin) > 50, // 50m以上の場合のみラベル表示
          content: isTunnel ? 'トンネル' : '橋梁',
          position: 'center',
          font: {
            size: 9
          },
          color: isTunnel ? '#616161' : '#689f38'
        }
      }
    })

    return annotations
  }, [structures])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '軌道狂い量の推移 (Track Irregularity with Curve Information)',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || ''
            if (label) {
              label += ': '
            }
            label += context.parsed.y.toFixed(2) + ' mm'
            return label
          }
        }
      },
      annotation: {
        annotations: {
          ...structureAnnotations,
          ...curveAnnotations
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '距離 (m)'
        },
        ticks: {
          maxTicksLimit: 20
        }
      },
      y: {
        title: {
          display: true,
          text: '軌道狂い量 (mm)'
        }
      }
    },
    onClick: (_event: any, activeElements: any[], _chart: any) => {
      // グラフクリック時の処理（曲線選択解除など）
      if (activeElements.length === 0 && selectedCurveId) {
        selectCurve(null)
      }
    }
  }

  return (
    <div className="chart-display">
      <div className="chart-container" style={{ height: '500px' }}>
        <Line data={data} options={options} />
      </div>

      {curves.length > 0 && (
        <div className="chart-legend-custom">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(33, 150, 243, 0.3)' }}></div>
            <span>右曲線</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(255, 193, 7, 0.3)' }}></div>
            <span>左曲線</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(158, 158, 158, 0.3)' }}></div>
            <span>トンネル</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(139, 195, 74, 0.3)' }}></div>
            <span>橋梁</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChartWithAnnotations

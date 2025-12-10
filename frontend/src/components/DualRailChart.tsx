import React from 'react'
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
import { Line } from 'react-chartjs-2'
import './DualRailChart.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface TrackData {
  distance: number
  irregularity: number
}

interface DualRailChartProps {
  leftRail: TrackData[]
  rightRail: TrackData[]
  leftRailRestored?: TrackData[]
  rightRailRestored?: TrackData[]
  showLeft?: boolean
  showRight?: boolean
  peaks?: {
    leftPeaks?: any[]
    rightPeaks?: any[]
  }
}

const DualRailChart: React.FC<DualRailChartProps> = ({
  leftRail,
  rightRail,
  leftRailRestored,
  rightRailRestored,
  showLeft = true,
  showRight = true,
  peaks
}) => {
  // 距離の共通ラベルを作成（左右で距離が同じと仮定）
  const labels = leftRail.map(d => d.distance.toFixed(1))

  const datasets = []

  // 左レール元データ
  if (showLeft && leftRail.length > 0) {
    datasets.push({
      label: '左レール元データ (Left Rail Original)',
      data: leftRail.map(d => d.irregularity),
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      tension: 0.1,
      pointRadius: 2,
      pointHoverRadius: 5,
    })
  }

  // 左レール復元データ
  if (showLeft && leftRailRestored && leftRailRestored.length > 0) {
    datasets.push({
      label: '左レール復元データ (Left Rail Restored)',
      data: leftRailRestored.map(d => d.irregularity),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      tension: 0.1,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderDash: [5, 5],
    })
  }

  // 右レール元データ
  if (showRight && rightRail.length > 0) {
    datasets.push({
      label: '右レール元データ (Right Rail Original)',
      data: rightRail.map(d => d.irregularity),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
      tension: 0.1,
      pointRadius: 2,
      pointHoverRadius: 5,
    })
  }

  // 右レール復元データ
  if (showRight && rightRailRestored && rightRailRestored.length > 0) {
    datasets.push({
      label: '右レール復元データ (Right Rail Restored)',
      data: rightRailRestored.map(d => d.irregularity),
      borderColor: 'rgb(255, 159, 64)',
      backgroundColor: 'rgba(255, 159, 64, 0.5)',
      tension: 0.1,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderDash: [5, 5],
    })
  }

  const data = {
    labels,
    datasets
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '左右レール別軌道狂い量の推移',
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
    }
  }

  return (
    <div className="dual-rail-chart">
      <div className="chart-container">
        <Line data={data} options={options} />
      </div>

      {peaks && ((peaks.leftPeaks && peaks.leftPeaks.length > 0) || (peaks.rightPeaks && peaks.rightPeaks.length > 0)) && (
        <div className="peak-info">
          {peaks.leftPeaks && peaks.leftPeaks.length > 0 && (
            <div className="peak-count left">
              <span className="icon">📍</span>
              左レールピーク: <strong>{peaks.leftPeaks.length}</strong>箇所
            </div>
          )}
          {peaks.rightPeaks && peaks.rightPeaks.length > 0 && (
            <div className="peak-count right">
              <span className="icon">📍</span>
              右レールピーク: <strong>{peaks.rightPeaks.length}</strong>箇所
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DualRailChart

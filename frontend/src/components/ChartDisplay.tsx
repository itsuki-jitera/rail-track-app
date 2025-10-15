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
import './ChartDisplay.css'

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

interface ChartDisplayProps {
  originalData: TrackData[]
  restoredData?: TrackData[]
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({ originalData, restoredData }) => {
  const labels = originalData.map(d => d.distance.toFixed(1))

  const datasets = [
    {
      label: '元データ (Original)',
      data: originalData.map(d => d.irregularity),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      tension: 0.1,
      pointRadius: 2,
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
      pointRadius: 2,
      pointHoverRadius: 5,
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
        text: '軌道狂い量の推移 (Track Irregularity)',
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
    <div className="chart-display">
      <div className="chart-container">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export default ChartDisplay
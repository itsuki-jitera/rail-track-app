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

interface Peak {
  index: number
  distance: number
  value: number
  type: 'maximum' | 'minimum' | 'local_maximum' | 'local_minimum'
  prominence?: number
}

interface Outlier {
  index: number
  distance: number
  value: number
  deviation: number
  type: 'high' | 'low'
}

interface ChartDisplayProps {
  originalData: TrackData[]
  restoredData?: TrackData[]
  peaks?: Peak[]
  outliers?: Outlier[]
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({ originalData, restoredData, peaks, outliers }) => {
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

  // ピーク（極大値）のプロット
  if (peaks && peaks.length > 0) {
    const maximaPeaks = peaks.filter(p => p.type === 'maximum' || p.type === 'local_maximum')
    const minimaPeaks = peaks.filter(p => p.type === 'minimum' || p.type === 'local_minimum')

    if (maximaPeaks.length > 0) {
      const maximaData = new Array(originalData.length).fill(null)
      maximaPeaks.forEach(peak => {
        maximaData[peak.index] = peak.value
      })
      datasets.push({
        label: 'ピーク（極大）',
        data: maximaData,
        borderColor: 'rgb(255, 0, 0)',
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        tension: 0,
        pointRadius: 6,
        pointHoverRadius: 8,
      } as any)
    }

    if (minimaPeaks.length > 0) {
      const minimaData = new Array(originalData.length).fill(null)
      minimaPeaks.forEach(peak => {
        minimaData[peak.index] = peak.value
      })
      datasets.push({
        label: 'ピーク（極小）',
        data: minimaData,
        borderColor: 'rgb(0, 0, 255)',
        backgroundColor: 'rgba(0, 0, 255, 0.8)',
        tension: 0,
        pointRadius: 6,
        pointHoverRadius: 8,
      } as any)
    }
  }

  // 異常値のプロット
  if (outliers && outliers.length > 0) {
    const outlierData = new Array(originalData.length).fill(null)
    outliers.forEach(outlier => {
      outlierData[outlier.index] = outlier.value
    })
    datasets.push({
      label: '異常値',
      data: outlierData,
      borderColor: 'rgb(211, 47, 47)',
      backgroundColor: 'rgba(211, 47, 47, 1)',
      tension: 0,
      pointRadius: 8,
      pointHoverRadius: 10,
      pointStyle: 'circle',
    } as any)
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
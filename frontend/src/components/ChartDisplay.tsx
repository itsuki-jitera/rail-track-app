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
  workDirection?: 'forward' | 'backward'  // 作業方向（forward: 下り, backward: 上り）
  railSide?: 'left' | 'right'  // レール位置（作業方向を向いて左右）
  dataType?: 'level' | 'alignment'  // データタイプ（高低 or 通り）
  showKilometer?: boolean  // キロ程表示の有無
  wbSections?: Array<{ start: number; end: number; type: string }>  // WB区間情報
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({
  originalData,
  restoredData,
  peaks,
  outliers,
  workDirection = 'forward',
  railSide = 'left',
  dataType = 'level',
  showKilometer = false,
  wbSections = []
}) => {
  // 作業方向によってデータを反転
  const processedData = workDirection === 'backward'
    ? [...originalData].reverse()
    : originalData;

  const processedRestoredData = restoredData && workDirection === 'backward'
    ? [...restoredData].reverse()
    : restoredData;

  const labels = processedData.map(d => {
    if (showKilometer) {
      // キロ程表示（データ数 × データ間隔）
      const km = (d.distance / 1000).toFixed(3);
      return `${km}km`;
    }
    return d.distance.toFixed(1);
  })

  // レール位置とデータタイプに応じたラベル
  const getDataLabel = (baseLabel: string) => {
    const railLabel = railSide === 'left' ? '左レール' : '右レール';
    const typeLabel = dataType === 'level' ? '高低' : '通り';
    return `${baseLabel} (${railLabel} - ${typeLabel})`;
  };

  const datasets = [
    {
      label: getDataLabel('元データ'),
      data: processedData.map(d => d.irregularity),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      tension: 0.1,
      pointRadius: 2,
      pointHoverRadius: 5,
    }
  ]

  if (processedRestoredData) {
    datasets.push({
      label: getDataLabel('復元データ'),
      data: processedRestoredData.map(d => d.irregularity),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
      tension: 0.1,
      pointRadius: 2,
      pointHoverRadius: 5,
    })
  }

  // WB区間のハイライト表示
  if (wbSections.length > 0) {
    wbSections.forEach((wb, index) => {
      const wbData = new Array(processedData.length).fill(null);
      processedData.forEach((d, i) => {
        if (d.distance >= wb.start && d.distance <= wb.end) {
          wbData[i] = 0;  // WB区間を0レベルで表示
        }
      });
      datasets.push({
        label: `WB区間 ${index + 1}`,
        data: wbData,
        borderColor: 'rgba(255, 165, 0, 0.5)',
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        fill: true,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
      } as any);
    });
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

  // チャートタイトルの設定
  const getChartTitle = () => {
    const directionText = workDirection === 'forward' ? '下り方向' : '上り方向';
    const railText = railSide === 'left' ? '左レール' : '右レール';
    const typeText = dataType === 'level' ? '高低狂い（横から見た視点）' : '通り狂い（上から見た視点）';
    return `${typeText} - ${railText} [${directionText}]`;
  };

  // Y軸ラベルの設定（データタイプに応じて変更）
  const getYAxisLabel = () => {
    if (dataType === 'level') {
      return '高低狂い量 (mm) ↑上方向';
    } else {
      return '通り狂い量 (mm) ←左 | 右→';
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: getChartTitle(),
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

            // WB区間の場合は追加情報を表示
            if (label.includes('WB区間')) {
              return label + ' (橋梁/トンネル等)';
            }
            return label
          }
        }
      },
      annotation: wbSections.length > 0 ? {
        annotations: wbSections.map((wb, index) => ({
          type: 'box' as const,
          xMin: wb.start,
          xMax: wb.end,
          backgroundColor: 'rgba(255, 165, 0, 0.1)',
          borderColor: 'rgba(255, 165, 0, 0.3)',
          borderWidth: 1,
          label: {
            display: true,
            content: `WB${index + 1}`,
            position: 'start' as const,
          }
        }))
      } : undefined
    },
    scales: {
      x: {
        title: {
          display: true,
          text: showKilometer
            ? `キロ程 (km) ${workDirection === 'forward' ? '→' : '←'} ${workDirection === 'forward' ? '下り方向' : '上り方向'}`
            : `距離 (m) ${workDirection === 'forward' ? '→' : '←'} ${workDirection === 'forward' ? '下り方向' : '上り方向'}`
        },
        reverse: workDirection === 'backward',  // 上り方向の場合はX軸を反転
        ticks: {
          maxTicksLimit: 20
        }
      },
      y: {
        title: {
          display: true,
          text: getYAxisLabel()
        },
        // 通り狂いの場合、正の値を右、負の値を左として表示
        grid: {
          drawBorder: true,
          color: (context: any) => {
            if (dataType === 'alignment' && context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.5)';  // ゼロラインを強調
            }
            return 'rgba(0, 0, 0, 0.1)';
          }
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
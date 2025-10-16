import React from 'react'
import './DualRailStatistics.css'

interface RailStatistics {
  min: number
  max: number
  avg: number
  stdDev: number
}

interface DualRailStatisticsProps {
  leftRail: RailStatistics
  rightRail: RailStatistics
  showComparison?: boolean
}

const DualRailStatistics: React.FC<DualRailStatisticsProps> = ({
  leftRail,
  rightRail,
  showComparison = true
}) => {
  const difference = {
    min: Math.abs(leftRail.min - rightRail.min),
    max: Math.abs(leftRail.max - rightRail.max),
    avg: Math.abs(leftRail.avg - rightRail.avg),
    stdDev: Math.abs(leftRail.stdDev - rightRail.stdDev)
  }

  const StatRow = ({ label, leftValue, rightValue, diff }: {
    label: string
    leftValue: number
    rightValue: number
    diff: number
  }) => (
    <tr>
      <td className="label">{label}</td>
      <td className="value left">{leftValue.toFixed(2)} mm</td>
      <td className="value right">{rightValue.toFixed(2)} mm</td>
      {showComparison && (
        <td className="diff">
          {diff > 0.5 && <span className="warning-icon">⚠️</span>}
          {diff.toFixed(2)} mm
        </td>
      )}
    </tr>
  )

  return (
    <div className="dual-rail-statistics">
      <h3>左右レール別統計情報</h3>

      <table className="stats-table">
        <thead>
          <tr>
            <th>項目</th>
            <th className="left-header">左レール</th>
            <th className="right-header">右レール</th>
            {showComparison && <th>差分</th>}
          </tr>
        </thead>
        <tbody>
          <StatRow
            label="最小値 (Min)"
            leftValue={leftRail.min}
            rightValue={rightRail.min}
            diff={difference.min}
          />
          <StatRow
            label="最大値 (Max)"
            leftValue={leftRail.max}
            rightValue={rightRail.max}
            diff={difference.max}
          />
          <StatRow
            label="平均値 (Avg)"
            leftValue={leftRail.avg}
            rightValue={rightRail.avg}
            diff={difference.avg}
          />
          <StatRow
            label="標準偏差 (StdDev)"
            leftValue={leftRail.stdDev}
            rightValue={rightRail.stdDev}
            diff={difference.stdDev}
          />
        </tbody>
      </table>

      {showComparison && (
        <div className="comparison-note">
          <p>
            <strong>差分分析:</strong>
            {difference.avg < 0.5 ? (
              <span className="good"> 左右レールのバランスは良好です</span>
            ) : difference.avg < 2.0 ? (
              <span className="warning"> 左右レールに若干の差異があります</span>
            ) : (
              <span className="danger"> 左右レールに大きな差異があります。要確認</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export default DualRailStatistics

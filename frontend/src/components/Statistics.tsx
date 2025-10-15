import React from 'react'
import './Statistics.css'

interface StatisticsProps {
  title: string
  statistics: {
    min: number
    max: number
    avg: number
    stdDev: number
  }
}

const Statistics: React.FC<StatisticsProps> = ({ title, statistics }) => {
  return (
    <div className="statistics">
      <h3>{title}</h3>
      <div className="stat-item">
        <span className="stat-label">最小値 (Min):</span>
        <span className="stat-value">{statistics.min.toFixed(2)} mm</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">最大値 (Max):</span>
        <span className="stat-value">{statistics.max.toFixed(2)} mm</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">平均値 (Avg):</span>
        <span className="stat-value">{statistics.avg.toFixed(2)} mm</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">標準偏差 (StdDev):</span>
        <span className="stat-value">{statistics.stdDev.toFixed(2)} mm</span>
      </div>
    </div>
  )
}

export default Statistics
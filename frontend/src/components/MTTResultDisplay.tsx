import React from 'react'
import './MTTResultDisplay.css'

interface MTTResult {
  success: boolean
  results?: Array<{
    distance: number
    measured: number
    cant: number
    slack: number
    cantCorrection: number
    slackCorrection: number
    bcValue: number
    cdValue: number
  }>
  statistics?: {
    bc: {
      min: number
      max: number
      avg: number
      stdDev: number
    }
    cd: {
      min: number
      max: number
      avg: number
      stdDev: number
    }
  }
  evaluation?: {
    bcWarnings: {
      count: number
      warnings: any[]
    }
    cdWarnings: {
      count: number
      warnings: any[]
    }
    summary: {
      totalWarnings: number
      highSeverityCount: number
      evaluation: string
    }
  }
}

interface MTTResultDisplayProps {
  result: MTTResult
  showDetailedTable?: boolean
  maxRowsToShow?: number
}

const MTTResultDisplay: React.FC<MTTResultDisplayProps> = ({
  result,
  showDetailedTable = false,
  maxRowsToShow = 10
}) => {
  if (!result.success || !result.statistics) {
    return (
      <div className="mtt-result-display error">
        <p>MTT値計算結果がありません</p>
      </div>
    )
  }

  const { statistics, evaluation } = result

  return (
    <div className="mtt-result-display">
      <h3>MTT値計算結果</h3>

      {/* 総合評価 */}
      {evaluation && (
        <div className={`evaluation-summary ${evaluation.summary.evaluation === '良好' ? 'good' : 'warning'}`}>
          <div className="eval-header">
            <span className="icon">{evaluation.summary.evaluation === '良好' ? '✅' : '⚠️'}</span>
            <span className="eval-text">総合評価: <strong>{evaluation.summary.evaluation}</strong></span>
          </div>
          <div className="eval-details">
            <div className="eval-item">
              <span className="label">警告箇所:</span>
              <span className="value">{evaluation.summary.totalWarnings}箇所</span>
            </div>
            <div className="eval-item">
              <span className="label">高重要度:</span>
              <span className="value">{evaluation.summary.highSeverityCount}箇所</span>
            </div>
          </div>
        </div>
      )}

      {/* BC/CD統計 */}
      <div className="stats-grid">
        <div className="stat-card bc">
          <h4>BC値統計 (補正前)</h4>
          <div className="stat-row">
            <span>最小値:</span>
            <span className="value">{statistics.bc.min.toFixed(2)} mm</span>
          </div>
          <div className="stat-row">
            <span>最大値:</span>
            <span className="value">{statistics.bc.max.toFixed(2)} mm</span>
          </div>
          <div className="stat-row">
            <span>平均値:</span>
            <span className="value">{statistics.bc.avg.toFixed(2)} mm</span>
          </div>
          <div className="stat-row">
            <span>標準偏差:</span>
            <span className="value">{statistics.bc.stdDev.toFixed(2)} mm</span>
          </div>
        </div>

        <div className="stat-card cd">
          <h4>CD値統計 (補正後)</h4>
          <div className="stat-row">
            <span>最小値:</span>
            <span className="value">{statistics.cd.min.toFixed(2)} mm</span>
          </div>
          <div className="stat-row">
            <span>最大値:</span>
            <span className="value">{statistics.cd.max.toFixed(2)} mm</span>
          </div>
          <div className="stat-row">
            <span>平均値:</span>
            <span className="value">{statistics.cd.avg.toFixed(2)} mm</span>
          </div>
          <div className="stat-row">
            <span>標準偏差:</span>
            <span className="value">{statistics.cd.stdDev.toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      {/* 警告一覧 */}
      {evaluation && (evaluation.bcWarnings.count > 0 || evaluation.cdWarnings.count > 0) && (
        <div className="warnings-section">
          <h4>⚠️ 警告箇所一覧</h4>

          {evaluation.bcWarnings.count > 0 && (
            <div className="warning-list">
              <h5>BC値警告 ({evaluation.bcWarnings.count}箇所)</h5>
              <ul>
                {evaluation.bcWarnings.warnings.slice(0, 5).map((w: any, idx: number) => (
                  <li key={idx} className={w.severity}>
                    距離 {w.distance.toFixed(1)}m: BC値 {w.bcValue.toFixed(2)}mm
                    <span className="severity-badge">{w.severity === 'high' ? '高' : '中'}</span>
                  </li>
                ))}
              </ul>
              {evaluation.bcWarnings.count > 5 && (
                <p className="more-info">他 {evaluation.bcWarnings.count - 5}箇所...</p>
              )}
            </div>
          )}

          {evaluation.cdWarnings.count > 0 && (
            <div className="warning-list">
              <h5>CD値警告 ({evaluation.cdWarnings.count}箇所)</h5>
              <ul>
                {evaluation.cdWarnings.warnings.slice(0, 5).map((w: any, idx: number) => (
                  <li key={idx} className={w.severity}>
                    距離 {w.distance.toFixed(1)}m: CD値 {w.cdValue.toFixed(2)}mm
                    <span className="severity-badge">{w.severity === 'high' ? '高' : '中'}</span>
                  </li>
                ))}
              </ul>
              {evaluation.cdWarnings.count > 5 && (
                <p className="more-info">他 {evaluation.cdWarnings.count - 5}箇所...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 詳細テーブル（オプション） */}
      {showDetailedTable && result.results && (
        <div className="detailed-table">
          <h4>詳細データ (先頭{maxRowsToShow}行)</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>距離(m)</th>
                  <th>測定値</th>
                  <th>カント</th>
                  <th>スラック</th>
                  <th>BC値</th>
                  <th>CD値</th>
                </tr>
              </thead>
              <tbody>
                {result.results.slice(0, maxRowsToShow).map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.distance.toFixed(1)}</td>
                    <td>{row.measured.toFixed(2)}</td>
                    <td>{row.cant.toFixed(2)}</td>
                    <td>{row.slack.toFixed(2)}</td>
                    <td className="bc-value">{row.bcValue.toFixed(2)}</td>
                    <td className="cd-value">{row.cdValue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.results.length > maxRowsToShow && (
            <p className="more-info">
              全{result.results.length}行中{maxRowsToShow}行を表示
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default MTTResultDisplay

import React, { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

interface MovementRestriction {
  startKP: number;
  endKP: number;
  standardLimit: number;
  maximumLimit: number;
  label?: string;
}

interface CurveSpecification {
  startKP: number;
  endKP: number;
  curveType: 'straight' | 'transition' | 'circular';
  radius?: number;
  cant?: number;
  direction?: 'left' | 'right';
  label?: string;
}

interface WaveformChartProps {
  restoredWaveform: number[];
  planLine?: number[];
  movement?: number[];
  kilometerPoints?: number[];
  dataInterval?: number;
  startKP?: number;
  showBrush?: boolean;
  height?: number;
  onPlanLineUpdate?: (newPlanLine: number[]) => void;
  movementRestrictions?: MovementRestriction[];
  curveSpecifications?: CurveSpecification[];
  standardLimit?: number;
  maximumLimit?: number;
}

export const WaveformChart: React.FC<WaveformChartProps> = ({
  restoredWaveform,
  planLine,
  movement,
  kilometerPoints,
  dataInterval = 0.25,
  startKP = 0,
  showBrush = true,
  height = 400,
  onPlanLineUpdate: _onPlanLineUpdate,
  movementRestrictions: _movementRestrictions = [],
  curveSpecifications = [],
  standardLimit = 30,
  maximumLimit = 50
}) => {
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);

  // チャートデータの準備
  const chartData = restoredWaveform.map((value, index) => {
    const kp = kilometerPoints ? kilometerPoints[index] : startKP + index * dataInterval;
    const movementValue = movement ? Math.abs(movement[index]) : 0;
    const isStandardExceeded = movementValue > standardLimit;
    const isMaximumExceeded = movementValue > maximumLimit;

    return {
      index,
      kp: kp.toFixed(3),
      kilometerPoint: kp,
      restoredWaveform: Number(value.toFixed(3)),
      planLine: planLine ? Number(planLine[index]?.toFixed(3)) : undefined,
      movement: movement ? Number(movement[index]?.toFixed(3)) : undefined,
      isStandardExceeded,
      isMaximumExceeded
    };
  });

  // カスタムツールチップ
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
          キロ程: {data.kp} km
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color }}>
              <strong>{entry.name}:</strong> {entry.value} mm
            </div>
          ))}
        </div>
        {data.movement !== undefined && (
          <div style={{ marginTop: '8px', fontSize: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
            {data.isMaximumExceeded && (
              <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
                ⚠️ 最大値超過 (&gt;{maximumLimit}mm)
              </div>
            )}
            {data.isStandardExceeded && !data.isMaximumExceeded && (
              <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                ⚠️ 標準値超過 (&gt;{standardLimit}mm)
              </div>
            )}
            {!data.isStandardExceeded && (
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                ✓ 制限内
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Brush範囲変更ハンドラ
  const handleBrushChange = (range: any) => {
    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
  };

  // 曲線諸元の色とラベルを取得
  const getCurveStyle = (curveType: string) => {
    const styles = {
      straight: { fill: '#e0f2fe', opacity: 0.3, label: '直線' },
      transition: { fill: '#fef3c7', opacity: 0.3, label: '緩和曲線' },
      circular: { fill: '#fee2e2', opacity: 0.3, label: '円曲線' }
    };
    return styles[curveType as keyof typeof styles] || styles.straight;
  };

  return (
    <div style={{ width: '100%', background: 'white', borderRadius: '12px', padding: '16px' }}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="kp"
            label={{ value: 'キロ程 (km)', position: 'insideBottom', offset: -10 }}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />

          <YAxis
            label={{ value: '変位 (mm)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '14px'
            }}
          />

          {/* 曲線諸元オーバーレイ */}
          {curveSpecifications.map((curve, index) => {
            const style = getCurveStyle(curve.curveType);
            return (
              <ReferenceArea
                key={`curve-${index}`}
                x1={curve.startKP.toFixed(3)}
                x2={curve.endKP.toFixed(3)}
                fill={style.fill}
                fillOpacity={style.opacity}
                label={{
                  value: curve.label || `${style.label}${curve.radius ? ` R=${curve.radius}` : ''}`,
                  position: 'insideTop',
                  fill: '#374151',
                  fontSize: 10
                }}
              />
            );
          })}

          {/* 基準線 (0mm) */}
          <ReferenceLine
            y={0}
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ value: '基準線', position: 'right', fill: '#6b7280' }}
          />

          {/* 復元波形 */}
          <Line
            type="monotone"
            dataKey="restoredWaveform"
            name="復元波形"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />

          {/* 計画線 */}
          {planLine && (
            <Line
              type="monotone"
              dataKey="planLine"
              name="計画線"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 6 }}
            />
          )}

          {/* 移動量 (棒グラフ) - 色分けで制限超過を表示 */}
          {movement && (
            <Bar
              dataKey="movement"
              name="移動量"
              fill="#f59e0b"
              opacity={0.6}
              barSize={3}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                let fillColor = '#10b981'; // 緑: 制限内

                if (payload.isMaximumExceeded) {
                  fillColor = '#ef4444'; // 赤: 最大値超過
                } else if (payload.isStandardExceeded) {
                  fillColor = '#f59e0b'; // 橙: 標準値超過
                }

                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={fillColor}
                    opacity={0.7}
                  />
                );
              }}
            />
          )}

          {/* 移動量制限の参照線 */}
          {movement && (
            <>
              <ReferenceLine
                y={standardLimit}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                label={{ value: `標準値 (${standardLimit}mm)`, position: 'right', fill: '#f59e0b', fontSize: 11 }}
              />
              <ReferenceLine
                y={-standardLimit}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <ReferenceLine
                y={maximumLimit}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `最大値 (${maximumLimit}mm)`, position: 'right', fill: '#ef4444', fontSize: 11 }}
              />
              <ReferenceLine
                y={-maximumLimit}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </>
          )}

          {/* ブラシ (ズーム機能) */}
          {showBrush && (
            <Brush
              dataKey="kp"
              height={30}
              stroke="#3b82f6"
              fill="#dbeafe"
              onChange={handleBrushChange}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* 統計情報表示 */}
      {brushRange && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          <strong>選択範囲:</strong> {chartData[brushRange.startIndex]?.kp} km - {chartData[brushRange.endIndex]?.kp} km
          ({brushRange.endIndex - brushRange.startIndex + 1} データ点)
        </div>
      )}

      {/* 曲線諸元凡例 */}
      {curveSpecifications.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#374151' }}>
            曲線諸元
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '12px', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '2px' }}></div>
              <span>直線</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '2px' }}></div>
              <span>緩和曲線</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '2px' }}></div>
              <span>円曲線</span>
            </div>
          </div>
          <div style={{ marginTop: '12px', maxHeight: '120px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>区間</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>種別</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>R (m)</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>カント (mm)</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>方向</th>
                </tr>
              </thead>
              <tbody>
                {curveSpecifications.map((curve, index) => {
                  const style = getCurveStyle(curve.curveType);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px' }}>{curve.startKP.toFixed(3)} - {curve.endKP.toFixed(3)} km</td>
                      <td style={{ padding: '6px' }}>
                        <span style={{
                          padding: '2px 6px',
                          background: style.fill,
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          {style.label}
                        </span>
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{curve.radius || '-'}</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{curve.cant || '-'}</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        {curve.direction === 'left' ? '←' : curve.direction === 'right' ? '→' : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

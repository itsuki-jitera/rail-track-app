/**
 * 偏心矢変換比較チャート
 * Eccentric Versine Conversion Comparison Chart
 */

import React from 'react';
import Plot from 'react-plotly.js';

interface MeasurementPoint {
  distance: number;
  value: number;
}

interface Props {
  sourceData: MeasurementPoint[];
  convertedData: MeasurementPoint[];
  sourceLabel?: string;
  convertedLabel?: string;
  title?: string;
}

const ConversionComparisonChart: React.FC<Props> = ({
  sourceData,
  convertedData,
  sourceLabel = '変換元',
  convertedLabel = '変換後',
  title = '偏心矢変換比較'
}) => {
  const traces: any[] = [];

  // 変換元データ
  if (sourceData && sourceData.length > 0) {
    traces.push({
      x: sourceData.map(d => d.distance),
      y: sourceData.map(d => d.value),
      type: 'scatter',
      mode: 'lines',
      name: sourceLabel,
      line: {
        color: '#94a3b8',
        width: 1.5,
        dash: 'dot'
      }
    });
  }

  // 変換後データ
  if (convertedData && convertedData.length > 0) {
    traces.push({
      x: convertedData.map(d => d.distance),
      y: convertedData.map(d => d.value),
      type: 'scatter',
      mode: 'lines',
      name: convertedLabel,
      line: {
        color: '#3498db',
        width: 2
      }
    });
  }

  // 差分データ
  if (sourceData && convertedData && sourceData.length === convertedData.length) {
    const differences = sourceData.map((d, i) => ({
      distance: d.distance,
      value: convertedData[i].value - d.value
    }));

    traces.push({
      x: differences.map(d => d.distance),
      y: differences.map(d => d.value),
      type: 'scatter',
      mode: 'lines',
      name: '差分',
      line: {
        color: '#e74c3c',
        width: 1,
        dash: 'dash'
      },
      yaxis: 'y2'
    });
  }

  return (
    <div className="chart-container" style={{ width: '100%', height: '600px' }}>
      <Plot
        data={traces}
        layout={{
          title: {
            text: title,
            font: { size: 18, color: '#2c3e50' }
          },
          xaxis: {
            title: {
              text: '距離 (m)'
            },
            gridcolor: '#e1e8ed',
            showgrid: true,
            domain: [0, 1]
          },
          yaxis: {
            title: {
              text: '偏心矢 (mm)'
            },
            gridcolor: '#e1e8ed',
            showgrid: true,
            zeroline: true,
            zerolinecolor: '#95a5a6',
            zerolinewidth: 2,
            domain: [0.3, 1]
          },
          yaxis2: {
            title: {
              text: '差分 (mm)',
              font: { color: '#e74c3c' }
            },
            tickfont: { color: '#e74c3c' },
            gridcolor: '#e1e8ed',
            showgrid: true,
            zeroline: true,
            zerolinecolor: '#95a5a6',
            domain: [0, 0.25],
            anchor: 'x'
          },
          showlegend: true,
          legend: {
            x: 1.05,
            xanchor: 'left',
            y: 1,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: '#e1e8ed',
            borderwidth: 1
          },
          hovermode: 'x unified',
          plot_bgcolor: '#f8f9fa',
          paper_bgcolor: 'white',
          margin: { l: 60, r: 120, t: 60, b: 60 },
          autosize: true
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d']
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default ConversionComparisonChart;

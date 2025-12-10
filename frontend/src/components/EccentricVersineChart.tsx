/**
 * 偏心矢波形チャート
 * Eccentric Versine Waveform Chart
 */

import React from 'react';
import Plot from 'react-plotly.js';

interface MeasurementPoint {
  distance: number;
  value: number;
}

interface Props {
  originalData?: MeasurementPoint[];
  versineData?: MeasurementPoint[];
  title?: string;
  showLegend?: boolean;
}

const EccentricVersineChart: React.FC<Props> = ({
  originalData,
  versineData,
  title = '偏心矢波形',
  showLegend = true
}) => {
  const traces: any[] = [];

  // 元データ（測定値）
  if (originalData && originalData.length > 0) {
    traces.push({
      x: originalData.map(d => d.distance),
      y: originalData.map(d => d.value),
      type: 'scatter',
      mode: 'lines',
      name: '測定値',
      line: {
        color: '#94a3b8',
        width: 1.5
      }
    });
  }

  // 偏心矢データ
  if (versineData && versineData.length > 0) {
    traces.push({
      x: versineData.map(d => d.distance),
      y: versineData.map(d => d.value),
      type: 'scatter',
      mode: 'lines',
      name: '偏心矢',
      line: {
        color: '#3498db',
        width: 2
      }
    });
  }

  return (
    <div className="chart-container" style={{ width: '100%', height: '500px' }}>
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
            showgrid: true
          },
          yaxis: {
            title: {
              text: '変位 (mm)'
            },
            gridcolor: '#e1e8ed',
            showgrid: true,
            zeroline: true,
            zerolinecolor: '#95a5a6',
            zerolinewidth: 2
          },
          showlegend: showLegend,
          legend: {
            x: 1,
            xanchor: 'right',
            y: 1,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: '#e1e8ed',
            borderwidth: 1
          },
          hovermode: 'closest',
          plot_bgcolor: '#f8f9fa',
          paper_bgcolor: 'white',
          margin: { l: 60, r: 40, t: 60, b: 60 },
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

export default EccentricVersineChart;

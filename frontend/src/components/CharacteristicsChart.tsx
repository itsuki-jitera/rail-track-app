/**
 * 検測特性チャート
 * Measurement Characteristics Chart (Amplitude and Phase)
 */

import React from 'react';
import Plot from 'react-plotly.js';

interface Characteristic {
  wavelength: number;
  A: number;
  B: number;
  amplitude: number;
  phase: number;
  phaseDeg: number;
}

interface Props {
  characteristics: Characteristic[];
  showAmplitude?: boolean;
  showPhase?: boolean;
  title?: string;
}

const CharacteristicsChart: React.FC<Props> = ({
  characteristics,
  showAmplitude = true,
  showPhase = true,
  title = '検測特性'
}) => {
  const wavelengths = characteristics.map(c => c.wavelength);
  const amplitudes = characteristics.map(c => c.amplitude);
  const phases = characteristics.map(c => c.phaseDeg);

  // 振幅特性と位相特性を別々のサブプロットに表示
  const traces: any[] = [];

  if (showAmplitude) {
    traces.push({
      x: wavelengths,
      y: amplitudes,
      type: 'scatter',
      mode: 'lines',
      name: '振幅特性',
      line: {
        color: '#3498db',
        width: 2
      },
      xaxis: 'x',
      yaxis: 'y'
    });
  }

  if (showPhase) {
    traces.push({
      x: wavelengths,
      y: phases,
      type: 'scatter',
      mode: 'lines',
      name: '位相特性',
      line: {
        color: '#e74c3c',
        width: 2
      },
      xaxis: 'x',
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
              text: '波長 (m)'
            },
            gridcolor: '#e1e8ed',
            showgrid: true,
            domain: [0, 1]
          },
          yaxis: {
            title: {
              text: '振幅',
              font: { color: '#3498db' }
            },
            tickfont: { color: '#3498db' },
            gridcolor: '#e1e8ed',
            showgrid: true,
            zeroline: true,
            zerolinecolor: '#95a5a6',
            domain: showPhase ? [0.55, 1] : [0, 1]
          },
          yaxis2: showPhase ? {
            title: {
              text: '位相 (度)',
              font: { color: '#e74c3c' }
            },
            tickfont: { color: '#e74c3c' },
            gridcolor: '#e1e8ed',
            showgrid: true,
            zeroline: true,
            zerolinecolor: '#95a5a6',
            domain: [0, 0.45],
            anchor: 'x'
          } : undefined,
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

export default CharacteristicsChart;

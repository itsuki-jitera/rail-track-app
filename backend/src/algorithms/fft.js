/**
 * FFT（高速フーリエ変換）処理の実装
 * VBシステムのKFLFFT処理を再実装
 */

import FFT from 'fft.js';
import { FFT_PARAMS } from '../utils/constants.js';

/**
 * データを2のべき乗に拡張
 * @param {Array} data - 元データ
 * @returns {number} 2のべき乗のサイズ
 */
function getFFTSize(dataLength) {
  let size = 1;
  while (size < dataLength) {
    size *= 2;
  }
  return size;
}

/**
 * データを2のべき乗サイズにパディング
 * @param {Array} data - 軌道データ配列
 * @param {number} targetSize - 目標サイズ
 * @returns {Array} パディングされた数値配列
 */
function padData(data, targetSize) {
  const values = data.map(d => d.irregularity);
  const padded = new Array(targetSize).fill(0);

  for (let i = 0; i < values.length; i++) {
    padded[i] = values[i];
  }

  // 残りはゼロパディング
  return padded;
}

/**
 * FFTを実行して周波数スペクトルを取得
 * @param {Array} data - 軌道データ配列
 * @returns {Object} FFT結果
 */
export function performFFT(data) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  const fftSize = getFFTSize(data.length);
  const fft = new FFT(fftSize);

  // データをパディング
  const paddedData = padData(data, fftSize);

  // FFT実行用の配列準備（実部と虚部）
  const input = fft.toComplexArray(paddedData, null);
  const output = fft.createComplexArray();

  // FFT実行
  fft.transform(output, input);

  // パワースペクトルを計算
  const powerSpectrum = [];
  for (let i = 0; i < fftSize / 2; i++) {
    const real = output[2 * i];
    const imag = output[2 * i + 1];
    const power = Math.sqrt(real * real + imag * imag);
    powerSpectrum.push(power);
  }

  return {
    fftSize,
    originalLength: data.length,
    output,
    powerSpectrum,
    frequencies: powerSpectrum.map((_, i) => i / fftSize) // 正規化周波数
  };
}

/**
 * 逆FFTを実行
 * @param {Array} complexArray - FFT出力の複素数配列
 * @param {number} fftSize - FFTサイズ
 * @param {number} originalLength - 元のデータ長
 * @returns {Array} 実数値配列
 */
function performInverseFFT(complexArray, fftSize, originalLength) {
  const fft = new FFT(fftSize);
  const output = fft.createComplexArray();

  // 逆FFT実行
  fft.inverseTransform(output, complexArray);

  // 実部のみ抽出し、元の長さに切り詰め
  const result = [];
  for (let i = 0; i < originalLength; i++) {
    result.push(output[2 * i]); // 実部のみ
  }

  return result;
}

/**
 * ローパスフィルタをFFTで適用
 * @param {Array} data - 軌道データ配列
 * @param {number} cutoffFreq - カットオフ周波数（正規化周波数: 0-0.5）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyFFTLowPassFilter(data, cutoffFreq = 0.1) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (cutoffFreq <= 0 || cutoffFreq > 0.5) {
    throw new Error('カットオフ周波数は 0 < freq <= 0.5 の範囲である必要があります');
  }

  // FFT実行
  const fftResult = performFFT(data);
  const { output, fftSize, originalLength } = fftResult;

  // カットオフより高い周波数成分をゼロにする
  const cutoffIndex = Math.floor(cutoffFreq * fftSize);

  for (let i = cutoffIndex; i < fftSize - cutoffIndex; i++) {
    output[2 * i] = 0;     // 実部
    output[2 * i + 1] = 0; // 虚部
  }

  // 逆FFT実行
  const filteredValues = performInverseFFT(output, fftSize, originalLength);

  // データ形式に戻す
  const filtered = data.map((point, i) => ({
    distance: point.distance,
    irregularity: parseFloat(filteredValues[i].toFixed(3))
  }));

  return filtered;
}

/**
 * ハイパスフィルタをFFTで適用
 * @param {Array} data - 軌道データ配列
 * @param {number} cutoffFreq - カットオフ周波数（正規化周波数: 0-0.5）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyFFTHighPassFilter(data, cutoffFreq = 0.05) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (cutoffFreq <= 0 || cutoffFreq > 0.5) {
    throw new Error('カットオフ周波数は 0 < freq <= 0.5 の範囲である必要があります');
  }

  // FFT実行
  const fftResult = performFFT(data);
  const { output, fftSize, originalLength } = fftResult;

  // カットオフより低い周波数成分をゼロにする
  const cutoffIndex = Math.floor(cutoffFreq * fftSize);

  // DC成分と低周波をゼロに
  for (let i = 0; i < cutoffIndex; i++) {
    output[2 * i] = 0;     // 実部
    output[2 * i + 1] = 0; // 虚部
  }

  // ナイキスト周波数付近も対称的にゼロに
  for (let i = fftSize - cutoffIndex; i < fftSize; i++) {
    output[2 * i] = 0;
    output[2 * i + 1] = 0;
  }

  // 逆FFT実行
  const filteredValues = performInverseFFT(output, fftSize, originalLength);

  // データ形式に戻す
  const filtered = data.map((point, i) => ({
    distance: point.distance,
    irregularity: parseFloat(filteredValues[i].toFixed(3))
  }));

  return filtered;
}

/**
 * バンドパスフィルタをFFTで適用
 * @param {Array} data - 軌道データ配列
 * @param {number} lowCutoff - 低周波カットオフ（正規化周波数）
 * @param {number} highCutoff - 高周波カットオフ（正規化周波数）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyFFTBandPassFilter(data, lowCutoff = 0.05, highCutoff = 0.2) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (lowCutoff >= highCutoff) {
    throw new Error('lowCutoff < highCutoff である必要があります');
  }

  // FFT実行
  const fftResult = performFFT(data);
  const { output, fftSize, originalLength } = fftResult;

  const lowIndex = Math.floor(lowCutoff * fftSize);
  const highIndex = Math.floor(highCutoff * fftSize);

  // 範囲外の周波数成分をゼロにする
  for (let i = 0; i < fftSize; i++) {
    if (i < lowIndex || (i > highIndex && i < fftSize - highIndex) || i > fftSize - lowIndex) {
      output[2 * i] = 0;
      output[2 * i + 1] = 0;
    }
  }

  // 逆FFT実行
  const filteredValues = performInverseFFT(output, fftSize, originalLength);

  // データ形式に戻す
  const filtered = data.map((point, i) => ({
    distance: point.distance,
    irregularity: parseFloat(filteredValues[i].toFixed(3))
  }));

  return filtered;
}

/**
 * 周波数スペクトル分析
 * @param {Array} data - 軌道データ配列
 * @returns {Object} スペクトル分析結果
 */
export function analyzeFrequencySpectrum(data) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  const fftResult = performFFT(data);
  const { powerSpectrum, frequencies } = fftResult;

  // 主要な周波数成分を検出
  const peaks = [];
  for (let i = 1; i < powerSpectrum.length - 1; i++) {
    if (powerSpectrum[i] > powerSpectrum[i - 1] && powerSpectrum[i] > powerSpectrum[i + 1]) {
      if (powerSpectrum[i] > Math.max(...powerSpectrum) * 0.1) { // 最大値の10%以上
        peaks.push({
          frequency: frequencies[i],
          power: powerSpectrum[i],
          index: i
        });
      }
    }
  }

  // パワーの大きい順にソート
  peaks.sort((a, b) => b.power - a.power);

  return {
    success: true,
    fftSize: fftResult.fftSize,
    originalLength: fftResult.originalLength,
    powerSpectrum,
    frequencies,
    dominantFrequencies: peaks.slice(0, 5), // 上位5つ
    totalPower: powerSpectrum.reduce((a, b) => a + b, 0)
  };
}

/**
 * FFTフィルタのラッパー関数
 * @param {Array} data - 軌道データ配列
 * @param {string} filterType - フィルタタイプ
 * @param {Object} options - オプション
 * @returns {Object} フィルタ適用結果
 */
export function applyFFTFilter(data, filterType, options = {}) {
  try {
    let filtered;
    let description;

    switch (filterType) {
      case 'fft_lowpass':
        const lowCutoff = options.cutoffFreq || 0.1;
        filtered = applyFFTLowPassFilter(data, lowCutoff);
        description = `FFTローパスフィルタ (cutoff=${lowCutoff})`;
        break;

      case 'fft_highpass':
        const highCutoff = options.cutoffFreq || 0.05;
        filtered = applyFFTHighPassFilter(data, highCutoff);
        description = `FFTハイパスフィルタ (cutoff=${highCutoff})`;
        break;

      case 'fft_bandpass':
        const low = options.lowCutoff || 0.05;
        const high = options.highCutoff || 0.2;
        filtered = applyFFTBandPassFilter(data, low, high);
        description = `FFTバンドパスフィルタ (${low}-${high})`;
        break;

      case 'fft_analyze':
        // スペクトル分析のみ（フィルタリングなし）
        return analyzeFrequencySpectrum(data);

      default:
        throw new Error(`未知のFFTフィルタタイプ: ${filterType}`);
    }

    return {
      success: true,
      data: filtered,
      filterType,
      description,
      dataPoints: filtered.length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      filterType,
      dataPoints: 0
    };
  }
}

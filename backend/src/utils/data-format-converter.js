/**
 * KANA3 Data Format Converter
 * KANA3仕様のデータフォーマット変換
 *
 * サポートフォーマット:
 * - RSQ: 検測データ（バイナリ）
 * - KDT/PNT: キロ程-データ対照表
 * - DDB/TBL: 曲線・勾配データ（バイナリ）
 * - HDR/DAT: 新形式の検測データ
 * - CSV: カンマ区切りテキスト
 */

const fs = require('fs').promises;
const path = require('path');

class DataFormatConverter {
  constructor() {
    // データ項目コード（KANA3仕様書より）
    this.dataItemCodes = {
      1: '10m弦高低（左）',
      2: '10m弦高低（右）',
      3: '10m弦通り（左）',
      4: '10m弦通り（右）',
      5: '水準',
      6: '軌間',
      7: '正矢',
      8: '地点検出',
      9: '継目検出',
      10: '勾配',
      13: '正方向測定',
      14: '逆方向測定'
    };

    // 曲線コード（CKファイル用）
    this.curveCodeMap = {
      'DD': 'depot',      // デポ位置
      'BC': 'beginCurve', // 曲線開始
      'EC': 'endCurve',   // 曲線終了
      'BT': 'beginTransition', // 緩和曲線開始
      'ET': 'endTransition'    // 緩和曲線終了
    };
  }

  /**
   * RSQファイル（旧形式）の読み込み
   * バイナリフォーマット: 2048バイトヘッダー + Nデータ点×4バイト
   */
  async readRSQFile(filePath) {
    const buffer = await fs.readFile(filePath);

    // ヘッダー解析（2048バイト）
    const header = this.parseRSQHeader(buffer.slice(0, 2048));

    // データ解析（4バイト単位）
    const dataOffset = 2048;
    const dataCount = (buffer.length - dataOffset) / 4;
    const data = [];

    for (let i = 0; i < dataCount; i++) {
      const offset = dataOffset + i * 4;
      const value = buffer.readFloatLE(offset); // Little Endian 32bit float
      data.push({
        index: i,
        position: i * 0.25, // 25cm間隔
        value: value
      });
    }

    return {
      header,
      data,
      metadata: {
        format: 'RSQ',
        dataPoints: dataCount,
        samplingInterval: 0.25,
        fileSize: buffer.length
      }
    };
  }

  /**
   * RSQヘッダー解析
   */
  parseRSQHeader(headerBuffer) {
    // KANA3仕様に基づくヘッダー構造
    return {
      version: headerBuffer.readUInt16LE(0),
      measurementDate: this.parseDate(headerBuffer.slice(2, 10)),
      railwayLine: this.parseString(headerBuffer.slice(10, 50)),
      direction: headerBuffer.readUInt8(50),
      startKilometer: headerBuffer.readFloatLE(52),
      endKilometer: headerBuffer.readFloatLE(56),
      dataType: headerBuffer.readUInt16LE(60),
      reserved: headerBuffer.slice(62, 2048)
    };
  }

  /**
   * HDR/DATファイル（新形式）への変換
   */
  async convertToHDRDAT(rsqData, outputDir) {
    const baseName = path.basename(rsqData.metadata.fileName || 'output', '.rsq');

    // HDRファイル（テキスト形式）
    const hdrContent = this.generateHDRContent(rsqData.header, rsqData.metadata);
    const hdrPath = path.join(outputDir, `${baseName}.hdr`);
    await fs.writeFile(hdrPath, hdrContent, 'utf8');

    // DATファイル（バイナリデータ）
    const datPath = path.join(outputDir, `${baseName}.dat`);
    const datBuffer = Buffer.alloc(rsqData.data.length * 4);

    rsqData.data.forEach((point, index) => {
      datBuffer.writeFloatLE(point.value, index * 4);
    });

    await fs.writeFile(datPath, datBuffer);

    return { hdrPath, datPath };
  }

  /**
   * HDRファイルのコンテンツ生成
   */
  generateHDRContent(header, metadata) {
    const lines = [
      '# KANA3 Measurement Data Header',
      `# Generated: ${new Date().toISOString()}`,
      '',
      `FORMAT_VERSION=2.0`,
      `DATA_TYPE=${this.dataItemCodes[header.dataType] || 'UNKNOWN'}`,
      `RAILWAY_LINE=${header.railwayLine}`,
      `MEASUREMENT_DATE=${header.measurementDate}`,
      `START_KILOMETER=${header.startKilometer}`,
      `END_KILOMETER=${header.endKilometer}`,
      `DIRECTION=${header.direction === 1 ? 'FORWARD' : 'REVERSE'}`,
      `DATA_POINTS=${metadata.dataPoints}`,
      `SAMPLING_INTERVAL=${metadata.samplingInterval}`,
      ''
    ];

    return lines.join('\n');
  }

  /**
   * KDTファイル（キロ程対照表）の読み込み
   */
  async readKDTFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    const entries = [];
    for (const line of lines) {
      const parts = line.split(/\s+/); // スペース区切り
      if (parts.length >= 2) {
        entries.push({
          depotSignal: parseInt(parts[0]),
          kilometer: parseFloat(parts[1]),
          description: parts.slice(2).join(' ')
        });
      }
    }

    return entries;
  }

  /**
   * PNTファイル（地点型対照表）への変換
   */
  async convertKDTtoPNT(kdtData, outputPath) {
    const lines = kdtData.map(entry => {
      return `${entry.depotSignal},${entry.kilometer},${entry.description || ''}`;
    });

    const content = lines.join('\n');
    await fs.writeFile(outputPath, content, 'utf8');

    return outputPath;
  }

  /**
   * CKファイル（曲線管理データ）の読み込み
   * 独自タグフォーマット: BC=001.362,RK=001.362,R=00800,C=032
   */
  async readCKFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    const curves = [];
    let currentCurve = null;

    for (const line of lines) {
      const parsed = this.parseCKLine(line);

      if (parsed.code === 'BC') {
        // 曲線開始
        currentCurve = {
          startKilometer: parsed.kilometer,
          radius: parsed.radius,
          cant: parsed.cant,
          slack: parsed.slack,
          transitions: []
        };
      } else if (parsed.code === 'EC' && currentCurve) {
        // 曲線終了
        currentCurve.endKilometer = parsed.kilometer;
        curves.push(currentCurve);
        currentCurve = null;
      } else if (parsed.code === 'BT' && currentCurve) {
        // 緩和曲線開始
        currentCurve.transitions.push({
          type: 'begin',
          kilometer: parsed.kilometer
        });
      } else if (parsed.code === 'ET' && currentCurve) {
        // 緩和曲線終了
        currentCurve.transitions.push({
          type: 'end',
          kilometer: parsed.kilometer
        });
      }
    }

    return curves;
  }

  /**
   * CKファイルの行解析
   */
  parseCKLine(line) {
    const result = {
      code: null,
      kilometer: null,
      radius: null,
      cant: null,
      slack: null
    };

    // タグの解析
    const tags = line.split(',');
    for (const tag of tags) {
      const [key, value] = tag.split('=');

      switch (key) {
        case 'BC':
        case 'EC':
        case 'BT':
        case 'ET':
        case 'DD':
          result.code = key;
          result.kilometer = parseFloat(value);
          break;
        case 'RK':
          result.kilometer = parseFloat(value);
          break;
        case 'R':
          result.radius = parseInt(value);
          break;
        case 'C':
          result.cant = parseInt(value);
          break;
        case 'S':
          result.slack = parseInt(value);
          break;
      }
    }

    return result;
  }

  /**
   * 測定データのCSV変換（汎用フォーマット）
   */
  async convertToCSV(data, outputPath, options = {}) {
    const {
      includeHeader = true,
      delimiter = ',',
      lineEnding = '\n'
    } = options;

    const lines = [];

    // ヘッダー行
    if (includeHeader) {
      const headers = ['距離(m)', '測定値', '復元値', '整正量', '品質'];
      lines.push(headers.join(delimiter));
    }

    // データ行
    for (const point of data) {
      const row = [
        point.distance?.toFixed(3) || '0.000',
        point.measuredValue?.toFixed(3) || '0.000',
        point.restoredValue?.toFixed(3) || '0.000',
        point.correctionAmount?.toFixed(3) || '0.000',
        point.quality || 'OK'
      ];
      lines.push(row.join(delimiter));
    }

    const content = lines.join(lineEnding);
    await fs.writeFile(outputPath, content, 'utf8');

    return outputPath;
  }

  /**
   * 空間補間（25cm → 1m間隔への変換）
   */
  interpolateToMeterInterval(data, samplingInterval = 0.25) {
    const pointsPerMeter = Math.round(1 / samplingInterval);
    const interpolated = [];

    for (let i = 0; i < data.length; i += pointsPerMeter) {
      if (i + pointsPerMeter <= data.length) {
        // 1m区間内の平均値を計算
        let sum = 0;
        for (let j = 0; j < pointsPerMeter; j++) {
          sum += data[i + j].value;
        }

        interpolated.push({
          position: data[i].position,
          value: sum / pointsPerMeter
        });
      }
    }

    return interpolated;
  }

  /**
   * バイナリデータの解析ユーティリティ
   */
  parseDate(buffer) {
    // BCD形式の日付デコード
    const year = 2000 + this.bcdToInt(buffer[0]);
    const month = this.bcdToInt(buffer[1]);
    const day = this.bcdToInt(buffer[2]);
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  parseString(buffer) {
    // Shift-JISエンコードの文字列
    const endIndex = buffer.indexOf(0); // NULL終端
    const stringBuffer = endIndex >= 0 ? buffer.slice(0, endIndex) : buffer;

    // Node.jsでShift-JISをデコード（iconvライブラリが必要）
    try {
      return stringBuffer.toString('utf8').trim(); // 簡易実装
    } catch (error) {
      return '';
    }
  }

  bcdToInt(bcd) {
    return ((bcd >> 4) & 0x0F) * 10 + (bcd & 0x0F);
  }

  /**
   * ファイルフォーマットの自動判定
   */
  async detectFileFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);

    // 拡張子による判定
    const formatMap = {
      '.rsq': 'RSQ',
      '.kdt': 'KDT',
      '.pnt': 'PNT',
      '.hdr': 'HDR',
      '.dat': 'DAT',
      '.csv': 'CSV',
      '.ddb': 'DDB',
      '.tbl': 'TBL'
    };

    if (formatMap[ext]) {
      return {
        format: formatMap[ext],
        binary: ['.rsq', '.dat', '.ddb', '.tbl'].includes(ext),
        size: stats.size
      };
    }

    // ファイル内容による判定
    const buffer = await fs.readFile(filePath, { length: 100 });

    // バイナリチェック
    const isBinary = buffer.some(byte => byte === 0 || byte > 127);

    return {
      format: 'UNKNOWN',
      binary: isBinary,
      size: stats.size
    };
  }
}

module.exports = { DataFormatConverter };
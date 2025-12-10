/**
 * 軌道復元システム - 型定義
 * データ形式の統一定義
 */

/**
 * @typedef {Object} RSQHeader
 * @property {string} fileId - ファイルID
 * @property {string} lineCode - 路線コード（2文字）
 * @property {string} direction - 上下区分（D:下り, R:上り）
 * @property {Date} measurementDate - 測定日
 * @property {number} startKilometer - 開始キロ程（m単位）
 * @property {number} endKilometer - 終了キロ程（m単位）
 * @property {string} dataType - データ項目（1C, 2C, 5C, 6C, GC, SC, AC, BC, RC, PC）
 * @property {number} dataPoints - データ点数
 * @property {number} samplingInterval - サンプリング間隔（m）
 */

/**
 * @typedef {Object} RSQData
 * @property {RSQHeader} header - ヘッダー情報
 * @property {Float32Array} data - 測定データ配列（4byte浮動小数点×データ数）
 */

/**
 * @typedef {Object} HDRHeader
 * @property {string} fileId - ファイルID
 * @property {string} lineCode - 路線コード
 * @property {string} direction - 上下区分
 * @property {Date} measurementDate - 測定日
 * @property {number} dataPoints - データ点数
 * @property {string} dataType - データ項目
 * @property {Object} metadata - その他のメタデータ
 */

/**
 * @typedef {Object} HDRDATData
 * @property {HDRHeader} header - ヘッダー情報（HDRファイル）
 * @property {Float32Array} data - 測定データ（DATファイル）
 */

/**
 * @typedef {Object} PNTRecord
 * @property {number} kilometer - キロ程（m単位）
 * @property {number} pointNumber - 地点番号
 * @property {string} pointType - 地点種別（DD:データデポ, WB:WB区間）
 * @property {string} description - 説明
 */

/**
 * @typedef {Object} PNTData
 * @property {string} lineCode - 路線コード
 * @property {string} direction - 上下区分
 * @property {PNTRecord[]} points - 地点情報配列
 */

/**
 * @typedef {Object} TBLHeader
 * @property {string} tableName - テーブル名
 * @property {number} recordCount - レコード数
 * @property {TBLField[]} fields - フィールド定義
 */

/**
 * @typedef {Object} TBLField
 * @property {string} name - フィールド名
 * @property {string} type - データ型（文字, 整数, 実数）
 * @property {number} length - 桁数
 */

/**
 * @typedef {Object} TBLRecord
 * @property {number} from - 開始キロ程（整数、m単位）
 * @property {number} to - 終了キロ程（整数、m単位）
 * @property {Object} data - フィールドデータ
 */

/**
 * @typedef {Object} TBLData
 * @property {TBLHeader} header - ヘッダー情報（DDBファイル）
 * @property {TBLRecord[]} records - レコード配列（TBLファイル）
 */

/**
 * @typedef {Object} TrackEnvironmentData
 * @property {StationData[]} stations - 駅名データ (EM)
 * @property {SlopeData[]} slopes - こう配データ (JS)
 * @property {CurveData[]} curves - 曲線データ (HS)
 * @property {StructureData[]} structures - 構造物データ (KR)
 * @property {RailData[]} rails - レールデータ (RL, RR)
 * @property {JointData[]} joints - レール継目データ (RT, RU)
 * @property {BallastData[]} ballast - 道床データ (DS)
 * @property {TurnoutData[]} turnouts - 分岐器データ (BK)
 * @property {EJData[]} ej - EJデータ (EJ)
 * @property {IJData[]} ij - IJデータ (IJ)
 */

/**
 * @typedef {Object} StationData
 * @property {number} kilometer - キロ程
 * @property {string} stationName - 駅名
 */

/**
 * @typedef {Object} SlopeData
 * @property {number} from - 開始キロ程
 * @property {number} to - 終了キロ程
 * @property {number} gradient - 勾配（千分率）
 * @property {number} curveRadius - 縦曲線半径（m）
 */

/**
 * @typedef {Object} CurveData
 * @property {number} from - 開始キロ程
 * @property {number} to - 終了キロ程
 * @property {number} btc - BTC地点
 * @property {number} bcc - BCC地点
 * @property {number} ecc - ECC地点
 * @property {number} etc - ETC地点
 * @property {string} direction - 曲線方向（左/右）
 * @property {number} radius - 半径（m）
 * @property {number} cant - カント（mm）
 * @property {number} slack - スラック（mm）
 */

/**
 * @typedef {Object} StructureData
 * @property {number} from - 開始キロ程
 * @property {number} to - 終了キロ程
 * @property {string} structureType - 構造物種別
 * @property {string} structureName - 構造物名称
 */

/**
 * @typedef {Object} MeasurementData
 * @property {number} distance - 距離（m）
 * @property {number} value - 測定値（mm）
 */

/**
 * @typedef {Object} MultiMeasurementData
 * @property {number} distance - 距離（m）
 * @property {Object.<string, number>} measurements - 測定項目別の値
 * @property {string} [measurements.leftAlignment] - 通り左
 * @property {string} [measurements.rightAlignment] - 通り右
 * @property {string} [measurements.leftLevel] - 高低左
 * @property {string} [measurements.rightLevel] - 高低右
 * @property {string} [measurements.gauge] - 軌間
 * @property {string} [measurements.crossLevel] - 水準
 */

/**
 * @typedef {Object} RestorationWaveformOptions
 * @property {number} minWavelength - 最小波長（m）デフォルト: 6.0
 * @property {number} maxWavelength - 最大波長（m）デフォルト: 40.0
 * @property {number} samplingInterval - サンプリング間隔（m）デフォルト: 0.25
 * @property {number} filterOrder - フィルタ次数 デフォルト: 513（奇数）
 * @property {number} attenuationGain - 遮断帯域の振幅利得 デフォルト: 0.01
 */

/**
 * @typedef {Object} RestorationWaveformResult
 * @property {boolean} success - 成功フラグ
 * @property {MeasurementData[]} restoredWaveform - 復元波形データ
 * @property {MeasurementData[]} planLine - 計画線データ
 * @property {MovementData[]} movementData - 移動量データ
 * @property {Object} statistics - 統計情報
 * @property {number} statistics.sigmaOriginal - 元データのσ値
 * @property {number} statistics.sigmaRestored - 復元波形のσ値
 * @property {number} statistics.improvementRate - 良化率（%）
 * @property {RestorationWaveformOptions} filterParams - フィルタパラメータ
 * @property {string} [error] - エラーメッセージ
 */

/**
 * @typedef {Object} MovementData
 * @property {number} distance - 距離（m）
 * @property {number} tamping - こう上量（mm）
 * @property {number} lining - 移動量（mm）
 */

/**
 * @typedef {Object} DCPFileHeader
 * @property {string} fileId - ファイルID
 * @property {string} lineCode - 路線コード
 * @property {string} direction - 上下区分
 * @property {Date} measurementDate - 測定日
 * @property {number} startKm - 開始キロ程
 * @property {number} endKm - 終了キロ程
 * @property {string} trainType - 車両種別
 */

/**
 * @typedef {Object} DCPData
 * @property {DCPFileHeader} header - ヘッダー
 * @property {Object.<string, Float32Array>} items - 項目別データ
 * @property {Float32Array} items.alignment10mRight - 通り右 10m弦
 * @property {Float32Array} items.alignment10mLeft - 通り左 10m弦
 * @property {Float32Array} items.level10mRight - 高低右 10m弦
 * @property {Float32Array} items.level10mLeft - 高低左 10m弦
 * @property {Float32Array} items.eccentricRight - 偏心矢右
 * @property {Float32Array} items.eccentricLeft - 偏心矢左
 * @property {Float32Array} items.gauge - 軌間
 * @property {Float32Array} items.crossLevel - 水準
 * @property {Float32Array} items.slope - 勾配
 * @property {Uint8Array} items.atsMarker - ATS検知
 * @property {Uint8Array} items.kmMarker - 1km検知
 * @property {Uint8Array} items.jointMarkerLeft - 継目検知左
 */

module.exports = {
  // 型定義はJSDocで提供
  // 実際の利用例:
  // /** @type {RSQData} */
  // const rsqData = parser.parse(buffer);
};

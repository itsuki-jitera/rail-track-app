/**
 * MDT (Measurement Data Title) ファイルパーサー
 *
 * MDTファイルの仕様:
 * - Shift-JISエンコーディング
 * - 1行のヘッダー情報のみ
 * - フォーマット: ファイルID 路線名 上下区分 日付 キロ程範囲
 * - 実データはLZHファイルに格納されている
 */

import iconv from 'iconv-lite';

/**
 * MDTファイルのヘッダー情報を解析
 * @param {Buffer} buffer - MDTファイルのバッファ
 * @returns {Object} 解析結果
 */
export function parseMDTFile(buffer) {
  try {
    // Shift-JISとしてデコード
    const content = iconv.decode(buffer, 'Shift_JIS');
    const line = content.trim();

    // パターンマッチング
    // 例: "KSD022 湖西線　 下 2022-02-04     .001- 75.744"
    // 例: "KSD022 湖西線　 下 2022/02/04     .001- 75.744"
    const match = line.match(/^([A-Z0-9]+)\s+(.+?)\s+(上|下)\s+(\d{4}[-\/]\d{2}[-\/]\d{2})\s+([\d\.]+)\s*-\s*([\d\.]+)?/);

    if (!match) {
      console.warn('MDT parsing warning: MDTファイルの形式が不正です');
      console.warn('Line content:', line);
      throw new Error('MDTファイルの形式が不正です');
    }

    const [, fileId, lineName, direction, date, startKm, endKm] = match;
    // 日付形式を統一 (YYYY/MM/DD → YYYY-MM-DD)
    const normalizedDate = date.replace(/\//g, '-');

    return {
      success: true,
      data: {
        fileId: fileId.trim(),
        lineName: lineName.trim(),
        direction: direction,
        measurementDate: normalizedDate,
        startKilometer: parseFloat(startKm),
        endKilometer: endKm ? parseFloat(endKm) : null,
        metadata: {
          encoding: 'Shift_JIS',
          fileSize: buffer.length,
          rawContent: line
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * MDTファイルが有効かチェック
 * @param {Buffer} buffer - MDTファイルのバッファ
 * @returns {boolean}
 */
export function isValidMDTFile(buffer) {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  // Shift-JISとしてデコード
  const content = iconv.decode(buffer, 'Shift_JIS');

  // 基本的なフォーマットチェック (YYYY-MM-DD と YYYY/MM/DD の両方に対応)
  return /^[A-Z0-9]+\s+.+\s+(上|下)\s+\d{4}[-\/]\d{2}[-\/]\d{2}/.test(content);
}

/**
 * MDTヘッダーからLZHファイル名を推測
 * @param {Object} mdtData - MDTパース結果
 * @returns {string} LZHファイル名
 */
export function getLZHFileName(mdtData) {
  // 例: KSD022DA.MDT → KSD022DA.LZH
  return `${mdtData.fileId}.LZH`;
}

export default {
  parseMDTFile,
  isValidMDTFile,
  getLZHFileName
};

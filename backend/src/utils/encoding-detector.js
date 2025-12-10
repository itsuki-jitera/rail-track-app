/**
 * 文字エンコーディング検出・変換ユーティリティ
 * Shift-JIS、EUC-JP、UTF-8などの日本語エンコーディングに対応
 */

import Encoding from 'encoding-japanese';

/**
 * バッファから文字エンコーディングを自動検出
 * @param {Buffer} buffer - ファイルデータのBuffer
 * @returns {string} 検出されたエンコーディング名
 */
export function detectEncoding(buffer) {
  // Uint8Array形式に変換
  const uint8Array = new Uint8Array(buffer);

  // encoding-japaneseで自動検出
  const detected = Encoding.detect(uint8Array);

  // 検出できなかった場合はUTF-8をデフォルトとする
  return detected || 'UTF8';
}

/**
 * 任意のエンコーディングからUTF-8に変換
 * @param {Buffer} buffer - 元のバッファ
 * @param {string} encoding - 元のエンコーディング名
 * @returns {string} UTF-8文字列
 */
export function convertToUTF8(buffer, encoding) {
  // すでにUTF-8の場合はそのまま文字列化
  if (encoding === 'UTF8' || encoding === 'UTF-8') {
    return buffer.toString('utf-8');
  }

  // Uint8Array形式に変換
  const uint8Array = new Uint8Array(buffer);

  // エンコーディングをencoding-japanese形式に変換
  const fromEncoding = normalizeEncodingName(encoding);

  // UNICODEに変換
  const unicodeArray = Encoding.convert(uint8Array, {
    to: 'UNICODE',
    from: fromEncoding,
    type: 'array'
  });

  // Uint16Arrayに変換してから文字列化
  const uint16Array = new Uint16Array(unicodeArray);
  return String.fromCharCode(...uint16Array);
}

/**
 * エンコーディング名を正規化
 * @param {string} encoding - エンコーディング名
 * @returns {string} 正規化されたエンコーディング名
 */
function normalizeEncodingName(encoding) {
  const normalized = encoding.toUpperCase().replace(/[-_]/g, '');

  // encoding-japaneseで使用する名前に変換
  const mappings = {
    'SHIFTJIS': 'SJIS',
    'SHIFT_JIS': 'SJIS',
    'SJIS': 'SJIS',
    'EUCJP': 'EUCJP',
    'EUC_JP': 'EUCJP',
    'UTF8': 'UTF8',
    'UTF-8': 'UTF8',
    'JIS': 'JIS'
  };

  return mappings[normalized] || normalized;
}

/**
 * エンコーディング情報を含む詳細な解析結果を返す
 * @param {Buffer} buffer - ファイルデータのBuffer
 * @returns {Object} エンコーディング情報
 */
export function analyzeEncoding(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const detected = Encoding.detect(uint8Array);

  return {
    encoding: detected || 'UTF8',
    confidence: getConfidence(uint8Array, detected),
    bom: checkBOM(buffer)
  };
}

/**
 * BOManMARK の有無をチェック
 * @param {Buffer} buffer - ファイルデータのBuffer
 * @returns {string|null} BOMの種類
 */
function checkBOM(buffer) {
  if (buffer.length < 3) return null;

  // UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'UTF-8';
  }

  // UTF-16 LE BOM
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return 'UTF-16LE';
  }

  // UTF-16 BE BOM
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return 'UTF-16BE';
  }

  return null;
}

/**
 * エンコーディング検出の信頼度を推定（簡易版）
 * @param {Uint8Array} uint8Array - データ
 * @param {string} detected - 検出されたエンコーディング
 * @returns {number} 信頼度 (0-1)
 */
function getConfidence(uint8Array, detected) {
  // 実際の実装では統計的な分析が必要
  // ここでは簡易的に検出結果の有無で判定
  return detected ? 0.9 : 0.5;
}

/**
 * 複数のエンコーディングで試行して最適なものを選択
 * @param {Buffer} buffer - ファイルデータのBuffer
 * @returns {Object} { encoding: string, text: string }
 */
export function smartDecode(buffer) {
  // 自動検出を試行
  const detected = detectEncoding(buffer);

  try {
    const text = convertToUTF8(buffer, detected);

    // 文字化けチェック（簡易版）
    if (containsGarbledText(text)) {
      // 文字化けがある場合は他のエンコーディングを試行
      return tryAlternativeEncodings(buffer);
    }

    return {
      encoding: detected,
      text: text,
      success: true
    };
  } catch (error) {
    return tryAlternativeEncodings(buffer);
  }
}

/**
 * 代替エンコーディングで試行
 * @param {Buffer} buffer - ファイルデータのBuffer
 * @returns {Object} デコード結果
 */
function tryAlternativeEncodings(buffer) {
  const encodings = ['SJIS', 'EUCJP', 'UTF8', 'JIS'];

  for (const enc of encodings) {
    try {
      const text = convertToUTF8(buffer, enc);

      if (!containsGarbledText(text)) {
        return {
          encoding: enc,
          text: text,
          success: true
        };
      }
    } catch (error) {
      continue;
    }
  }

  // すべて失敗した場合はUTF-8で強制変換
  return {
    encoding: 'UTF8',
    text: buffer.toString('utf-8'),
    success: false
  };
}

/**
 * 文字化けの簡易チェック
 * @param {string} text - チェック対象テキスト
 * @returns {boolean} 文字化けの可能性があるか
 */
function containsGarbledText(text) {
  // �(U+FFFD: REPLACEMENT CHARACTER)が多数含まれている場合
  const replacementChars = (text.match(/�/g) || []).length;
  const totalChars = text.length;

  // 10%以上が置換文字の場合は文字化けと判定
  return replacementChars > totalChars * 0.1;
}

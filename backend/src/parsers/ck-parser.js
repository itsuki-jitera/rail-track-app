/**
 * CKファイルパーサー
 * キヤデータの曲線情報ファイル（CK*.csv）を解析
 */

export class CKParser {
  constructor() {
    this.reset();
  }

  reset() {
    this.curves = [];
    this.structures = [];
    this.stations = [];
    this.metadata = {};
    this.currentCurve = null;
    this.currentStructure = null;
  }

  /**
   * CKファイルのテキストを解析
   * @param {string} text - CKファイルの内容
   * @returns {Object} パース結果
   */
  parse(text) {
    this.reset();

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // 空行をスキップ
      if (!trimmed) continue;

      // コメント行（#で始まる）
      if (trimmed.startsWith('#')) {
        this.parseHeader(trimmed);
        continue;
      }

      // マーカー行（=を含む）
      if (trimmed.includes('=')) {
        this.parseMarker(trimmed);
      }

      // EOD (End Of Data)
      if (trimmed === 'EOD') {
        this.finalizeCurrentItems();
        break;
      }
    }

    // 未完了の項目を確定
    this.finalizeCurrentItems();

    return {
      curves: this.curves,
      structures: this.structures,
      stations: this.stations,
      metadata: this.metadata
    };
  }

  /**
   * ヘッダー行の解析
   * @param {string} line - ヘッダー行
   */
  parseHeader(line) {
    // #作成年月日,コース名(96文字)
    if (line.includes('作成年月日')) {
      const parts = line.substring(1).split(',');
      this.metadata.headerType = 'dateAndCourse';
    }
    // #LK,列車名称,列車番号
    else if (line.startsWith('#LK')) {
      const parts = line.substring(1).split(',');
      this.metadata.sectionMarker = parts[0];
    }
  }

  /**
   * マーカー行の解析
   * @param {string} line - マーカー行
   */
  parseMarker(line) {
    const parts = line.split(',');
    const firstPart = parts[0].trim();
    const markerMatch = firstPart.match(/^([A-Z]{2})=(.+)$/);

    if (!markerMatch) return;

    const markerType = markerMatch[1];
    const markerValue = parseFloat(markerMatch[2]);

    // マーカータイプ別の処理
    switch (markerType) {
      case 'BC': // Begin Curve
        this.handleBeginCurve(markerValue, parts);
        break;

      case 'EC': // End Curve
        this.handleEndCurve(markerValue);
        break;

      case 'BR': // Begin Radius (曲線の開始点)
        this.handleBeginRadius(markerValue);
        break;

      case 'ER': // End Radius (曲線の終了点)
        this.handleEndRadius(markerValue);
        break;

      case 'BT': // Begin Tunnel
        this.handleBeginTunnel(markerValue);
        break;

      case 'ET': // End Tunnel
        this.handleEndTunnel(markerValue);
        break;

      case 'BB': // Begin Bridge
        this.handleBeginBridge(markerValue);
        break;

      case 'EB': // End Bridge
        this.handleEndBridge(markerValue);
        break;

      case 'SN': // Station Number
        this.handleStation(markerValue);
        break;

      case 'BP': // Begin Point
      case 'EP': // End Point
      case 'DD': // Distance Data
      case 'CK': // Check Point
      case 'FK': // Flag Point
      case 'BK': // Block Point
        // これらは現時点では記録のみ
        break;

      default:
        // 未知のマーカー
        break;
    }
  }

  /**
   * 曲線開始の処理
   * @param {number} position - 位置
   * @param {Array} parts - パース済みパーツ
   */
  handleBeginCurve(position, parts) {
    // 前の曲線を確定
    if (this.currentCurve) {
      this.curves.push(this.currentCurve);
    }

    // 新しい曲線を開始
    this.currentCurve = {
      id: `curve_${this.curves.length + 1}`,
      start: position,
      end: null,
      radius: null,
      cant: null,
      direction: null
    };

    // パラメータを解析
    for (const part of parts) {
      const trimmed = part.trim();

      if (trimmed.startsWith('R=')) {
        const radiusValue = parseInt(trimmed.substring(2));
        this.currentCurve.radius = radiusValue;
        // 半径の符号で左右を判定（正:右、負:左）
        this.currentCurve.direction = radiusValue >= 0 ? 'right' : 'left';
        // 絶対値を保存
        this.currentCurve.radius = Math.abs(radiusValue);
      } else if (trimmed.startsWith('C=')) {
        this.currentCurve.cant = parseInt(trimmed.substring(2));
      }
    }
  }

  /**
   * 曲線終了の処理
   * @param {number} position - 位置
   */
  handleEndCurve(position) {
    if (this.currentCurve) {
      this.currentCurve.end = position;
      this.curves.push(this.currentCurve);
      this.currentCurve = null;
    }
  }

  /**
   * 半径開始点の処理
   * @param {number} position - 位置
   */
  handleBeginRadius(position) {
    // BR単独の場合（曲線開始の予兆）
    if (!this.currentCurve) {
      this.currentCurve = {
        id: `curve_${this.curves.length + 1}`,
        start: position,
        end: null,
        radius: null,
        cant: null,
        direction: null
      };
    }
  }

  /**
   * 半径終了点の処理
   * @param {number} position - 位置
   */
  handleEndRadius(position) {
    // 現在の曲線がある場合は終了位置を更新
    if (this.currentCurve && !this.currentCurve.end) {
      this.currentCurve.end = position;
    }
  }

  /**
   * トンネル開始の処理
   * @param {number} position - 位置
   */
  handleBeginTunnel(position) {
    this.currentStructure = {
      id: `tunnel_${this.structures.length + 1}`,
      type: 'tunnel',
      start: position,
      end: null
    };
  }

  /**
   * トンネル終了の処理
   * @param {number} position - 位置
   */
  handleEndTunnel(position) {
    if (this.currentStructure && this.currentStructure.type === 'tunnel') {
      this.currentStructure.end = position;
      this.structures.push(this.currentStructure);
      this.currentStructure = null;
    }
  }

  /**
   * 橋梁開始の処理
   * @param {number} position - 位置
   */
  handleBeginBridge(position) {
    // トンネルと同様に処理
    if (this.currentStructure && this.currentStructure.type === 'bridge') {
      // 前の橋梁を確定
      this.structures.push(this.currentStructure);
    }

    this.currentStructure = {
      id: `bridge_${this.structures.length + 1}`,
      type: 'bridge',
      start: position,
      end: null
    };
  }

  /**
   * 橋梁終了の処理
   * @param {number} position - 位置
   */
  handleEndBridge(position) {
    if (this.currentStructure && this.currentStructure.type === 'bridge') {
      this.currentStructure.end = position;
      this.structures.push(this.currentStructure);
      this.currentStructure = null;
    }
  }

  /**
   * 駅の処理
   * @param {number} position - 位置
   */
  handleStation(position) {
    this.stations.push({
      id: `station_${this.stations.length + 1}`,
      km: position,
      name: null // 名前は別の行で取得される場合がある
    });
  }

  /**
   * 未完了項目の確定
   */
  finalizeCurrentItems() {
    // 未完了の曲線
    if (this.currentCurve) {
      // 終了位置が未設定の場合は開始位置+0.1kmとする（暫定）
      if (!this.currentCurve.end) {
        this.currentCurve.end = this.currentCurve.start + 0.1;
      }
      this.curves.push(this.currentCurve);
      this.currentCurve = null;
    }

    // 未完了の構造物
    if (this.currentStructure) {
      if (!this.currentStructure.end) {
        this.currentStructure.end = this.currentStructure.start + 0.1;
      }
      this.structures.push(this.currentStructure);
      this.currentStructure = null;
    }
  }
}

/**
 * CKファイルをパースする便利関数
 * @param {string} text - CKファイルの内容
 * @returns {Object} パース結果
 */
export function parseCK(text) {
  const parser = new CKParser();
  return parser.parse(text);
}

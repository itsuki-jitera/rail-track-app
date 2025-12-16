/**
 * 標準ファイル出力エクスポーター
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P30-31に基づく
 * 厳密なファイル名規則とフォルダ構造の実装
 */

const fs = require('fs').promises;
const path = require('path');

class StandardFileExporter {
  constructor(options = {}) {
    this.baseDir = options.baseDir || './output';
    this.filePrefix = this.generateFilePrefix(options);
  }

  /**
   * 仕様書準拠のファイルプレフィックスを生成
   * 形式: X○○○○○ (X + 5文字の識別子)
   * @param {Object} options - オプション
   * @returns {string} ファイルプレフィックス
   */
  generateFilePrefix(options) {
    const lineCode = (options.lineCode || 'TK').substring(0, 2).toUpperCase();
    const sectionCode = (options.sectionCode || '001').substring(0, 3);

    // X + 路線コード(2文字) + 区間コード(3文字) = X○○○○○
    return `X${lineCode}${sectionCode}`;
  }

  /**
   * 全ファイルを仕様書準拠の形式で出力
   * @param {Object} data - 出力データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<Object>} 出力結果
   */
  async exportAllFiles(data, workSection) {
    // フォルダ構造を作成
    await this.createFolderStructure();

    const results = {};

    // 1. ALS作業用データ (X○○○○○ID.MJ) - ルートフォルダ
    results.mj = await this.exportMJFile(data.movementData, workSection);

    // 2. ALC移動量データ (X○○○○○ID.VER) - ルートフォルダ
    results.ver = await this.exportVERFile(data.movementData, workSection);

    // 3. EXTVER フォルダ
    // ALS用移動量データ (X○○○○○ID.WDT)
    results.wdt = await this.exportWDTFile(
      data.movementData,
      workSection,
      'EXTVER',
      'ID'
    );

    // 新幹線用分割データ (X○○○○○1D.WDT, X○○○○○2D.WDT...)
    if (workSection.railType === 'shinkansen') {
      results.wdtSplit = await this.exportShinkansenSplitFiles(
        data.movementData,
        workSection
      );
    }

    // 4. IDOU フォルダ
    // ALS用移動量データ確認用 (X○○○○○JD.WDT)
    results.wdtCheck = await this.exportWDTFile(
      data.movementData,
      workSection,
      'IDOU',
      'JD'
    );

    // 汎用移動量データ (X○○○○○ID.TXT)
    results.txt = await this.exportGeneralTXTFile(
      data.movementData,
      workSection
    );

    // 5. IDOUSUB フォルダ
    // 画面入力パラメータ (X○○○○○XD.PRM)
    results.prm = await this.exportPRMFile(data.parameters, workSection);

    // 曲線諸元 (X○○○○○KS.TXT)
    results.ks = await this.exportKSFile(data.curveElements, workSection);

    // 移動量制限箇所
    // 左右方向 (X○○○○○I1.TXT)
    results.i1 = await this.exportI1File(data.lateralRestrictions, workSection);

    // 上下方向 (X○○○○○I3.TXT)
    results.i3 = await this.exportI3File(data.verticalRestrictions, workSection);

    // 手検測データ
    if (data.handMeasurement) {
      // 手検測軌間 (X○○○○○KI.TXT)
      results.ki = await this.exportKIFile(data.handMeasurement.gauge, workSection);

      // 手検測左高低 (X○○○○○KL.TXT)
      results.kl = await this.exportKLFile(data.handMeasurement.levelLeft, workSection);

      // 手検測右高低 (X○○○○○KR.TXT)
      results.kr = await this.exportKRFile(data.handMeasurement.levelRight, workSection);
    }

    // 6. 作業区間等の印刷データ (X○○○○○IS.TXT)
    results.is = await this.exportISFile(data, workSection);

    return results;
  }

  /**
   * フォルダ構造を作成
   */
  async createFolderStructure() {
    const folders = [
      this.baseDir,
      path.join(this.baseDir, 'EXTVER'),
      path.join(this.baseDir, 'IDOU'),
      path.join(this.baseDir, 'IDOUSUB')
    ];

    for (const folder of folders) {
      await fs.mkdir(folder, { recursive: true });
    }
  }

  /**
   * MJファイル出力 (ALS作業用データ)
   * フォーマット: D点誘導量, C点補正値, こう上量等
   */
  async exportMJFile(movementData, workSection) {
    const fileName = `${this.filePrefix}ID.MJ`;
    const filePath = path.join(this.baseDir, fileName);

    const lines = [];

    // ヘッダー
    lines.push('* ALS作業用データ');
    lines.push(`* 路線: ${workSection.lineName || ''}`);
    lines.push(`* 区間: ${this.formatKilometer(workSection.startKm)} - ${this.formatKilometer(workSection.endKm)}`);
    lines.push(`* 作業日: ${workSection.workDate || new Date().toISOString().split('T')[0]}`);
    lines.push('*');
    lines.push('キロ程,D点誘導量(左),D点誘導量(右),C点補正値(左),C点補正値(右),こう上量(左),こう上量(右)');

    // データ行（0.5m間隔）
    for (let pos = workSection.startKm; pos <= workSection.endKm; pos += 0.5) {
      const point = movementData.find(d => Math.abs(d.position - pos) < 0.25) || {};

      const km = this.formatKilometer(pos);
      const dLeft = this.formatValue(point.dPointLeft || 0);
      const dRight = this.formatValue(point.dPointRight || 0);
      const cLeft = this.formatValue(point.cPointLeft || 0);
      const cRight = this.formatValue(point.cPointRight || 0);
      const liftLeft = this.formatValue(point.liftingLeft || 0);
      const liftRight = this.formatValue(point.liftingRight || 0);

      lines.push(`${km},${dLeft},${dRight},${cLeft},${cRight},${liftLeft},${liftRight}`);
    }

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  /**
   * VERファイル出力 (ALC移動量データ)
   * フォーマット: 固定長形式
   */
  async exportVERFile(movementData, workSection) {
    const fileName = `${this.filePrefix}ID.VER`;
    const filePath = path.join(this.baseDir, fileName);

    const lines = [];

    // ヘッダー（固定）
    lines.push('START'.padEnd(80));

    // データ行
    let sequenceNo = 1;
    for (let pos = workSection.startKm; pos <= workSection.endKm; pos += 5) {
      const point = movementData.find(d => Math.abs(d.position - pos) < 2.5) || {};

      // フォーマット: キロ程(11) + 横移動(14) + こう上(13) + 番号(13) + ダミー(13)
      const km = this.formatKilometerPadded(pos, 11);
      const lateral = this.formatValuePadded(point.lateralMovement || 0, 14);
      const lifting = this.formatValuePadded(point.verticalMovement || 0, 13);
      const seqNo = sequenceNo.toString().padStart(13);
      const dummy = '0'.padStart(13);

      lines.push(km + lateral + lifting + seqNo + dummy);
      sequenceNo++;
    }

    // フッター（固定）
    lines.push('END'.padEnd(80));

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  /**
   * WDTファイル出力 (ALS用移動量データ)
   */
  async exportWDTFile(movementData, workSection, folder, suffix) {
    const fileName = `${this.filePrefix}${suffix}.WDT`;
    const filePath = path.join(this.baseDir, folder, fileName);

    const lines = [];

    // データ間隔の決定
    const interval = suffix === 'JD' ? 1 : 5; // 確認用は1m、通常は5m

    for (let pos = workSection.startKm; pos <= workSection.endKm; pos += interval) {
      const point = movementData.find(d => Math.abs(d.position - pos) < interval/2) || {};

      // フォーマット: キロ程(7.3) + 横移動(5.1) + 縦移動(5.1)
      const km = (pos / 1000).toFixed(3).padStart(7);
      const lateral = (point.lateralMovement || 0).toFixed(1).padStart(5);
      const vertical = (point.verticalMovement || 0).toFixed(1).padStart(5);

      lines.push(`${km}  ${lateral}  ${vertical}`);
    }

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  /**
   * 新幹線用分割ファイル出力
   */
  async exportShinkansenSplitFiles(movementData, workSection) {
    const results = [];
    const splitLength = 200000; // 200km単位で分割

    let fileIndex = 1;
    for (let start = workSection.startKm; start < workSection.endKm; start += splitLength) {
      const end = Math.min(start + splitLength, workSection.endKm);
      const splitData = movementData.filter(d => d.position >= start && d.position <= end);

      const fileName = `${this.filePrefix}${fileIndex}D.WDT`;
      const filePath = path.join(this.baseDir, 'EXTVER', fileName);

      const lines = [];
      splitData.forEach(point => {
        const km = (point.position / 1000).toFixed(3).padStart(7);
        const lateral = (point.lateralMovement || 0).toFixed(1).padStart(5);
        const vertical = (point.verticalMovement || 0).toFixed(1).padStart(5);
        lines.push(`${km}  ${lateral}  ${vertical}`);
      });

      await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
      results.push(filePath);
      fileIndex++;
    }

    return results;
  }

  /**
   * 汎用TXTファイル出力
   */
  async exportGeneralTXTFile(movementData, workSection) {
    const fileName = `${this.filePrefix}ID.TXT`;
    const filePath = path.join(this.baseDir, 'IDOU', fileName);

    const lines = [];

    // ヘッダー
    lines.push('キロ程(m),横移動量(mm),縦移動量(mm),通り狂い(mm),高低狂い(mm),予測通り(mm),予測高低(mm)');

    // データ行（0.5m間隔）
    for (let pos = workSection.startKm; pos <= workSection.endKm; pos += 0.5) {
      const point = movementData.find(d => Math.abs(d.position - pos) < 0.25) || {};

      lines.push([
        pos.toFixed(1),
        (point.lateralMovement || 0).toFixed(2),
        (point.verticalMovement || 0).toFixed(2),
        (point.originalAlignment || 0).toFixed(2),
        (point.originalLevel || 0).toFixed(2),
        (point.predictedAlignment || 0).toFixed(2),
        (point.predictedLevel || 0).toFixed(2)
      ].join(','));
    }

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  /**
   * PRMファイル出力（パラメータ）
   */
  async exportPRMFile(parameters, workSection) {
    const fileName = `${this.filePrefix}XD.PRM`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const PRMExporter = require('./prm-exporter');
    const exporter = new PRMExporter();

    // ファイル名を上書き
    const content = exporter.generatePRMContent(parameters, workSection);
    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * KSファイル出力（曲線諸元）
   */
  async exportKSFile(curveElements, workSection) {
    const fileName = `${this.filePrefix}KS.TXT`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const CurveElementExporter = require('./curve-element-exporter');
    const exporter = new CurveElementExporter();

    const content = exporter.generateKSContent(curveElements, workSection);
    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * I1ファイル出力（左右方向制限）
   */
  async exportI1File(restrictions, workSection) {
    const fileName = `${this.filePrefix}I1.TXT`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const RestrictionExporter = require('./restriction-exporter');
    const exporter = new RestrictionExporter();

    const content = exporter.generateI1Content(restrictions, workSection);
    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * I3ファイル出力（上下方向制限）
   */
  async exportI3File(restrictions, workSection) {
    const fileName = `${this.filePrefix}I3.TXT`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const RestrictionExporter = require('./restriction-exporter');
    const exporter = new RestrictionExporter();

    const content = exporter.generateI3Content(restrictions, workSection);
    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * 手検測データファイル出力
   */
  async exportKIFile(gaugeData, workSection) {
    const fileName = `${this.filePrefix}KI.TXT`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const lines = ['* 手検測軌間データ'];
    lines.push('キロ程(m),軌間(mm)');

    gaugeData.forEach(point => {
      lines.push(`${point.position.toFixed(1)},${point.value.toFixed(2)}`);
    });

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  async exportKLFile(levelData, workSection) {
    const fileName = `${this.filePrefix}KL.TXT`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const lines = ['* 手検測左高低データ'];
    lines.push('キロ程(m),高低(mm)');

    levelData.forEach(point => {
      lines.push(`${point.position.toFixed(1)},${point.value.toFixed(2)}`);
    });

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  async exportKRFile(levelData, workSection) {
    const fileName = `${this.filePrefix}KR.TXT`;
    const filePath = path.join(this.baseDir, 'IDOUSUB', fileName);

    const lines = ['* 手検測右高低データ'];
    lines.push('キロ程(m),高低(mm)');

    levelData.forEach(point => {
      lines.push(`${point.position.toFixed(1)},${point.value.toFixed(2)}`);
    });

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  /**
   * ISファイル出力（作業区間等の印刷データ）
   */
  async exportISFile(allData, workSection) {
    const fileName = `${this.filePrefix}IS.TXT`;
    const filePath = path.join(this.baseDir, fileName);

    const lines = [];

    // 印刷用フォーマット
    lines.push('=' .repeat(80));
    lines.push(' '.repeat(30) + '軌道整正作業データ');
    lines.push('=' .repeat(80));
    lines.push('');

    lines.push('【作業区間情報】');
    lines.push(`路線名: ${workSection.lineName || ''}`);
    lines.push(`線名: ${workSection.trackName || ''}`);
    lines.push(`方向: ${workSection.direction === 'up' ? '上り' : '下り'}`);
    lines.push(`作業範囲: ${this.formatKilometer(workSection.startKm)} ～ ${this.formatKilometer(workSection.endKm)}`);
    lines.push(`作業日: ${workSection.workDate || ''}`);
    lines.push('');

    // 曲線諸元サマリー
    if (allData.curveElements) {
      lines.push('【曲線諸元】');
      const hCurves = allData.curveElements.horizontalCurves || [];
      const vCurves = allData.curveElements.verticalCurves || [];

      lines.push(`平面曲線数: ${hCurves.length}個`);
      lines.push(`縦曲線数: ${vCurves.length}個`);

      if (hCurves.length > 0) {
        lines.push('');
        lines.push('平面曲線一覧:');
        hCurves.forEach((curve, i) => {
          lines.push(`  ${i+1}. ${this.formatKilometer(curve.startKm)} - ${this.formatKilometer(curve.endKm)}`);
          lines.push(`     R=${curve.radius}m, ${curve.direction === 'right' ? '右' : '左'}カーブ, C=${curve.cant || 0}mm`);
        });
      }
    }

    lines.push('');
    lines.push('【移動量統計】');

    if (allData.movementData && allData.movementData.length > 0) {
      const movements = allData.movementData;

      const maxLateral = Math.max(...movements.map(m => Math.abs(m.lateralMovement || 0)));
      const maxVertical = Math.max(...movements.map(m => Math.abs(m.verticalMovement || 0)));
      const avgLateral = movements.reduce((sum, m) => sum + Math.abs(m.lateralMovement || 0), 0) / movements.length;
      const avgVertical = movements.reduce((sum, m) => sum + Math.abs(m.verticalMovement || 0), 0) / movements.length;

      lines.push(`最大横移動量: ${maxLateral.toFixed(1)}mm`);
      lines.push(`最大縦移動量: ${maxVertical.toFixed(1)}mm`);
      lines.push(`平均横移動量: ${avgLateral.toFixed(1)}mm`);
      lines.push(`平均縦移動量: ${avgVertical.toFixed(1)}mm`);
    }

    lines.push('');
    lines.push('=' .repeat(80));
    lines.push(`作成日時: ${new Date().toISOString()}`);

    await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    return filePath;
  }

  /**
   * キロ程フォーマット
   */
  formatKilometer(meters) {
    const km = Math.floor(meters / 1000);
    const m = meters % 1000;
    return `${km}k${m.toFixed(3).padStart(7, '0')}m`;
  }

  /**
   * キロ程フォーマット（パディング付き）
   */
  formatKilometerPadded(meters, width) {
    const kmStr = this.formatKilometer(meters);
    return kmStr.padEnd(width);
  }

  /**
   * 値フォーマット
   */
  formatValue(value) {
    return value.toFixed(2);
  }

  /**
   * 値フォーマット（パディング付き）
   */
  formatValuePadded(value, width) {
    return value.toFixed(2).padStart(width);
  }
}

module.exports = StandardFileExporter;
/**
 * MTTt™Çü¿¨¯¹İü¿ü
 *
 * ÕØø057_©Câb’(D_ÌStc—nÍ\KP33-36kúeOŸÅ
 * - D¹˜ÏC¹Üc$n—
 * - MTT.%kÜX_&wÜc
 * - 09-16(h]Œån:%
 */

const fs = require('fs').promises;
const path = require('path');

class MTTDataExporter {
  constructor(options = {}) {
    this.mttType = options.mttType || '08-475';  // MTT.%
    this.dataInterval = options.dataInterval || 0.5;  // Çü¿“” (m)
    this.outputDir = options.outputDir || './output/MTT';
  }

  /**
   * MTT.%nš©
   */
  static MTT_TYPES = {
    '08-475': {
      code: 5,
      chordLength: 10,  // &w (m)
      dPointOffset: -5,  // D¹nªÕ»ÃÈ (m)
      cPointOffset: 0    // C¹nªÕ»ÃÈ (m)
    },
    '08-1X': {
      code: 6,
      chordLength: 10,
      dPointOffset: -5,
      cPointOffset: 0
    },
    '08-2X': {
      code: 6,
      chordLength: 10,
      dPointOffset: -5,
      cPointOffset: 0
    },
    '08-32y': {
      code: 7,
      chordLength: 20,
      dPointOffset: -10,
      cPointOffset: 0
    },
    '08-32y2670': {
      code: 8,
      chordLength: 20,
      dPointOffset: -10,
      cPointOffset: 0
    },
    '08-275': {
      code: 9,
      chordLength: 10,
      dPointOffset: -5,
      cPointOffset: 0
    },
    '09-16(': {
      code: 10,
      chordLength: 10,
      dPointOffset: -5,
      cPointOffset: 0,
      special: true  // yŠæÕé°
    }
  };

  /**
   * MTTt™Çü¿’¨¯¹İüÈ
   */
  async exportMTTData(movementData, curveData, workSection) {
    try {
      // ú›Ç£ì¯Èên\
      await this.ensureDirectoryExists(this.outputDir);

      // MTT.%Å1nÖ—
      const mttInfo = MTTDataExporter.MTT_TYPES[this.mttType];
      if (!mttInfo) {
        throw new Error(`*şÜnMTT.%: ${this.mttType}`);
      }

      // Õ¡¤ën
      const fileName = this.generateFileName(workSection);
      const filePath = path.join(this.outputDir, fileName);

      // Çü¿Õ©üŞÃÈ	Û
      const formattedData = this.formatMTTData(
        movementData,
        curveData,
        workSection,
        mttInfo
      );

      // Õ¡¤ëú›
      await fs.writeFile(filePath, formattedData, 'utf8');

      console.log(`MTTt™Çü¿’ú›W~W_: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('MTTÇü¿ú›¨éü:', error);
      throw error;
    }
  }

  /**
   * MTTÇü¿Õ©üŞÃÈk	Û
   */
  formatMTTData(movementData, curveData, workSection, mttInfo) {
    const lines = [];

    // ØÃÀüLn
    lines.push(this.generateHeaderLine(workSection, mttInfo));

    // Çü¿Ln
    for (let i = 0; i < movementData.length; i++) {
      const movement = movementData[i];
      const curve = curveData ? curveData[i] : null;

      const dataLine = this.generateDataLine(
        movement,
        curve,
        i,
        workSection,
        mttInfo
      );

      lines.push(dataLine);
    }

    // ÕÃ¿üLnı 
    lines.push(this.generateFooterLine());

    return lines.join('\r\n');
  }

  /**
   * ØÃÀüLn
   */
  generateHeaderLine(workSection, mttInfo) {
    // 1Lî: ×ìíüÉ¹«óÈÕ¡¤ë.%
    const preloadDirection = workSection.lateralRail === 'left' ? '0' : '1';
    const cantDirection = workSection.verticalRail === 'right' ? '0' : '1';
    const fileType = mttInfo.code.toString();

    return `${preloadDirection}${cantDirection}${fileType}`;
  }

  /**
   * Çü¿Ln
   */
  generateDataLine(movement, curve, index, workSection, mttInfo) {
    // ­ín—
    const kilometer = this.calculateKilometer(index, workSection, mttInfo);

    // D¹˜Ïn—
    const dPointGuidance = this.calculateDPointGuidance(
      movement,
      index,
      mttInfo
    );

    // C¹Üc$n—MTTnOÃâ	
    const cPointCorrection = this.calculateCPointCorrection(
      curve,
      mttInfo
    );

    // D¹SF
Ïn—
    const dPointLift = this.calculateDPointLift(
      movement,
      index,
      mttInfo
    );

    // «óÈ$
    const cant = curve ? curve.cant || 0 : 0;

    // 09-16(n4nyŠÕ©üŞÃÈ
    if (mttInfo.special) {
      return this.format0916DataLine(
        kilometer,
        dPointGuidance,
        cPointCorrection,
        dPointLift,
        cant
      );
    }

    // 8Õ©üŞÃÈ
    return this.formatStandardDataLine(
      kilometer,
      dPointGuidance,
      cPointCorrection,
      dPointLift,
      cant
    );
  }

  /**
   * ­ín—
   */
  calculateKilometer(index, workSection, mttInfo) {
    const baseKm = workSection.startKm || 0;
    const position = index * this.dataInterval;

    // MTT.%kˆ‹MnÜc
    let adjustedPosition = position;
    if (!mttInfo.special) {
      // C¹ú–
      adjustedPosition = position + mttInfo.cPointOffset;
    } else {
      // D¹ú–09-16(	
      adjustedPosition = position + mttInfo.dPointOffset;
    }

    return (baseKm + adjustedPosition) / 1000;  // kmXM
  }

  /**
   * D¹˜Ïn—
   */
  calculateDPointGuidance(movement, index, mttInfo) {
    if (!movement || !movement.lateral) {
      return 0;
    }

    // D¹gn*ûÕÏmmXM	
    // MTTn&w’nW_Üc
    const dPointIndex = index + Math.round(mttInfo.dPointOffset / this.dataInterval);

    if (movement.lateralArray && movement.lateralArray[dPointIndex]) {
      return movement.lateralArray[dPointIndex];
    }

    return movement.lateral;
  }

  /**
   * C¹Üc$n—MTTnOÃâ	
   */
  calculateCPointCorrection(curve, mttInfo) {
    if (!curve) {
      return 0;
    }

    // òÚJ„K‰OÃâ’—
    // OÃâ = L^2 / (8R)
    // L: &w, R: J„
    if (curve.radius && curve.radius > 0) {
      const eccentricity = (mttInfo.chordLength * mttInfo.chordLength) / (8 * curve.radius);

      // ó«üÖL×é¹æ«üÖLŞ¤Ê¹
      return curve.direction === 'right' ? eccentricity : -eccentricity;
    }

    return 0;
  }

  /**
   * D¹SF
Ïn—
   */
  calculateDPointLift(movement, index, mttInfo) {
    if (!movement || !movement.vertical) {
      return 0;
    }

    // D¹gn&ûÕÏmmXM	
    const dPointIndex = index + Math.round(mttInfo.dPointOffset / this.dataInterval);

    if (movement.verticalArray && movement.verticalArray[dPointIndex]) {
      return movement.verticalArray[dPointIndex];
    }

    return movement.vertical;
  }

  /**
   * –Çü¿LnÕ©üŞÃÈ
   */
  formatStandardDataLine(kilometer, dGuidance, cCorrection, dLift, cant) {
    // ­í: 10Ap4A
    const kmStr = kilometer.toFixed(4).padStart(10, ' ');

    // D¹˜Ï: 7Ap3A&÷ØM
    const dGuidanceStr = this.formatSignedNumber(dGuidance, 7, 3);

    // C¹Üc$: 7Ap3A&÷ØM
    const cCorrectionStr = this.formatSignedNumber(cCorrection, 7, 3);

    // D¹SF
Ï: 7Ap3A&÷ØM
    const dLiftStr = this.formatSignedNumber(dLift, 7, 3);

    // «óÈ: 5Ap1A&÷ØM
    const cantStr = this.formatSignedNumber(cant, 5, 1);

    return `${kmStr}${dGuidanceStr}${cCorrectionStr}${dLiftStr}${cantStr}`;
  }

  /**
   * 09-16((Çü¿LnÕ©üŞÃÈ
   */
  format0916DataLine(kilometer, dGuidance, cCorrection, dLift, cant) {
    // yŠÕ©üŞÃÈÕØøkúeO	
    const kmStr = kilometer.toFixed(4).padStart(10, ' ');
    const dGuidanceStr = this.formatSignedNumber(dGuidance, 7, 3);
    const cCorrectionStr = this.formatSignedNumber(cCorrection, 7, 3);
    const dLiftStr = this.formatSignedNumber(dLift, 7, 3);
    const cantStr = this.formatSignedNumber(cant, 5, 1);

    // ı Õ£üëÉ
    const reserved = '0000000000000';  // ˆß

    return `${kmStr}${dGuidanceStr}${cCorrectionStr}${dLiftStr}${cantStr}${reserved}`;
  }

  /**
   * ÕÃ¿üLn
   */
  generateFooterLine() {
    return 'END';
  }

  /**
   * &÷ØMp$nÕ©üŞÃÈ
   */
  formatSignedNumber(value, totalWidth, decimalPlaces) {
    const formatted = value.toFixed(decimalPlaces);
    return formatted.padStart(totalWidth, ' ');
  }

  /**
   * Õ¡¤ë
   */
  generateFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}MD.MTT`;
  }

  /**
   * MTT(Õ
Šˆ,âbn—
   * ©C/ßnP’6mhW_©CâbK‰—
   */
  async calculateMTTPrediction(restoredWaveform, movementData) {
    // 6m*€n’Õ£ë¿êó°
    const filteredWaveform = this.filterShortWavelength(restoredWaveform, 6);

    // ûÕÏ’i(W_ˆ,âb
    const prediction = filteredWaveform.map((point, index) => {
      const movement = movementData[index] || { lateral: 0, vertical: 0 };
      return {
        position: point.position,
        lateral: point.lateral + movement.lateral,
        vertical: point.vertical + movement.vertical
      };
    });

    return prediction;
  }

  /**
   * íâwnÕ£ë¿êó°
   */
  filterShortWavelength(waveform, minWavelength) {
    // FFT’(Wfíâw’d»
    // ŸÅo%FFTâ¸åüë’(	
    return waveform;  // îŸÅ
  }

  /**
   * Ç£ì¯ÈênX(ºh\
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

module.exports = MTTDataExporter;
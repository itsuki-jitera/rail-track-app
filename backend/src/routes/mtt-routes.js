/**
 * MTT関連APIルート定義
 */

const express = require('express');
const router = express.Router();
const MTTConfiguration = require('../config/mtt-config');
const MovementCorrectionCalculator = require('../calculators/movement-correction');
const ALSDataExporter = require('../exporters/als-exporter');
const ALCDataExporter = require('../exporters/alc-exporter');
const WorkSection = require('../models/work-section');
const VerticalCurveManager = require('../models/vertical-curve');

/**
 * MTT機種一覧を取得
 */
router.get('/mtt-types', (req, res) => {
  try {
    const types = MTTConfiguration.getAllTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * MTT機種詳細を取得
 */
router.get('/mtt-types/:type', (req, res) => {
  try {
    const config = MTTConfiguration.getConfig(req.params.type);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 移動量補正を計算
 */
router.post('/calculate-correction', async (req, res) => {
  try {
    const { movements, mttType, correctionParams } = req.body;

    const calculator = new MovementCorrectionCalculator({
      mttType: mttType || '08-16',
      workDirection: req.body.workDirection || 'forward',
      levelingCorrection: req.body.levelingCorrection !== false,
      liningCorrection: req.body.liningCorrection !== false
    });

    const correctedMovements = calculator.applyAllCorrections(
      movements,
      correctionParams
    );

    res.json({
      success: true,
      data: {
        original: movements,
        corrected: correctedMovements,
        mttType: mttType
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ALS移動量データをエクスポート
 */
router.post('/export/als', async (req, res) => {
  try {
    const { movements, workSection, dataInterval } = req.body;

    const exporter = new ALSDataExporter({
      dataInterval: dataInterval || 5.0,
      workDirection: workSection.workDirection || 'forward'
    });

    const filePath = await exporter.exportALSData(movements, workSection);

    // 新幹線用分割データも生成する場合
    let shinkansenFiles = [];
    if (req.body.generateShinkansenData) {
      shinkansenFiles = await exporter.exportShinkansenData(movements, workSection);
    }

    res.json({
      success: true,
      data: {
        mainFile: filePath,
        shinkansenFiles: shinkansenFiles
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ALC移動量データをエクスポート
 */
router.post('/export/alc', async (req, res) => {
  try {
    const { movements, workSection, dataInterval } = req.body;

    const exporter = new ALCDataExporter({
      dataInterval: dataInterval || 5.0,
      workDirection: workSection.workDirection || 'forward'
    });

    const filePath = await exporter.exportALCData(movements, workSection);

    res.json({
      success: true,
      data: {
        filePath: filePath
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 作業区間を作成
 */
router.post('/work-section', (req, res) => {
  try {
    const workSection = new WorkSection(req.body);
    const validation = workSection.validate();

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    res.json({
      success: true,
      data: {
        workSection: workSection.getSummary(),
        validation: validation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 作業区間の検証
 */
router.post('/work-section/validate', (req, res) => {
  try {
    const workSection = new WorkSection(req.body);
    const validation = workSection.validate();

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 縦曲線諸元を管理
 */
router.post('/vertical-curves', (req, res) => {
  try {
    const manager = new VerticalCurveManager(req.body);
    const validation = manager.validate();

    res.json({
      success: true,
      data: {
        curves: manager.getSummary(),
        validation: validation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 縦曲線を追加
 */
router.post('/vertical-curves/add', (req, res) => {
  try {
    const manager = new VerticalCurveManager();
    const curve = manager.addCurve(req.body);

    res.json({
      success: true,
      data: curve
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 統合処理エンドポイント
 * 復元波形計算から移動量補正、データ出力まで一括処理
 */
router.post('/process-complete', async (req, res) => {
  try {
    const {
      measurementData,
      workSectionConfig,
      mttType,
      correctionSettings,
      exportSettings
    } = req.body;

    // 1. 作業区間の設定
    const workSection = new WorkSection(workSectionConfig);
    const sectionValidation = workSection.validate();

    if (!sectionValidation.valid) {
      return res.status(400).json({
        success: false,
        step: 'work-section',
        errors: sectionValidation.errors
      });
    }

    // 2. 移動量補正計算
    const calculator = new MovementCorrectionCalculator({
      mttType: mttType,
      ...correctionSettings
    });

    const correctedMovements = calculator.applyAllCorrections(
      measurementData.movements,
      {
        planLine: measurementData.planLine,
        fixedPoints: workSectionConfig.movementRestrictions
      }
    );

    // 3. データエクスポート
    const exportResults = {};

    if (exportSettings.als) {
      const alsExporter = new ALSDataExporter(exportSettings.als);
      exportResults.als = await alsExporter.exportALSData(
        correctedMovements,
        workSectionConfig
      );
    }

    if (exportSettings.alc) {
      const alcExporter = new ALCDataExporter(exportSettings.alc);
      exportResults.alc = await alcExporter.exportALCData(
        correctedMovements,
        workSectionConfig
      );
    }

    res.json({
      success: true,
      data: {
        workSection: workSection.getSummary(),
        movementCorrection: {
          applied: true,
          mttType: mttType
        },
        exports: exportResults
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
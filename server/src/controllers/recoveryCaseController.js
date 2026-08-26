import { getRecoveryCasesService, getRecoveryCaseByIdService } from '../services/recoveryCaseService.js';
import { evaluateAndStoreCaseRiskService, evaluateAllCasesRiskService } from '../services/riskEngineService.js';
import { diagnoseRecoveryCaseService } from '../services/aiDiagnosisService.js';
import { makeRecoveryDecisionService } from '../services/decisionEngineService.js';
import { evaluateCaseGuardrailsService } from '../services/guardrailEngineService.js';
import { executePaymentLinkRecoveryService } from '../services/recoveryExecutionService.js';

export const getRecoveryCases = async (req, res, next) => {
  try {
    const { page, limit, status, riskLevel } = req.query;
    const result = await getRecoveryCasesService({ page, limit, status, riskLevel });
    res.status(200).json({
      success: true,
      data: result.cases,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

export const getRecoveryCaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const recoveryCase = await getRecoveryCaseByIdService(id);
    res.status(200).json({
      success: true,
      data: recoveryCase
    });
  } catch (err) {
    next(err);
  }
};

export const evaluateCaseRisk = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await evaluateAndStoreCaseRiskService(id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const evaluateAllCasesRisk = async (req, res, next) => {
  try {
    const result = await evaluateAllCasesRiskService();
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const diagnoseRecoveryCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await diagnoseRecoveryCaseService(id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const makeRecoveryDecision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await makeRecoveryDecisionService(id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const evaluateCaseGuardrails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { proposedAction } = req.body || {};
    const result = await evaluateCaseGuardrailsService(id, proposedAction);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const executePaymentLinkRecovery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await executePaymentLinkRecoveryService(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

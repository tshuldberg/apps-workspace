import { TRPCError } from '@trpc/server'
import type {
  MLModel,
  MLModelMetrics,
  MLPrediction,
  MLSignal,
  TrainingConfig,
} from '@marlin/shared'

// ---------------------------------------------------------------------------
// In-memory model store (would be DB + model registry in production)
// ---------------------------------------------------------------------------

const models = new Map<string, MLModel>()
const predictions = new Map<string, MLPrediction[]>() // modelId -> predictions

// ---------------------------------------------------------------------------
// MLModelService — orchestration layer for ML model lifecycle
// ---------------------------------------------------------------------------

/**
 * Note: Actual ML training would use a Python/TensorFlow sidecar in production.
 * This service handles the orchestration, metadata, and mock training/inference
 * to prove out the end-to-end workflow.
 */
export class MLModelService {
  /**
   * Create a new ML model from a training config.
   */
  createModel(userId: string, config: TrainingConfig): MLModel {
    if (config.features.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'At least one feature is required',
      })
    }

    const now = new Date().toISOString()
    const model: MLModel = {
      id: crypto.randomUUID(),
      userId,
      name: config.name,
      type: config.modelType,
      status: 'draft',
      features: config.features,
      targetVariable: config.target,
      hyperparameters: {
        epochs: config.epochs,
        learningRate: config.learningRate,
        trainTestSplit: config.trainTestSplit,
        validationSplit: config.validationSplit,
      },
      createdAt: now,
      updatedAt: now,
    }

    models.set(model.id, model)
    predictions.set(model.id, [])
    return model
  }

  /**
   * Train a model (mock training — generates realistic metrics).
   * In production this would dispatch to a Python training worker.
   */
  async trainModel(
    modelId: string,
    userId: string,
    _data?: { features: number[][]; targets: number[] },
  ): Promise<MLModel> {
    const model = this.getModelOrThrow(modelId, userId)

    // Transition to training
    model.status = 'training'
    model.updatedAt = new Date().toISOString()

    // Simulate training delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Generate realistic mock metrics based on model type
    const metrics: MLModelMetrics = model.type === 'classification'
      ? {
          accuracy: 0.72 + Math.random() * 0.15,   // 72-87%
          precision: 0.68 + Math.random() * 0.18,   // 68-86%
          recall: 0.65 + Math.random() * 0.20,      // 65-85%
          auc: 0.75 + Math.random() * 0.15,          // 75-90%
          sharpe: 0.8 + Math.random() * 1.2,         // 0.8-2.0
        }
      : {
          mse: 0.001 + Math.random() * 0.005,       // 0.001-0.006
          mae: 0.02 + Math.random() * 0.03,          // 0.02-0.05
          r2: 0.5 + Math.random() * 0.35,            // 0.5-0.85
          sharpe: 0.6 + Math.random() * 1.4,         // 0.6-2.0
        }

    model.status = 'ready'
    model.trainedAt = new Date().toISOString()
    model.metrics = metrics
    model.updatedAt = new Date().toISOString()

    models.set(modelId, model)
    return model
  }

  /**
   * Generate a prediction from a trained model.
   * In production this would call the inference server.
   */
  predict(
    modelId: string,
    userId: string,
    symbol: string,
    featureValues: Record<string, number>,
  ): MLPrediction {
    const model = this.getModelOrThrow(modelId, userId)

    if (model.status !== 'ready' && model.status !== 'degraded') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Model is in "${model.status}" state. Must be "ready" or "degraded" to predict.`,
      })
    }

    // Mock prediction logic based on feature values
    // Combine feature values into a composite score
    const values = Object.values(featureValues)
    const avgFeature = values.length > 0
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0

    let signal: MLSignal
    let confidence: number

    if (model.type === 'classification') {
      // Classification: map composite score to signal
      if (avgFeature > 0.6) {
        signal = 'bullish'
        confidence = 0.55 + Math.min(avgFeature - 0.6, 0.4) * 0.5
      } else if (avgFeature < 0.4) {
        signal = 'bearish'
        confidence = 0.55 + Math.min(0.4 - avgFeature, 0.4) * 0.5
      } else {
        signal = 'neutral'
        confidence = 0.4 + Math.random() * 0.2
      }
    } else {
      // Regression: map predicted return to signal
      const predictedReturn = avgFeature * 0.02 - 0.01 // center around 0
      if (predictedReturn > 0.002) {
        signal = 'bullish'
        confidence = Math.min(0.5 + predictedReturn * 20, 0.95)
      } else if (predictedReturn < -0.002) {
        signal = 'bearish'
        confidence = Math.min(0.5 + Math.abs(predictedReturn) * 20, 0.95)
      } else {
        signal = 'neutral'
        confidence = 0.3 + Math.random() * 0.3
      }
    }

    // Clamp confidence
    confidence = Math.max(0, Math.min(1, confidence))

    const prediction: MLPrediction = {
      id: crypto.randomUUID(),
      modelId,
      timestamp: new Date().toISOString(),
      symbol,
      signal,
      confidence,
      features: featureValues,
    }

    // Store prediction
    const modelPredictions = predictions.get(modelId) ?? []
    modelPredictions.push(prediction)
    predictions.set(modelId, modelPredictions)

    return prediction
  }

  /**
   * Get training metrics for a model.
   */
  getModelMetrics(modelId: string, userId: string): MLModelMetrics {
    const model = this.getModelOrThrow(modelId, userId)

    if (!model.metrics) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Model has not been trained yet',
      })
    }

    return model.metrics
  }

  /**
   * List all models for a user.
   */
  listModels(userId: string): MLModel[] {
    const result: MLModel[] = []
    for (const model of models.values()) {
      if (model.userId === userId) result.push(model)
    }
    return result.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }

  /**
   * Get a single model by ID.
   */
  getModel(modelId: string, userId: string): MLModel | undefined {
    const model = models.get(modelId)
    if (model && model.userId === userId) return model
    return undefined
  }

  /**
   * Delete a model and its prediction history.
   */
  deleteModel(modelId: string, userId: string): void {
    const model = this.getModelOrThrow(modelId, userId)
    models.delete(model.id)
    predictions.delete(model.id)
  }

  /**
   * Get recent predictions for a model.
   */
  getPredictions(modelId: string, userId: string, limit: number = 100): MLPrediction[] {
    this.getModelOrThrow(modelId, userId)
    const preds = predictions.get(modelId) ?? []
    return preds.slice(-limit)
  }

  /**
   * Update model status (used by drift detection).
   */
  updateModelStatus(modelId: string, status: MLModel['status']): void {
    const model = models.get(modelId)
    if (model) {
      model.status = status
      model.updatedAt = new Date().toISOString()
    }
  }

  // ── Private ────────────────────────────────────────────────

  private getModelOrThrow(modelId: string, userId: string): MLModel {
    const model = models.get(modelId)
    if (!model || model.userId !== userId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Model "${modelId}" not found`,
      })
    }
    return model
  }
}

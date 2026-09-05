/** AI-estimated food item from a photo. */
export interface AIFoodEstimate {
  name: string;
  servingSize: string;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: 'high' | 'medium' | 'low';
}

/** Result from analyzing a meal photo. */
export interface PhotoAnalysisResult {
  foods: AIFoodEstimate[];
  rawResponse: string;
  imageUri: string;
}

/** Error from photo analysis. */
export interface PhotoAnalysisError {
  type: 'no_api_key' | 'network' | 'invalid_image' | 'no_food_detected';
  message: string;
}

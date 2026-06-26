export interface SuspensionSpecs {
  trackWidth: number; // トレッド幅 (mm), e.g., 1500
  tireDiameter: number; // タイヤ外径 (mm), e.g., 630
  camberStatic: number; // 静的キャンバー角 (度), e.g., -1.0
  casterStatic: number; // 静的キャスター角 (度), e.g., 6.0
  toeStatic: number; // 静的トー角 (度), e.g., 0.1
  kpi: number; // キングピン傾角 KPI (度), e.g., 10.0
  knuckleHeightUpper: number; // ナックル上部高さ (mm), e.g., 180
  knuckleHeightLower: number; // ナックル下部高さ (mm), e.g., 100
  hubOffset: number; // ハブオフセット (mm), e.g., 60
  lowerArmInnerX: number; // ロアアーム車体側X (mm), e.g., 220
  lowerArmInnerY: number; // ロアアーム車体側Y (mm), e.g., 180
  upperArmInnerY: number; // アッパーアーム車体側Y (mm), e.g., 480
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SuspensionState {
  // Hardpoints calculated for static state
  pLIn: Point2D;
  pLOut: Point2D;
  pUIn: Point2D;
  pUOut: Point2D;
  pWheel: Point2D;
  
  // Computed lengths
  lowerArmLength: number;
  upperArmLength: number;
  uprightHeight: number;
}

export interface SolverResult {
  pLIn: Point2D;
  pLOut: Point2D;
  pUIn: Point2D;
  pUOut: Point2D;
  pWheel: Point2D;
  camber: number;
  rollCenter: Point2D | null;
  trackWidthChange: number;
  scrubRadius: number;
  toe: number;
  kpiCurrent: number;
  isBound: boolean;
}

export type SuspensionPreset = 'sports' | 'formula' | 'sedan' | 'suv';

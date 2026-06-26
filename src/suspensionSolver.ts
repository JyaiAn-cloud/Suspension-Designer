import { SuspensionSpecs, SuspensionState, SolverResult, Point2D } from './types';

// Helper: Rotate a point around a center
export function rotatePoint(point: Point2D, center: Point2D, angleDeg: number): Point2D {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// Circle-circle intersection helper
export function intersectCircles(
  c1: Point2D,
  r1: number,
  c2: Point2D,
  r2: number
): { p1: Point2D; p2: Point2D } | null {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
    return null; // No intersection or concentric
  }

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

  const x2 = c1.x + (dx * a) / d;
  const y2 = c1.y + (dy * a) / d;

  return {
    p1: {
      x: x2 + (dy * h) / d,
      y: y2 - (dx * h) / d,
    },
    p2: {
      x: x2 - (dy * h) / d,
      y: y2 + (dx * h) / d,
    },
  };
}

// Reconstruct the static hardpoints (Right side, X > 0)
export function reconstructStaticHardpoints(specs: SuspensionSpecs): SuspensionState {
  const {
    trackWidth,
    tireDiameter,
    camberStatic,
    kpi,
    knuckleHeightUpper,
    knuckleHeightLower,
    hubOffset,
    lowerArmInnerX,
    lowerArmInnerY,
    upperArmInnerY,
  } = specs;

  const tireRadius = tireDiameter / 2;
  
  // 1. Wheel center (static)
  const pWheel: Point2D = { x: trackWidth / 2, y: tireRadius };

  // 2. Local knuckle coordinates relative to wheel center (un-cambered, un-steered)
  // Lower ball joint is offset inward by hubOffset, and downward by knuckleHeightLower
  const pLOutLocal: Point2D = { x: -hubOffset, y: -knuckleHeightLower };
  
  // Upper ball joint is offset inward further due to KPI, and upward by knuckleHeightUpper
  const kpiRad = (kpi * Math.PI) / 180;
  const kpiOffset = (knuckleHeightUpper + knuckleHeightLower) * Math.sin(kpiRad); // inward offset
  const pUOutLocal: Point2D = {
    x: -hubOffset - kpiOffset,
    y: knuckleHeightUpper,
  };

  // 3. Rotate knuckle joints by static camber (negative camber tilts top inward)
  // For Right wheel (X > 0), negative camber tilts top inward (left, which is counter-clockwise, so positive angle)
  const camberRad = (-camberStatic * Math.PI) / 180;
  const cosC = Math.cos(camberRad);
  const sinC = Math.sin(camberRad);

  const rotateLocal = (p: Point2D): Point2D => ({
    x: p.x * cosC - p.y * sinC,
    y: p.x * sinC + p.y * cosC,
  });

  const pLOutRotated = rotateLocal(pLOutLocal);
  const pUOutRotated = rotateLocal(pUOutLocal);

  const pLOut: Point2D = {
    x: pWheel.x + pLOutRotated.x,
    y: pWheel.y + pLOutRotated.y,
  };

  const pUOut: Point2D = {
    x: pWheel.x + pUOutRotated.x,
    y: pWheel.y + pUOutRotated.y,
  };

  // 4. Lower Arm Inner Pivot is given directly
  const pLIn: Point2D = { x: lowerArmInnerX, y: lowerArmInnerY };

  // 5. Upper Arm Inner Pivot:
  // Height is upperArmInnerY.
  // We calculate Upper Arm Length Lu and Lower Arm Length Ll.
  // Wait, to make arm lengths fully defined, we can define the Upper Arm length relative to lower arm,
  // or let's say the user wants to adjust arm lengths.
  // Actually, if we define the Upper Inner pivot such that the upper arm is a realistic length, e.g.,
  // let's say the Upper Arm is about 65% of the Lower Arm, or we can solve it so that the upper inner X is some reasonable position.
  // Let's compute a realistic static Upper Inner Pivot X:
  // Let's place it at a reasonable offset from the lower inner pivot, or let's say the upper arm has a length that aligns with the upper inner Y.
  // Let's assume Upper Arm Inner X is around (lowerArmInnerX + 50) mm.
  // Then the static upper arm length Lu is the distance between this computed inner point and the outer point.
  // Let's do this:
  const pUInX = lowerArmInnerX + 30; // standard packaging
  const pUIn: Point2D = { x: pUInX, y: upperArmInnerY };

  const lowerArmLength = Math.sqrt(
    Math.pow(pLOut.x - pLIn.x, 2) + Math.pow(pLOut.y - pLIn.y, 2)
  );
  const upperArmLength = Math.sqrt(
    Math.pow(pUOut.x - pUIn.x, 2) + Math.pow(pUOut.y - pUIn.y, 2)
  );
  const uprightHeight = Math.sqrt(
    Math.pow(pUOut.x - pLOut.x, 2) + Math.pow(pUOut.y - pLOut.y, 2)
  );

  return {
    pLIn,
    pLOut,
    pUIn,
    pUOut,
    pWheel,
    lowerArmLength,
    upperArmLength,
    uprightHeight,
  };
}

// Solve for the suspension state at a specific vertical stroke (Right side, X > 0)
// This solver is fully local (chassis-fixed coordinates)
export function solveRightSideLocal(
  targetStroke: number,
  specs: SuspensionSpecs,
  staticState: SuspensionState
): SolverResult & { localPWheel: Point2D } {
  const { pLIn, pUIn, lowerArmLength, upperArmLength, uprightHeight } = staticState;
  const { tireDiameter } = specs;
  const tireRadius = tireDiameter / 2;

  // Let's do a binary search on the lower arm angle thetaL to find the one that gives targetStroke
  // Static lower arm angle
  const thetaL0 = Math.atan2(staticState.pLOut.y - pLIn.y, staticState.pLOut.x - pLIn.x);

  let lowTheta = thetaL0 - 0.7; // ~40 degrees rebound
  let highTheta = thetaL0 + 0.7; // ~40 degrees bump
  let bestTheta = thetaL0;
  let bestPLOut = { ...staticState.pLOut };
  let bestPUOut = { ...staticState.pUOut };
  let bestPWheel = { ...staticState.pWheel };
  let bestCamber = specs.camberStatic;
  let isBound = false;

  for (let iter = 0; iter < 15; iter++) {
    const midTheta = (lowTheta + highTheta) / 2;
    
    // 1. Lower outer joint position
    const pLOut_curr: Point2D = {
      x: pLIn.x + lowerArmLength * Math.cos(midTheta),
      y: pLIn.y + lowerArmLength * Math.sin(midTheta),
    };

    // 2. Upper outer joint position (intersection of circle around pUIn and circle around pLOut_curr)
    const intersections = intersectCircles(pUIn, upperArmLength, pLOut_curr, uprightHeight);

    if (!intersections) {
      // Out of bounds / locked. Narrow the search
      if (midTheta > thetaL0) {
        highTheta = midTheta;
      } else {
        lowTheta = midTheta;
      }
      isBound = true;
      continue;
    }

    // Since we are on the Right side (X > 0), the outer joint is further to the right.
    // So we pick the intersection with the larger X coordinate.
    const pUOut_curr = intersections.p1.x > intersections.p2.x ? intersections.p1 : intersections.p2;

    // 3. Compute rigid body rotation of the knuckle
    const uStatic = {
      x: staticState.pUOut.x - staticState.pLOut.x,
      y: staticState.pUOut.y - staticState.pLOut.y,
    };
    const uCurrent = {
      x: pUOut_curr.x - pLOut_curr.x,
      y: pUOut_curr.y - pLOut_curr.y,
    };

    const thetaStatic = Math.atan2(uStatic.y, uStatic.x);
    const thetaCurrent = Math.atan2(uCurrent.y, uCurrent.x);
    const deltaTheta = thetaCurrent - thetaStatic;

    // 4. Compute new wheel center
    const vStatic = {
      x: staticState.pWheel.x - staticState.pLOut.x,
      y: staticState.pWheel.y - staticState.pLOut.y,
    };

    // Rotate vStatic by deltaTheta
    const cosD = Math.cos(deltaTheta);
    const sinD = Math.sin(deltaTheta);
    const pWheel_curr: Point2D = {
      x: pLOut_curr.x + vStatic.x * cosD - vStatic.y * sinD,
      y: pLOut_curr.y + vStatic.x * sinD + vStatic.y * cosD,
    };

    const currentStroke = pWheel_curr.y - staticState.pWheel.y;

    if (Math.abs(currentStroke - targetStroke) < 0.01) {
      bestTheta = midTheta;
      bestPLOut = pLOut_curr;
      bestPUOut = pUOut_curr;
      bestPWheel = pWheel_curr;
      // Camber change is equal to the knuckle rotation angle in degrees
      bestCamber = specs.camberStatic - (deltaTheta * 180) / Math.PI;
      isBound = false;
      break;
    }

    if (currentStroke < targetStroke) {
      // Need more bump (larger angle/height)
      if (pLOut_curr.x > pLIn.x) {
        lowTheta = midTheta;
      } else {
        highTheta = midTheta;
      }
    } else {
      // Need more rebound (smaller angle/height)
      if (pLOut_curr.x > pLIn.x) {
        highTheta = midTheta;
      } else {
        lowTheta = midTheta;
      }
    }

    bestTheta = midTheta;
    bestPLOut = pLOut_curr;
    bestPUOut = pUOut_curr;
    bestPWheel = pWheel_curr;
    bestCamber = specs.camberStatic + (deltaTheta * 180) / Math.PI;
  }

  // Calculate Roll Center for this side's geometry in local frame
  // Upper arm line: passes through pUIn and bestPUOut
  const mU = (bestPUOut.y - pUIn.y) / (bestPUOut.x - pUIn.x);
  // Lower arm line: passes through pLIn and bestPLOut
  const mL = (bestPLOut.y - pLIn.y) / (bestPLOut.x - pLIn.x);

  let rc: Point2D | null = null;
  const pContactLocal: Point2D = { x: bestPWheel.x, y: bestPWheel.y - tireRadius };

  if (Math.abs(mU - mL) > 1e-4) {
    const x_ic = (mU * pUIn.x - mL * pLIn.x - pUIn.y + pLIn.y) / (mU - mL);
    const y_ic = pUIn.y + mU * (x_ic - pUIn.x);

    // Intersection with centerline X = 0
    const m_ic = (y_ic - pContactLocal.y) / (x_ic - pContactLocal.x);
    const y_rc = pContactLocal.y - m_ic * pContactLocal.x;
    rc = { x: 0, y: y_rc };
  } else {
    // Parallel arms
    const y_rc = pContactLocal.y - mL * pContactLocal.x;
    rc = { x: 0, y: y_rc };
  }

  // Scrub Radius
  // Kingpin axis line connects bestPLOut and bestPUOut
  const mkp = (bestPUOut.y - bestPLOut.y) / (bestPUOut.x - bestPLOut.x);
  // Kingpin line at ground y = 0: x = bestPLOut.x - bestPLOut.y / mkp
  const x_kp_ground = bestPLOut.x - bestPLOut.y / mkp;
  const scrubRadius = bestPWheel.x - x_kp_ground;

  // Track Width Change
  const trackWidthChange = (bestPWheel.x - staticState.pWheel.x) * 2; // times 2 for both sides

  // KPI Current
  const kpiCurrent = (Math.atan2(bestPUOut.x - bestPLOut.x, bestPUOut.y - bestPLOut.y) * 180) / Math.PI;

  return {
    pLIn,
    pLOut: bestPLOut,
    pUIn,
    pUOut: bestPUOut,
    pWheel: bestPWheel,
    localPWheel: bestPWheel,
    camber: bestCamber,
    rollCenter: rc,
    trackWidthChange,
    scrubRadius,
    toe: specs.toeStatic, // simplified static toe, can steer or bump-steer
    kpiCurrent,
    isBound,
  };
}

// Compute the static Roll Center Height
export function getStaticRollCenterHeight(specs: SuspensionSpecs): number {
  const staticState = reconstructStaticHardpoints(specs);
  const result = solveRightSideLocal(0, specs, staticState);
  return result.rollCenter ? result.rollCenter.y : 100;
}

// Full solver that handles both sides, roll angle, and bump/rebound
export function solveFullSuspension(
  specs: SuspensionSpecs,
  strokeInput: number, // mm
  rollAngleDeg: number, // degrees
  steerAngleDeg: number = 0 // degrees (steering angle)
): {
  left: SolverResult;
  right: SolverResult;
  rollCenterHeight: number;
} {
  const staticState = reconstructStaticHardpoints(specs);
  const trackWidth = specs.trackWidth;

  // Under body roll, the roll center height acts as the rotation axis.
  // We'll use the static roll center height as the pivot point.
  const staticRCHeight = getStaticRollCenterHeight(specs);
  const pivotPoint: Point2D = { x: 0, y: staticRCHeight };

  // Calculate strokes for each side
  // Right side strokes up (compression) when rolling clockwise (positive roll)
  // Left side strokes down (extension) when rolling clockwise
  const rollRad = (rollAngleDeg * Math.PI) / 180;
  const rollStrokeRight = (trackWidth / 2) * Math.sin(rollRad);
  const rollStrokeLeft = -rollStrokeRight;

  const strokeRight = strokeInput + rollStrokeRight;
  const strokeLeft = strokeInput + rollStrokeLeft;

  // 1. Solve Right Side in Local Frame
  const rightLocal = solveRightSideLocal(strokeRight, specs, staticState);

  // 2. Solve Left Side in Local Frame (by solving a mirrored Right side)
  // To get the left side, we solve a right side with left's stroke, then mirror its X-coords
  const leftLocalRaw = solveRightSideLocal(strokeLeft, specs, staticState);
  const leftLocal: SolverResult = {
    ...leftLocalRaw,
    pLIn: { x: -leftLocalRaw.pLIn.x, y: leftLocalRaw.pLIn.y },
    pLOut: { x: -leftLocalRaw.pLOut.x, y: leftLocalRaw.pLOut.y },
    pUIn: { x: -leftLocalRaw.pUIn.x, y: leftLocalRaw.pUIn.y },
    pUOut: { x: -leftLocalRaw.pUOut.x, y: leftLocalRaw.pUOut.y },
    pWheel: { x: -leftLocalRaw.pWheel.x, y: leftLocalRaw.pWheel.y },
    camber: leftLocalRaw.camber, // camber sign is same on left side for consistent relative notation
  };

  // 3. Apply body roll rotation around Pivot Point
  // Positive roll angle is clockwise (tilt right).
  // So we rotate all CHASSIS-FIXED points (inner pivots) around the pivot point by -rollAngleDeg.
  // Wait, does the wheel also rotate?
  // Actually, the whole coordinate system rotates! So we rotate ALL points by -rollAngleDeg around pivotPoint.
  const rotateResult = (res: SolverResult, angle: number): SolverResult => {
    return {
      ...res,
      pLIn: rotatePoint(res.pLIn, pivotPoint, angle),
      pLOut: rotatePoint(res.pLOut, pivotPoint, angle),
      pUIn: rotatePoint(res.pUIn, pivotPoint, angle),
      pUOut: rotatePoint(res.pUOut, pivotPoint, angle),
      pWheel: rotatePoint(res.pWheel, pivotPoint, angle),
    };
  };

  const rightRotated = rotateResult(rightLocal, -rollAngleDeg);
  const leftRotated = rotateResult(leftLocal, -rollAngleDeg);

  // Under steering, we can compute a steer-induced toe change
  // Simple steering model: toe changes proportional to steering angle plus a small bump-steer factor
  const bumpSteerFactorRight = 0.01 * strokeRight; // 0.01 degrees per mm
  const bumpSteerFactorLeft = 0.01 * strokeLeft;
  
  const rightToe = specs.toeStatic + steerAngleDeg + bumpSteerFactorRight;
  const leftToe = specs.toeStatic + steerAngleDeg - bumpSteerFactorLeft;

  // Recalculate Roll Center in global space
  // This is the intersection of:
  // - Line from right contact patch to right instant center
  // - Line from left contact patch to left instant center
  // For simplicity and stability, we can take the average of local roll centers,
  // or construct it globally. The local height shifted by body roll is extremely close.
  const rollCenterGlobalY = staticRCHeight - (strokeInput); // drops as body squats

  return {
    right: {
      ...rightRotated,
      toe: rightToe,
      camber: rightLocal.camber + rollAngleDeg, // Camber relative to ground = Camber relative to chassis + roll angle
    },
    left: {
      ...leftRotated,
      toe: leftToe,
      camber: leftLocal.camber - rollAngleDeg, // Camber relative to ground (decreases with positive body roll)
    },
    rollCenterHeight: rollCenterGlobalY,
  };
}

// Suspension presets
export const PRESETS: Record<string, SuspensionSpecs> = {
  sports: {
    trackWidth: 1550,
    tireDiameter: 640,
    camberStatic: -1.2,
    casterStatic: 6.5,
    toeStatic: 0.05,
    kpi: 9.0,
    knuckleHeightUpper: 190,
    knuckleHeightLower: 110,
    hubOffset: 65,
    lowerArmInnerX: 250,
    lowerArmInnerY: 170,
    upperArmInnerY: 460,
  },
  formula: {
    trackWidth: 1650,
    tireDiameter: 600,
    camberStatic: -2.5,
    casterStatic: 5.0,
    toeStatic: -0.1,
    kpi: 6.0,
    knuckleHeightUpper: 150,
    knuckleHeightLower: 90,
    hubOffset: 70,
    lowerArmInnerX: 180,
    lowerArmInnerY: 100,
    upperArmInnerY: 340,
  },
  sedan: {
    trackWidth: 1500,
    tireDiameter: 620,
    camberStatic: -0.5,
    casterStatic: 7.0,
    toeStatic: 0.1,
    kpi: 11.0,
    knuckleHeightUpper: 210,
    knuckleHeightLower: 120,
    hubOffset: 55,
    lowerArmInnerX: 280,
    lowerArmInnerY: 200,
    upperArmInnerY: 520,
  },
  suv: {
    trackWidth: 1600,
    tireDiameter: 740,
    camberStatic: -0.2,
    casterStatic: 5.5,
    toeStatic: 0.15,
    kpi: 12.0,
    knuckleHeightUpper: 240,
    knuckleHeightLower: 150,
    hubOffset: 60,
    lowerArmInnerX: 300,
    lowerArmInnerY: 280,
    upperArmInnerY: 640,
  },
};

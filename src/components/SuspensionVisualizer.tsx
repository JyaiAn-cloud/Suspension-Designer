import React, { useState } from 'react';
import { SuspensionSpecs, SolverResult, Point2D } from '../types';
import { rotatePoint } from '../suspensionSolver';
import { Eye, Settings, Compass, RefreshCw, Sliders } from 'lucide-react';

interface SuspensionVisualizerProps {
  specs: SuspensionSpecs;
  left: SolverResult;
  right: SolverResult;
  rollCenterHeight: number;
  stroke: number;
  rollAngle: number;
  steerAngle: number;
  isRear: boolean;
  onChangeStroke: (stroke: number) => void;
}

export const SuspensionVisualizer: React.FC<SuspensionVisualizerProps> = ({
  specs,
  left,
  right,
  rollCenterHeight,
  stroke,
  rollAngle,
  steerAngle,
  isRear,
  onChangeStroke,
}) => {
  const [activeView, setActiveView] = useState<'front' | 'side' | 'top'>('front');
  const [showProjectionLines, setShowProjectionLines] = useState(true);

  const { tireDiameter, trackWidth, kpi, casterStatic } = specs;
  const tireRadius = tireDiameter / 2;

  const tireWidthVal = 210;
  const rightRotRad = (right.camber * Math.PI) / 180;
  const leftRotRad = (-left.camber * Math.PI) / 180;

  const yBottomR = right.pWheel.y - tireRadius * Math.cos(rightRotRad) - (tireWidthVal / 2) * Math.abs(Math.sin(rightRotRad));
  const yBottomL = left.pWheel.y - tireRadius * Math.cos(leftRotRad) - (tireWidthVal / 2) * Math.abs(Math.sin(leftRotRad));

  // Shift Y so that the bottom-most points of the two tires stay exactly on the ground line (Y=520 in SVG)
  const yShift = (yBottomR + yBottomL) / 2;

  // Coordinate mapper from Engineering to SVG (Front View)
  const heightLimit = 750;
  const viewWidth = 1800;
  const viewHeight = 650;

  const toSvg = (p: Point2D): Point2D => {
    // Translate X so that center X=0 is in the middle of viewbox (e.g. at 900)
    // Map Y so that ground Y=0 is near the bottom (e.g. at 520) and shifted so tires stay on ground
    return {
      x: 900 + p.x,
      y: 520 - (p.y - yShift),
    };
  };

  // Convert points
  const pLInR = toSvg(right.pLIn);
  const pLOutR = toSvg(right.pLOut);
  const pUInR = toSvg(right.pUIn);
  const pUOutR = toSvg(right.pUOut);
  const pWheelR = toSvg(right.pWheel);

  const pLInL = toSvg(left.pLIn);
  const pLOutL = toSvg(left.pLOut);
  const pUInL = toSvg(left.pUIn);
  const pUOutL = toSvg(left.pUOut);
  const pWheelL = toSvg(left.pWheel);

  // Instant Center and Roll Center calculations for drawing projection lines
  // Let's compute local instant centers to draw projection lines
  const getICAndProjectionPoints = (side: 'left' | 'right', sol: SolverResult) => {
    const isR = side === 'right';
    const pUIn = sol.pUIn;
    const pUOut = sol.pUOut;
    const pLIn = sol.pLIn;
    const pLOut = sol.pLOut;

    const mU = (pUOut.y - pUIn.y) / (pUOut.x - pUIn.x);
    const mL = (pLOut.y - pLIn.y) / (pLOut.x - pLIn.x);

    if (Math.abs(mU - mL) < 1e-4) {
      return null; // Parallel
    }

    const x_ic = (mU * pUIn.x - mL * pLIn.x - pUIn.y + pLIn.y) / (mU - mL);
    const y_ic = pUIn.y + mU * (x_ic - pUIn.x);
    const pIC = { x: x_ic, y: y_ic };

    // Point on ground
    const pContact = { x: sol.pWheel.x, y: sol.pWheel.y - tireRadius };

    return {
      pIC,
      pContact,
    };
  };

  const icRight = getICAndProjectionPoints('right', right);
  const icLeft = getICAndProjectionPoints('left', left);

  // SVG representation of IC and RC
  const pICR_svg = icRight ? toSvg(icRight.pIC) : null;
  const pICL_svg = icLeft ? toSvg(icLeft.pIC) : null;
  const pRCSvg = toSvg({ x: 0, y: rollCenterHeight });

  // Draw Tire Rectangle helper
  const renderTire = (side: 'left' | 'right', pWheel: Point2D, camber: number) => {
    const tireWidth = 210;
    const tireHeight = tireDiameter;
    // Rotate left and right tires according to their solved camber value.
    // If side is 'right', positive camber is clockwise (tilts right/outward).
    // If side is 'left', positive camber is counter-clockwise (tilts left/outward).
    const rotAngle = side === 'right' ? camber : -camber;

    return (
      <g transform={`rotate(${rotAngle}, ${pWheel.x}, ${pWheel.y})`}>
        {/* Tire Main Outer Body */}
        <rect
          x={pWheel.x - tireWidth / 2}
          y={pWheel.y - tireHeight / 2}
          width={tireWidth}
          height={tireHeight}
          rx="18"
          fill="#475569"
          fillOpacity="0.12"
          stroke="#475569"
          strokeWidth="3"
          strokeOpacity="0.5"
        />
        {/* Tread Grooves */}
        <line
          x1={pWheel.x - tireWidth / 4}
          y1={pWheel.y - tireHeight / 2 + 15}
          x2={pWheel.x - tireWidth / 4}
          y2={pWheel.y + tireHeight / 2 - 15}
          stroke="#475569"
          strokeWidth="2.5"
          strokeOpacity="0.2"
          strokeDasharray="12,12"
        />
        <line
          x1={pWheel.x + tireWidth / 4}
          y1={pWheel.y - tireHeight / 2 + 15}
          x2={pWheel.x + tireWidth / 4}
          y2={pWheel.y + tireHeight / 2 - 15}
          stroke="#475569"
          strokeWidth="2.5"
          strokeOpacity="0.2"
          strokeDasharray="12,12"
        />
      </g>
    );
  };

  return (
    <div id="suspension-visualizer-card" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col h-full text-slate-800">
      {/* Decorative clean grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Visualizer Header Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4 z-10">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
            {isRear ? 'リヤ' : 'フロント'} ジオメトリ可視化ビュー
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 p-1 rounded-xl">
          <button
            id="view-front-btn"
            onClick={() => setActiveView('front')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'front'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            正面図 (Front)
          </button>
          <button
            id="view-side-btn"
            onClick={() => setActiveView('side')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'side'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            側面図 (Side)
          </button>
          <button
            id="view-top-btn"
            onClick={() => setActiveView('top')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'top'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            上面図 (Top)
          </button>
        </div>

        {activeView === 'front' && (
          <button
            id="toggle-projection-btn"
            onClick={() => setShowProjectionLines(!showProjectionLines)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${
              showProjectionLines
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            投影補助線: {showProjectionLines ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {/* Main Vector Stage */}
      <div className="flex-1 min-h-[360px] bg-slate-50 border border-slate-200/60 rounded-xl relative overflow-hidden flex items-center justify-center">
        {activeView === 'front' && (
          <svg
            id="svg-front-view"
            viewBox="0 0 1800 650"
            className="w-full h-full max-h-[500px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ground Plane */}
            <line x1="100" y1="520" x2="1700" y2="520" stroke="#94a3b8" strokeWidth="2.5" />
            <rect x="100" y="520" width="1600" height="20" fill="url(#ground-stripe)" opacity="0.15" />

            {/* Vehicle Centerline */}
            <line
              x1="900"
              y1="50"
              x2="900"
              y2="520"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4,8"
            />
            <text x="910" y="70" fill="#64748b" fontSize="10" fontFamily="monospace">
              車体中心線 (CL)
            </text>

            {/* Projection / Construction Lines for Instant Centers */}
            {showProjectionLines && icRight && pICR_svg && (
              <g opacity="0.9">
                {/* Upper arm projection */}
                <line
                  x1={pUInR.x}
                  y1={pUInR.y}
                  x2={pICR_svg.x}
                  y2={pICR_svg.y}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="3,5"
                />
                {/* Lower arm projection */}
                <line
                  x1={pLInR.x}
                  y1={pLInR.y}
                  x2={pICR_svg.x}
                  y2={pICR_svg.y}
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="3,5"
                />
                {/* Instant Center point */}
                <circle cx={pICR_svg.x} cy={pICR_svg.y} r="5" fill="#f87171" />
                <text
                  x={pICR_svg.x + 10}
                  y={pICR_svg.y - 10}
                  fill="#b91c1c"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  瞬時中心 (IC_R)
                </text>
                {/* IC to contact patch line */}
                <line
                  x1={toSvg(icRight.pContact).x}
                  y1={toSvg(icRight.pContact).y}
                  x2={pICR_svg.x}
                  y2={pICR_svg.y}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="4,4"
                />
              </g>
            )}

            {showProjectionLines && icLeft && pICL_svg && (
              <g opacity="0.9">
                {/* Upper arm projection */}
                <line
                  x1={pUInL.x}
                  y1={pUInL.y}
                  x2={pICL_svg.x}
                  y2={pICL_svg.y}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="3,5"
                />
                {/* Lower arm projection */}
                <line
                  x1={pLInL.x}
                  y1={pLInL.y}
                  x2={pICL_svg.x}
                  y2={pICL_svg.y}
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="3,5"
                />
                {/* Instant Center point */}
                <circle cx={pICL_svg.x} cy={pICL_svg.y} r="5" fill="#f87171" />
                <text
                  x={pICL_svg.x - 70}
                  y={pICL_svg.y - 10}
                  fill="#b91c1c"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  瞬時中心 (IC_L)
                </text>
                {/* IC to contact patch line */}
                <line
                  x1={toSvg(icLeft.pContact).x}
                  y1={toSvg(icLeft.pContact).y}
                  x2={pICL_svg.x}
                  y2={pICL_svg.y}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="4,4"
                />
              </g>
            )}

            {/* Chassis Body block */}
            <path
              d={`M ${pUInL.x} ${pUInL.y} L ${pUInR.x} ${pUInR.y} L ${pLInR.x} ${pLInR.y} L ${pLInL.x} ${pLInL.y} Z`}
              fill="#e2e8f0"
              fillOpacity="0.7"
              stroke="#64748b"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Chassis Cross member detail */}
            <line x1={pUInL.x} y1={pUInL.y} x2={pLInR.x} y2={pLInR.y} stroke="#cbd5e1" strokeWidth="2" />
            <line x1={pUInR.x} y1={pUInR.y} x2={pLInL.x} y2={pLInL.y} stroke="#cbd5e1" strokeWidth="2" />

            {/* Tires (rendered first so that arms/uprights overlay nicely on top) */}
            {renderTire('left', pWheelL, left.camber)}
            {renderTire('right', pWheelR, right.camber)}

            {/* LEFT SIDE SUSPENSION */}
            {/* Lower Control Arm */}
            <line
              x1={pLInL.x}
              y1={pLInL.y}
              x2={pLOutL.x}
              y2={pLOutL.y}
              stroke="#3b82f6"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx={pLInL.x} cy={pLInL.y} r="6.5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="3.5" />
            <circle cx={pLOutL.x} cy={pLOutL.y} r="6.5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="3.5" />

            {/* Upper Control Arm */}
            <line
              x1={pUInL.x}
              y1={pUInL.y}
              x2={pUOutL.x}
              y2={pUOutL.y}
              stroke="#ef4444"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx={pUInL.x} cy={pUInL.y} r="5.5" fill="#ffffff" stroke="#b91c1c" strokeWidth="3" />
            <circle cx={pUOutL.x} cy={pUOutL.y} r="5.5" fill="#ffffff" stroke="#b91c1c" strokeWidth="3" />

            {/* Upright / Knuckle */}
            <path
              d={`M ${pUOutL.x} ${pUOutL.y} L ${pLOutL.x} ${pLOutL.y} L ${pWheelL.x} ${pWheelL.y} Z`}
              fill="#64748b"
              fillOpacity="0.15"
              stroke="#475569"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* RIGHT SIDE SUSPENSION */}
            {/* Lower Control Arm */}
            <line
              x1={pLInR.x}
              y1={pLInR.y}
              x2={pLOutR.x}
              y2={pLOutR.y}
              stroke="#3b82f6"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx={pLInR.x} cy={pLInR.y} r="6.5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="3.5" />
            <circle cx={pLOutR.x} cy={pLOutR.y} r="6.5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="3.5" />

            {/* Upper Control Arm */}
            <line
              x1={pUInR.x}
              y1={pUInR.y}
              x2={pUOutR.x}
              y2={pUOutR.y}
              stroke="#ef4444"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx={pUInR.x} cy={pUInR.y} r="5.5" fill="#ffffff" stroke="#b91c1c" strokeWidth="3" />
            <circle cx={pUOutR.x} cy={pUOutR.y} r="5.5" fill="#ffffff" stroke="#b91c1c" strokeWidth="3" />

            {/* Upright / Knuckle */}
            <path
              d={`M ${pUOutR.x} ${pUOutR.y} L ${pLOutR.x} ${pLOutR.y} L ${pWheelR.x} ${pWheelR.y} Z`}
              fill="#64748b"
              fillOpacity="0.15"
              stroke="#475569"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* Roll Center Height Indicator */}
            {showProjectionLines && (
              <g>
                {/* 正面についている円を取り除き、すっきりとした十字線と交点ドット（正方形）に変更 */}
                <rect
                  x={pRCSvg.x - 4}
                  y={pRCSvg.y - 4}
                  width="8"
                  height="8"
                  fill="#059669"
                  rx="1"
                />
                <line
                  x1={pRCSvg.x - 40}
                  y1={pRCSvg.y}
                  x2={pRCSvg.x + 40}
                  y2={pRCSvg.y}
                  stroke="#059669"
                  strokeWidth="2"
                />
                <line
                  x1={pRCSvg.x}
                  y1={pRCSvg.y - 12}
                  x2={pRCSvg.x}
                  y2={pRCSvg.y + 12}
                  stroke="#059669"
                  strokeWidth="2"
                />
                <text
                  x={pRCSvg.x + 18}
                  y={pRCSvg.y + 16}
                  fill="#059669"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  RC: {rollCenterHeight.toFixed(1)}mm
                </text>
              </g>
            )}

            {/* Annotations & Hardpoint details */}
            <text x={pLInR.x + 10} y={pLInR.y + 20} fill="#64748b" fontSize="9" fontFamily="monospace">
              ロア内側 ({right.pLIn.x.toFixed(0)}, {right.pLIn.y.toFixed(0)})
            </text>
            <text x={pUInR.x + 10} y={pUInR.y - 10} fill="#64748b" fontSize="9" fontFamily="monospace">
              アッパー内側 ({right.pUIn.x.toFixed(0)}, {right.pUIn.y.toFixed(0)})
            </text>

            <defs>
              <pattern id="ground-stripe" width="20" height="20" patternUnits="userSpaceOnUse">
                <line x1="0" y1="20" x2="20" y2="0" stroke="#cbd5e1" strokeWidth="2.5" />
              </pattern>
            </defs>
          </svg>
        )}

        {activeView === 'side' && (
          <svg
            id="svg-side-view"
            viewBox="0 0 1000 650"
            className="w-full h-full max-h-[500px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ground */}
            <line x1="100" y1="520" x2="900" y2="520" stroke="#94a3b8" strokeWidth="2.5" />
            <rect x="100" y="520" width="800" height="20" fill="url(#ground-stripe)" opacity="0.15" />

            {/* Tire Circle from side */}
            <circle
              cx="500"
              cy={520 - tireRadius}
              r={tireRadius}
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="10"
            />
            {/* Inner rim circle */}
            <circle
              cx="500"
              cy={520 - tireRadius}
              r={tireRadius * 0.6}
              fill="#e2e8f0"
              stroke="#64748b"
              strokeWidth="4"
            />

            {/* Kingpin Axis in Side View representing Caster */}
            {(() => {
              const casterRad = (casterStatic * Math.PI) / 180;
              const wCenterY = 520 - tireRadius;
              const lowY = wCenterY - 100;
              const upY = wCenterY + 180;
              const diffY = upY - lowY;
              const diffX = diffY * Math.tan(casterRad);

              const kpLowX = 500 - 60;
              const kpUpX = kpLowX - diffX;

              const groundIntersectX = kpLowX + ((520 - lowY) * (kpUpX - kpLowX)) / (upY - lowY);

              return (
                <g>
                  {/* Kingpin line */}
                  <line
                    x1={kpLowX}
                    y1={lowY}
                    x2={kpUpX}
                    y2={upY}
                    stroke="#d97706"
                    strokeWidth="3.5"
                    strokeDasharray="4,4"
                  />
                  {/* Extension to ground */}
                  <line
                    x1={kpLowX}
                    y1={lowY}
                    x2={groundIntersectX}
                    y2={520}
                    stroke="#d97706"
                    strokeWidth="1.5"
                    strokeDasharray="2,3"
                    opacity="0.8"
                  />

                  {/* Caster angle arc annotation */}
                  <path
                    d={`M 500 ${wCenterY - 100} A 100 100 0 0 0 ${500 - 100 * Math.sin(casterRad)} ${wCenterY - 100 * Math.cos(casterRad)}`}
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="2"
                  />
                  <line x1="500" y1={wCenterY - 150} x2="500" y2={wCenterY + 50} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

                  {/* Kingpin joints */}
                  <circle cx={kpLowX} cy={lowY} r="6" fill="#3b82f6" />
                  <circle cx={kpUpX} cy={upY} r="6" fill="#ef4444" />

                  {/* Caster Trail */}
                  <line x1="500" y1="520" x2={groundIntersectX} y2="520" stroke="#d97706" strokeWidth="3" />
                  <circle cx="500" cy="520" r="4" fill="#64748b" />
                  <circle cx={groundIntersectX} cy="520" r="4" fill="#d97706" />

                  {/* Text Details */}
                  <text x="520" y={wCenterY - 100} fill="#d97706" fontSize="13" fontWeight="bold">
                    キャスター角: {casterStatic.toFixed(1)}°
                  </text>
                  <text x="520" y="500" fill="#d97706" fontSize="11" fontFamily="monospace">
                    キャスタートレール: {Math.abs(500 - groundIntersectX).toFixed(1)}mm
                  </text>
                </g>
              );
            })()}

            {/* Tire Center Cap */}
            <circle cx="500" cy={520 - tireRadius} r="15" fill="#f1f5f9" stroke="#475569" strokeWidth="2.5" />
          </svg>
        )}

        {activeView === 'top' && (
          <svg
            id="svg-top-view"
            viewBox="0 0 1000 650"
            className="w-full h-full max-h-[500px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Grid background */}
            <line x1="100" y1="325" x2="900" y2="325" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="500" y1="100" x2="500" y2="550" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />

            {/* Front tires viewed from top */}
            {(() => {
              const rightToeTotal = right.toe;
              const leftToeTotal = left.toe;

              const renderTopTire = (cx: number, cy: number, rot: number, side: 'L' | 'R') => {
                const w = 110;
                const h = 290;
                return (
                  <g transform={`rotate(${rot}, ${cx}, ${cy})`}>
                    <rect
                      x={cx - w / 2}
                      y={cy - h / 2}
                      width={w}
                      height={h}
                      rx="8"
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="3"
                    />
                    {/* Treads */}
                    <line x1={cx - 20} y1={cy - h / 2 + 10} x2={cx - 20} y2={cy + h / 2 - 10} stroke="#1e293b" strokeWidth="2.5" strokeDasharray="10,8" />
                    <line x1={cx + 20} y1={cy - h / 2 + 10} x2={cx + 20} y2={cy + h / 2 - 10} stroke="#1e293b" strokeWidth="2.5" strokeDasharray="10,8" />
                  </g>
                );
              };

              return (
                <g>
                  {/* Draw chassis link lines */}
                  <rect x="350" y="240" width="300" height="170" fill="#e2e8f0" fillOpacity="0.7" stroke="#64748b" strokeWidth="2" rx="6" />

                  {renderTopTire(250, 325, leftToeTotal, 'L')}
                  {renderTopTire(750, 325, rightToeTotal, 'R')}

                  {/* Steering Rack and Tie Rods */}
                  <line x1="380" y1="350" x2="620" y2="350" stroke="#64748b" strokeWidth="6" />
                  {/* Tie rod left */}
                  <line x1="380" y1="350" x2="250" y2="335" stroke="#3b82f6" strokeWidth="3" />
                  {/* Tie rod right */}
                  <line x1="620" y1="350" x2="750" y2="335" stroke="#3b82f6" strokeWidth="3" />

                  <circle cx="380" cy="350" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="2" />
                  <circle cx="620" cy="350" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="2" />

                  {/* Steering wheel vector details */}
                  <text x="270" y="160" fill="#d97706" fontSize="12" fontWeight="bold">
                    右輪トー / 転舵角: {rightToeTotal.toFixed(2)}°
                  </text>
                  <text x="270" y="185" fill="#64748b" fontSize="11" fontFamily="monospace">
                    (静的トー角 + ステア角 + バンプステア)
                  </text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>

      {/* Stroke adjustment slider direct access in visualizer */}
      <div id="visualizer-stroke-slider-container" className="mt-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            バンプ量・サスペンションストローク調整 (可視化ビュー連動)
            <span className="text-[10px] text-slate-400 font-mono">(-50 〜 +50mm)</span>
          </span>
          <span className="text-xs font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
            {stroke > 0 ? `+${stroke}` : stroke} mm
          </span>
        </div>
        <input
          id="visualizer-stroke-slider"
          type="range"
          min="-50"
          max="50"
          step="1"
          value={stroke}
          onChange={(e) => onChangeStroke(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
          <span>伸び (Rebound)</span>
          <span className="cursor-pointer hover:text-sky-600 font-bold text-sky-500 transition-colors" onClick={() => onChangeStroke(0)}>1G接地 (0mm)</span>
          <span>縮み (Bump)</span>
        </div>
      </div>

      {/* Dynamic parameters footer */}
      <div id="visualizer-status-bar" className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl z-10">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">ロールセンター高さ</span>
          <span className="text-sm font-bold text-slate-800 font-mono">
            {rollCenterHeight.toFixed(1)} <span className="text-xs text-slate-400">mm</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">右輪キャンバー</span>
          <span className="text-sm font-bold text-sky-600 font-mono">
            {right.camber.toFixed(2)}°
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">左輪キャンバー</span>
          <span className="text-sm font-bold text-rose-600 font-mono">
            {left.camber.toFixed(2)}°
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">スクラブ半径</span>
          <span className="text-sm font-bold text-amber-600 font-mono">
            {right.scrubRadius.toFixed(1)} <span className="text-xs text-slate-400">mm</span>
          </span>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { SuspensionSpecs, SuspensionState } from '../types';
import { solveRightSideLocal } from '../suspensionSolver';
import { ZoomIn, ZoomOut, RotateCcw, X, Move } from 'lucide-react';

interface KinematicsChartsProps {
  specs: SuspensionSpecs;
  staticState: SuspensionState;
  currentStroke: number;
}

interface ExpandedChartState {
  title: string;
  yLabel: string;
  getValue: (item: any) => number;
  color: string;
  yMin: number;
  yMax: number;
  currentVal: number;
}

export const KinematicsCharts: React.FC<KinematicsChartsProps> = ({
  specs,
  staticState,
  currentStroke,
}) => {
  const [expandedChart, setExpandedChart] = useState<ExpandedChartState | null>(null);

  // Expanded chart interactive state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Generate data points from -50mm to +50mm
  const strokePoints = Array.from({ length: 21 }, (_, i) => -50 + i * 5);

  const data = strokePoints.map((stroke) => {
    const result = solveRightSideLocal(stroke, specs, staticState);
    return {
      stroke,
      camber: result.camber,
      rollCenterHeight: result.rollCenter ? result.rollCenter.y : 0,
      trackWidthChange: result.trackWidthChange,
      toe: result.toe + (0.01 * stroke), // Simple steer ratio for display
    };
  });

  const openModal = (chart: ExpandedChartState) => {
    setExpandedChart(chart);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const closeModal = () => {
    setExpandedChart(null);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.25, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Dragging event handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const scaleFactor = 1.1;
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev * scaleFactor, 5));
    } else {
      setZoom((prev) => Math.max(prev / scaleFactor, 0.5));
    }
  };

  // Helper to render a clean, professional SVG chart
  const renderSvgChart = (
    title: string,
    yLabel: string,
    getValue: (item: typeof data[0]) => number,
    color: string,
    yMin: number,
    yMax: number,
    currentVal: number
  ) => {
    const width = 320;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 45 };

    const mapX = (stroke: number) => {
      const pct = (stroke - (-50)) / 100;
      return padding.left + pct * (width - padding.left - padding.right);
    };

    const mapY = (val: number) => {
      const range = yMax - yMin;
      const pct = (val - yMin) / (range || 1);
      // invert Y for screen coordinates
      return height - padding.bottom - pct * (height - padding.top - padding.bottom);
    };

    // Generate path
    const pointsStr = data
      .map((d) => `${mapX(d.stroke)},${mapY(getValue(d))}`)
      .join(' ');

    const currentX = mapX(currentStroke);
    const currentY = mapY(currentVal);

    // Gridlines
    const yGridTicks = 5;
    const yTicks = Array.from({ length: yGridTicks }, (_, i) => yMin + (i * (yMax - yMin)) / (yGridTicks - 1));

    const chartInfo: ExpandedChartState = {
      title,
      yLabel,
      getValue,
      color,
      yMin,
      yMax,
      currentVal,
    };

    return (
      <div
        id={`chart-${title.replace(/\s+/g, '-').toLowerCase()}`}
        onClick={() => openModal(chartInfo)}
        className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm cursor-pointer hover:border-sky-400 hover:shadow-md transition-all group"
      >
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-700 group-hover:text-sky-600 transition-colors">{title}</span>
            <span className="text-xs font-mono font-bold" style={{ color }}>
              {currentVal.toFixed(2)}
              <span className="text-[10px] text-slate-400 ml-1">{yLabel}</span>
            </span>
          </div>
        </div>

        <div className="relative w-full h-[140px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full pointer-events-none">
            {/* Horizontal Gridlines */}
            {yTicks.map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={mapY(tick)}
                  x2={width - padding.right}
                  y2={mapY(tick)}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2,4"
                />
                <text
                  x={padding.left - 8}
                  y={mapY(tick) + 4}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}

            {/* X Axis Gridline (Stroke = 0) */}
            <line
              x1={mapX(0)}
              y1={padding.top}
              x2={mapX(0)}
              y2={height - padding.bottom}
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />

            {/* X Axis Labels */}
            {[-50, 0, 50].map((s) => (
              <text
                key={s}
                x={mapX(s)}
                y={height - 10}
                fill="#64748b"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {s > 0 ? `+${s}` : s}
              </text>
            ))}
            <text
              x={(width + padding.left) / 2}
              y={height - 2}
              fill="#94a3b8"
              fontSize="8"
              textAnchor="middle"
            >
              ストローク (mm)
            </text>

            {/* Curve Line */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              points={pointsStr}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Current Active Dot */}
            {!isNaN(currentY) && currentY >= padding.top && currentY <= height - padding.bottom && (
              <g>
                <circle
                  cx={currentX}
                  cy={currentY}
                  r="6"
                  fill={color}
                  opacity="0.25"
                />
                <circle
                  cx={currentX}
                  cy={currentY}
                  r="3.5"
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 text-white text-[9px] px-2 py-0.5 rounded">
            クリックで拡大表示
          </div>
        </div>
      </div>
    );
  };

  // Compute exact min/max bounds for each graph to ensure high-resolution viewing
  const cambers = data.map((d) => d.camber);
  const camberMin = Math.min(...cambers) - 0.5;
  const camberMax = Math.max(...cambers) + 0.5;

  const rcs = data.map((d) => d.rollCenterHeight);
  const rcMin = Math.min(...rcs) - 10;
  const rcMax = Math.max(...rcs) + 10;

  const tracks = data.map((d) => d.trackWidthChange);
  const trackMin = Math.min(...tracks) - 2;
  const trackMax = Math.max(...tracks) + 2;

  const toes = data.map((d) => d.toe);
  const toeMin = Math.min(...toes) - 0.2;
  const toeMax = Math.max(...toes) + 0.2;

  // Active current values
  const currentResult = solveRightSideLocal(currentStroke, specs, staticState);

  return (
    <>
      <div id="suspension-kinematics-charts" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {renderSvgChart(
          'キャンバー変化特性',
          '°',
          (d) => d.camber,
          '#0284c7', // sky-600
          camberMin,
          camberMax,
          currentResult.camber
        )}
        {renderSvgChart(
          'ロールセンター高さ変化',
          'mm',
          (d) => d.rollCenterHeight,
          '#16a34a', // green-600
          rcMin,
          rcMax,
          currentResult.rollCenter ? currentResult.rollCenter.y : 0
        )}
        {renderSvgChart(
          'トレッド幅変化量',
          'mm',
          (d) => d.trackWidthChange,
          '#dc2626', // rose-600
          trackMin,
          trackMax,
          currentResult.trackWidthChange
        )}
        {renderSvgChart(
          'トー角変化 (バンプステア)',
          '°',
          (d) => d.toe,
          '#d97706', // amber-600
          toeMin,
          toeMax,
          currentResult.toe + (0.01 * currentStroke)
        )}
      </div>

      {/* Interactive Expanded Modal */}
      {expandedChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-150 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{expandedChart.title} (拡大ビュー)</h3>
                <p className="text-[11px] text-slate-500">マウスドラッグまたはタッチスワイプで位置調整、ホイール/ボタンで拡大縮小</p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with SVG Interactive Box */}
            <div className="relative flex-1 bg-slate-50 min-h-[300px] overflow-hidden select-none cursor-grab active:cursor-grabbing">
              <svg
                viewBox="0 0 640 360"
                className="w-full h-full min-h-[350px] max-h-[60vh]"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
              >
                {/* SVG Content Group applying ZOOM and PAN */}
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Gridlines */}
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const tick = expandedChart.yMin + (idx * (expandedChart.yMax - expandedChart.yMin)) / 8;
                    const yVal = 310 - (idx * 260) / 8;
                    return (
                      <g key={idx}>
                        <line
                          x1="80"
                          y1={yVal}
                          x2="580"
                          y2={yVal}
                          stroke="#e2e8f0"
                          strokeWidth={1 / zoom}
                          strokeDasharray="2,4"
                        />
                        <text
                          x="70"
                          y={yVal + 4}
                          fill="#475569"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="end"
                        >
                          {tick.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Horizontal zero reference if spans positive/negative */}
                  {expandedChart.yMin < 0 && expandedChart.yMax > 0 && (
                    <line
                      x1="80"
                      y1={310 - ((0 - expandedChart.yMin) * 260) / (expandedChart.yMax - expandedChart.yMin)}
                      x2="580"
                      y2={310 - ((0 - expandedChart.yMin) * 260) / (expandedChart.yMax - expandedChart.yMin)}
                      stroke="#94a3b8"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4,2"
                    />
                  )}

                  {/* Vertical zero reference line (stroke = 0) */}
                  <line
                    x1="330"
                    y1="50"
                    x2="330"
                    y2="310"
                    stroke="#cbd5e1"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray="3,3"
                  />

                  {/* X Axis labels */}
                  {[-50, -25, 0, 25, 50].map((s) => {
                    const xVal = 330 + (s * 250) / 50;
                    return (
                      <g key={s}>
                        <text
                          x={xVal}
                          y="325"
                          fill="#475569"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {s > 0 ? `+${s}` : s}
                        </text>
                        <line
                          x1={xVal}
                          y1="310"
                          x2={xVal}
                          y2="314"
                          stroke="#cbd5e1"
                          strokeWidth={1 / zoom}
                        />
                      </g>
                    );
                  })}
                  <text
                    x="330"
                    y="345"
                    fill="#475569"
                    fontSize="10"
                    textAnchor="middle"
                    fontWeight="semibold"
                  >
                    サスペンションストローク (mm)
                  </text>

                  {/* Y Axis title */}
                  <text
                    x="30"
                    y="40"
                    fill="#475569"
                    fontSize="10"
                    fontWeight="semibold"
                  >
                    値 ({expandedChart.yLabel})
                  </text>

                  {/* Plot line */}
                  {(() => {
                    const mapModalX = (stroke: number) => {
                      return 330 + (stroke * 250) / 50;
                    };
                    const mapModalY = (val: number) => {
                      const range = expandedChart.yMax - expandedChart.yMin;
                      const pct = (val - expandedChart.yMin) / (range || 1);
                      return 310 - pct * 260;
                    };

                    const modalPointsStr = data
                      .map((d) => `${mapModalX(d.stroke)},${mapModalY(expandedChart.getValue(d))}`)
                      .join(' ');

                    const currentModalX = mapModalX(currentStroke);
                    const currentModalY = mapModalY(expandedChart.currentVal);

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke={expandedChart.color}
                          strokeWidth={3 / zoom}
                          points={modalPointsStr}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Current Dot */}
                        {!isNaN(currentModalY) && currentModalY >= 50 && currentModalY <= 310 && (
                          <g>
                            <circle
                              cx={currentModalX}
                              cy={currentModalY}
                              r={8 / zoom}
                              fill={expandedChart.color}
                              opacity="0.3"
                            />
                            <circle
                              cx={currentModalX}
                              cy={currentModalY}
                              r={4.5 / zoom}
                              fill="#ffffff"
                              stroke={expandedChart.color}
                              strokeWidth={2.5 / zoom}
                            />
                          </g>
                        )}
                      </>
                    );
                  })()}
                </g>
              </svg>

              {/* Map controls overlay inside body */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                <div className="flex items-center gap-1.5 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm pointer-events-auto text-xs text-slate-500 font-medium">
                  <Move className="w-3.5 h-3.5" />
                  <span>位置調整 (ドラッグ/スワイプ)</span>
                </div>

                <div className="flex items-center gap-1 bg-white/95 border border-slate-200 p-1 rounded-xl shadow-sm pointer-events-auto">
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    title="拡大"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    title="縮小"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    title="位置・ズームリセット"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-600 px-2 min-w-[40px] text-center">
                    {(zoom * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-150 bg-slate-50 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: expandedChart.color }} />
                <span className="text-slate-600 font-medium">現在ストローク({currentStroke}mm)値: </span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {expandedChart.currentVal.toFixed(3)} {expandedChart.yLabel}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition shadow-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


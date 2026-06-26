/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SuspensionSpecs, SuspensionState, SuspensionPreset } from './types';
import {
  solveFullSuspension,
  reconstructStaticHardpoints,
  PRESETS,
} from './suspensionSolver';
import { SuspensionVisualizer } from './components/SuspensionVisualizer';
import { KinematicsCharts } from './components/KinematicsCharts';
import {
  Settings,
  RotateCcw,
  BookOpen,
  Sliders,
  Download,
  Upload,
  Info,
  Car,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function App() {
  // Suspension Tab
  const [activeTab, setActiveTab] = useState<'front' | 'rear'>('front');

  // Suspension Specs State
  const [frontSpecs, setFrontSpecs] = useState<SuspensionSpecs>(PRESETS.sports);
  const [rearSpecs, setRearSpecs] = useState<SuspensionSpecs>({
    ...PRESETS.sports,
    // Rear typically has different caster/KPI/steering
    casterStatic: 0.0, // Multi-link rear caster is usually zero or low
    kpi: 5.0,
    toeStatic: 0.15, // Rear toe-in is common for stability
  });

  // Current simulation states
  const [stroke, setStroke] = useState<number>(0); // mm
  const [rollAngle, setRollAngle] = useState<number>(0); // degrees
  const [steerAngle, setSteerAngle] = useState<number>(0); // degrees

  // Local storage save/load helpers
  const saveToLocalStorage = () => {
    localStorage.setItem(
      'suspension_simulator_specs_v1',
      JSON.stringify({ front: frontSpecs, rear: rearSpecs })
    );
    alert('サスペンションの設計データをブラウザに保存しました！');
  };

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('suspension_simulator_specs_v1');
    if (saved) {
      try {
        const { front, rear } = JSON.parse(saved);
        if (front) setFrontSpecs(front);
        if (rear) setRearSpecs(rear);
        alert('保存された設計データをロードしました！');
      } catch (e) {
        alert('データのロードに失敗しました。');
      }
    } else {
      alert('保存されたデータが見つかりません。');
    }
  };

  const exportAsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ front: frontSpecs, rear: rearSpecs, metadata: { timestamp: new Date().toISOString() } }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `suspension_design_${activeTab}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.front) setFrontSpecs(parsed.front);
          if (parsed.rear) setRearSpecs(parsed.rear);
          alert('JSONファイルから設計データを復元しました！');
        } catch (err) {
          alert('ファイルのパースに失敗しました。正しいJSON形式であることを確認してください。');
        }
      };
    }
  };

  // Preset Applier
  const applyPreset = (presetKey: SuspensionPreset) => {
    const basePreset = PRESETS[presetKey];
    if (activeTab === 'front') {
      setFrontSpecs(basePreset);
    } else {
      setRearSpecs({
        ...basePreset,
        casterStatic: presetKey === 'formula' ? 3.0 : 0.0, // realistic rear
        toeStatic: 0.15,
      });
    }
  };

  // Reset to default
  const resetToDefault = () => {
    if (activeTab === 'front') {
      setFrontSpecs(PRESETS.sports);
    } else {
      setRearSpecs({
        ...PRESETS.sports,
        casterStatic: 0.0,
        kpi: 5.0,
        toeStatic: 0.15,
      });
    }
    setStroke(0);
    setRollAngle(0);
    setSteerAngle(0);
  };

  // Get active variables based on active tab
  const activeSpecs = activeTab === 'front' ? frontSpecs : rearSpecs;
  const setActiveSpecs = activeTab === 'front' ? setFrontSpecs : setRearSpecs;

  // Reconstruct static hardpoints
  const staticState = reconstructStaticHardpoints(activeSpecs);

  // Solve full suspension geometry
  const solved = solveFullSuspension(activeSpecs, stroke, rollAngle, steerAngle);

  // Helper to safely update a specific specification
  const updateSpec = (key: keyof SuspensionSpecs, val: number) => {
    setActiveSpecs((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  return (
    <div id="root-container" className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-sky-500/30">
      
      {/* Premium Ambient Background Accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Header */}
      <header id="main-header" className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-sky-50 p-2 rounded-xl border border-sky-100">
              <Car className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                サスペンション諸元シミュレーター
                <span className="text-[10px] bg-sky-50 text-sky-600 font-semibold px-2 py-0.5 rounded-full border border-sky-100">
                  Double Wishbone
                </span>
              </h1>
              <p className="text-[11px] text-slate-500">
                幾何学的な挙動とアライメント変化をリアルタイム可視化
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-btn"
              onClick={exportAsJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-xs transition"
              title="設計データをJSONとして保存"
            >
              <Download className="w-3.5 h-3.5" />
              エクスポート
            </button>
            <label
              id="import-label"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
              title="JSONファイルを読み込んで設計を復元"
            >
              <Upload className="w-3.5 h-3.5" />
              インポート
              <input
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="hidden"
              />
            </label>
            <button
              id="save-local-btn"
              onClick={saveToLocalStorage}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              ブラウザ保存
            </button>
            <button
              id="load-local-btn"
              onClick={loadFromLocalStorage}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 shadow-xs transition"
            >
              ロード
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* Navigation & Presets Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="tab-front"
              onClick={() => {
                setActiveTab('front');
                setSteerAngle(0); // reset steer
              }}
              className={`px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
                activeTab === 'front'
                  ? 'bg-white text-sky-600 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              フロントサスペンション (Front)
            </button>
            <button
              id="tab-rear"
              onClick={() => {
                setActiveTab('rear');
                setSteerAngle(0); // rear typically doesn't steer unless 4WS is modeled
              }}
              className={`px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
                activeTab === 'rear'
                  ? 'bg-white text-sky-600 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              リヤサスペンション (Rear)
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold mr-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              設計プリセット:
            </span>
            {(['sports', 'formula', 'sedan', 'suv'] as SuspensionPreset[]).map((pkey) => (
              <button
                key={pkey}
                id={`preset-${pkey}`}
                onClick={() => applyPreset(pkey)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-xs font-medium transition shadow-xs"
              >
                {pkey === 'sports' && 'スポーツカー'}
                {pkey === 'formula' && 'フォーミュラ'}
                {pkey === 'sedan' && 'セダン'}
                {pkey === 'suv' && 'SUV/オフロード'}
              </button>
            ))}
            <button
              id="reset-btn"
              onClick={resetToDefault}
              className="p-1.5 bg-white hover:bg-slate-50 text-rose-500 border border-slate-200 hover:border-rose-400 rounded-lg transition shadow-xs"
              title="初期設定に戻す"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div id="dashboard-grid" className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Sidebar / Parameters Inputs (Left Panel - 4/12 cols) */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            
            {/* Dynamic Controls / Simulators */}
            <div id="simulation-panel" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative text-slate-800">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Sliders className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  挙動シミュレーター (動的変化)
                </h3>
              </div>

              <div className="space-y-4">
                {/* Stroke Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      サスペンション・ストローク
                      <span className="text-[10px] text-slate-400 font-mono">(-50 〜 +50mm)</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-600">
                      {stroke > 0 ? `+${stroke}` : stroke} mm
                    </span>
                  </div>
                  <input
                    id="stroke-slider"
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={stroke}
                    onChange={(e) => setStroke(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                    <span>伸び (Rebound)</span>
                    <span className="cursor-pointer hover:text-slate-600 font-semibold" onClick={() => setStroke(0)}>static (0)</span>
                    <span>縮み (Bump)</span>
                  </div>
                </div>

                {/* Roll Angle Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      車体ロール角
                      <span className="text-[10px] text-slate-400 font-mono">(-5 〜 +5°)</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      {rollAngle > 0 ? `+${rollAngle}` : rollAngle}°
                    </span>
                  </div>
                  <input
                    id="roll-slider"
                    type="range"
                    min="-5"
                    max="5"
                    step="0.1"
                    value={rollAngle}
                    onChange={(e) => setRollAngle(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                    <span>左ロール</span>
                    <span className="cursor-pointer hover:text-slate-600 font-semibold" onClick={() => setRollAngle(0)}>水平 (0)</span>
                    <span>右ロール</span>
                  </div>
                </div>

                {/* Steering Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      転舵ステアリング角
                      <span className="text-[10px] text-slate-400 font-mono">(-30 〜 +30°)</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-600">
                      {steerAngle > 0 ? `+${steerAngle}` : steerAngle}°
                    </span>
                  </div>
                  <input
                    id="steer-slider"
                    type="range"
                    min="-30"
                    max="30"
                    step="1"
                    value={steerAngle}
                    onChange={(e) => setSteerAngle(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                    <span>左転舵</span>
                    <span className="cursor-pointer hover:text-slate-600 font-semibold" onClick={() => setSteerAngle(0)}>直進 (0)</span>
                    <span>右転舵</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Design Parameters Input Sections */}
            <div id="parameter-editor-card" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 text-slate-800">
              
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Settings className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  アライメント / ジオメトリ諸元設定
                </h3>
              </div>

              {/* SECTION A: Alignment specs */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  1. 静的アライメント設定
                </h4>

                {/* Camber */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 flex items-center gap-1 font-semibold">
                      静的キャンバー角
                      <InfoIcon text="直進状態でのホイールの傾き。ネガティブキャンバーはコーナリング時のグリップを高めます。" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="-15"
                        max="15"
                        step="0.1"
                        value={activeSpecs.camberStatic}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateSpec('camberStatic', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">°</span>
                    </div>
                  </div>
                  <input
                    id="slider-camber"
                    type="range"
                    min="-15"
                    max="15"
                    step="0.1"
                    value={activeSpecs.camberStatic}
                    onChange={(e) => updateSpec('camberStatic', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                </div>

                {/* Caster */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 flex items-center gap-1 font-semibold">
                      静的キャスター角
                      <InfoIcon text="横方向から見たキングピン軸の傾き。直進安定性とステアリング復元力を高めます。" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="-15"
                        max="25"
                        step="0.1"
                        value={activeSpecs.casterStatic}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateSpec('casterStatic', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">°</span>
                    </div>
                  </div>
                  <input
                    id="slider-caster"
                    type="range"
                    min="-15"
                    max="25"
                    step="0.1"
                    value={activeSpecs.casterStatic}
                    onChange={(e) => updateSpec('casterStatic', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                </div>

                {/* Toe */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 flex items-center gap-1 font-semibold">
                      静的トー角
                      <InfoIcon text="上から見た左右車輪の角度。トーインは直進安定性を、トーアウトは初期応答性を良くします。" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="-5"
                        max="5"
                        step="0.01"
                        value={activeSpecs.toeStatic}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateSpec('toeStatic', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">°</span>
                    </div>
                  </div>
                  <input
                    id="slider-toe"
                    type="range"
                    min="-5"
                    max="5"
                    step="0.01"
                    value={activeSpecs.toeStatic}
                    onChange={(e) => updateSpec('toeStatic', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                </div>
              </div>

              {/* SECTION B: Chassis Mounting positions & Geometry */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  2. リンク・ナックル幾何学設定
                </h4>

                {/* KPI */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 flex items-center gap-1 font-semibold">
                      キングピン傾角 (KPI)
                      <InfoIcon text="正面から見たキングピン軸の傾き。スクラブ半径を適正化し操舵フィールを向上させます。" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="-10"
                        max="30"
                        step="0.5"
                        value={activeSpecs.kpi}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateSpec('kpi', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">°</span>
                    </div>
                  </div>
                  <input
                    id="slider-kpi"
                    type="range"
                    min="-10"
                    max="30"
                    step="0.5"
                    value={activeSpecs.kpi}
                    onChange={(e) => updateSpec('kpi', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Track Width */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 font-semibold">トレッド幅 (左右車輪間隔)</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="800"
                        max="2400"
                        step="10"
                        value={activeSpecs.trackWidth}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateSpec('trackWidth', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">mm</span>
                    </div>
                  </div>
                  <input
                    id="slider-track-width"
                    type="range"
                    min="800"
                    max="2400"
                    step="10"
                    value={activeSpecs.trackWidth}
                    onChange={(e) => updateSpec('trackWidth', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Tire Diameter */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 font-semibold">タイヤ外径</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="300"
                        max="1000"
                        step="10"
                        value={activeSpecs.tireDiameter}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateSpec('tireDiameter', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">mm</span>
                    </div>
                  </div>
                  <input
                    id="slider-tire-diameter"
                    type="range"
                    min="300"
                    max="1000"
                    step="10"
                    value={activeSpecs.tireDiameter}
                    onChange={(e) => updateSpec('tireDiameter', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Upper Arm Inner Y Height */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 font-semibold">アッパーアーム内側高さ (車体)</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="200"
                        max="1000"
                        step="5"
                        value={activeSpecs.upperArmInnerY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateSpec('upperArmInnerY', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">mm</span>
                    </div>
                  </div>
                  <input
                    id="slider-upper-inner-y"
                    type="range"
                    min="200"
                    max="1000"
                    step="5"
                    value={activeSpecs.upperArmInnerY}
                    onChange={(e) => updateSpec('upperArmInnerY', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Lower Arm Inner Y Height */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 font-semibold">ロアアーム内側高さ (車体)</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="600"
                        step="5"
                        value={activeSpecs.lowerArmInnerY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateSpec('lowerArmInnerY', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">mm</span>
                    </div>
                  </div>
                  <input
                    id="slider-lower-inner-y"
                    type="range"
                    min="0"
                    max="600"
                    step="5"
                    value={activeSpecs.lowerArmInnerY}
                    onChange={(e) => updateSpec('lowerArmInnerY', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Lower Arm Inner X Pivot offset */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 font-semibold">ロアアーム内側X位置 (オフセット)</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="50"
                        max="800"
                        step="5"
                        value={activeSpecs.lowerArmInnerX}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateSpec('lowerArmInnerX', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">mm</span>
                    </div>
                  </div>
                  <input
                    id="slider-lower-inner-x"
                    type="range"
                    min="50"
                    max="800"
                    step="5"
                    value={activeSpecs.lowerArmInnerX}
                    onChange={(e) => updateSpec('lowerArmInnerX', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Hub Offset / spindle width */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-600 font-semibold">ハブオフセット (ナックル〜中心)</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="250"
                        step="2"
                        value={activeSpecs.hubOffset}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateSpec('hubOffset', val);
                        }}
                        className="w-16 text-right font-mono font-bold text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      <span className="font-semibold text-slate-500 text-[11px]">mm</span>
                    </div>
                  </div>
                  <input
                    id="slider-hub-offset"
                    type="range"
                    min="0"
                    max="250"
                    step="2"
                    value={activeSpecs.hubOffset}
                    onChange={(e) => updateSpec('hubOffset', Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>
              </div>

              {/* Dynamic computed linkages layout statistics */}
              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  現在アセンブリの設計値 (自動計算)
                </span>
                <div className="grid grid-cols-2 gap-3 text-slate-600 font-mono">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">ロアアーム長さ</div>
                    <div className="text-slate-800 font-bold mt-0.5">{staticState.lowerArmLength.toFixed(1)} mm</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">アッパーアーム長さ</div>
                    <div className="text-slate-800 font-bold mt-0.5">{staticState.upperArmLength.toFixed(1)} mm</div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Right Panel / Vector Sandbox (8/12 cols) */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            
            {/* Main Multi-view graphic block */}
            <div className="flex-1">
              <SuspensionVisualizer
                specs={activeSpecs}
                left={solved.left}
                right={solved.right}
                rollCenterHeight={solved.rollCenterHeight}
                stroke={stroke}
                rollAngle={rollAngle}
                steerAngle={steerAngle}
                isRear={activeTab === 'rear'}
                onChangeStroke={setStroke}
              />
            </div>

            {/* Quick engineering insights / guidelines */}
            <div id="engineering-insights" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  サスペンション幾何学の重要項目解説
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                    ロールセンター (RC) の変化
                  </div>
                  <p className="leading-relaxed text-slate-500 text-[11px]">
                    アッパーとロアアームの延長線の交点（瞬時中心）とタイヤ接地面を結ぶ線が、車両中心線と交わる点です。ロールセンターの高さは、コーナリング時のロール量やサスペンションの応答性に直結します。
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    キャンバー角の変化 (Camber Gain)
                  </div>
                  <p className="leading-relaxed text-slate-500 text-[11px]">
                    ストロークに伴いアッパーアームがロアアームより短い場合、車輪は縮み（バンプ）側で自動的にネガティブ側に傾きます。これにより、ロール時のタイヤと地面の接地面積を最大限に確保できます。
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Dynamic behavior charts section */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              運動学的特性グラフ (ストローク変化カーブ)
            </h3>
          </div>
          <KinematicsCharts
            specs={activeSpecs}
            staticState={staticState}
            currentStroke={stroke}
          />
        </div>

      </main>

      {/* Humble platform credits footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500 font-medium">
        <p>© 2026 サスペンション諸元シミュレーター | ダブルウィッシュボーン設計支援ツール</p>
      </footer>

    </div>
  );
}

// Inline helper for neat educational tooltips
const InfoIcon: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span className="relative group cursor-pointer inline-flex items-center">
      <Info className="w-3.5 h-3.5 text-slate-400 hover:text-sky-600 transition ml-1" />
      <span className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-white text-slate-700 text-[10px] p-2 rounded-lg border border-slate-200 shadow-md leading-relaxed z-50">
        {text}
      </span>
    </span>
  );
};

/**
 * RealMindMap.tsx
 * Professional, clean mind map with proper layout, zoom, and fullscreen.
 */
import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Sparkles } from "lucide-react";

type Branch = { label: string; notes?: string; subBranches?: string[]; };
type MindMapData = { title: string; branches: Branch[]; };

const BRANCH_COLORS = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", line: "#3b82f6" },
  { bg: "#dcfce7", border: "#22c55e", text: "#166534", line: "#22c55e" },
  { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8", line: "#a855f7" },
  { bg: "#fff7ed", border: "#f97316", text: "#9a3412", line: "#f97316" },
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d", line: "#ec4899" },
];

const SVG_W = 1400;
const SVG_H = 860;
const CX = SVG_W / 2;
const CY = 100;
const BRANCH_Y = 290;
const SUB_Y = 510;

export default function RealMindMap({ data }: { data: MindMapData }) {
  const branches = (data?.branches ?? []).slice(0, 5);
  const [zoom, setZoom] = useState(0.68);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const count = branches.length;
  // Spacing based on count so it never overlaps
  const spacing = Math.min(270, (SVG_W - 120) / Math.max(count, 1));
  const startX = CX - ((count - 1) / 2) * spacing;

  return (
    <div ref={containerRef} className={fullscreen ? "fixed inset-0 z-[9999] bg-white flex flex-col p-4" : "flex flex-col w-full"}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-2">
        <span className="text-xs font-bold text-slate-400">{Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-1.5">
          <ToolBtn onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} title="Zoom out"><ZoomOut className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => setZoom(0.68)} title="Reset"><RotateCcw className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => setZoom(z => Math.min(z + 0.1, 1.4))} title="Zoom in"><ZoomIn className="h-4 w-4" /></ToolBtn>
          <ToolBtn primary onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="text-xs font-semibold ml-1 hidden sm:inline">{fullscreen ? "Exit" : "Fullscreen"}</span>
          </ToolBtn>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-inner flex-1 min-h-[380px]">
        <div style={{ width: SVG_W * zoom, height: SVG_H * zoom, minWidth: "100%", position: "relative" }}>
          <svg
            width={SVG_W}
            height={SVG_H}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}
          >
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12" />
              </filter>
            </defs>

            {/* ── Connector lines ── */}
            {branches.map((branch, i) => {
              const bx = startX + i * spacing;
              const c = BRANCH_COLORS[i % BRANCH_COLORS.length];
              const subs = (branch.subBranches ?? []).slice(0, 4);
              const subSpacing = Math.min(110, (spacing - 20) / Math.max(subs.length, 1));
              const subStart = bx - ((subs.length - 1) / 2) * subSpacing;

              return (
                <g key={i}>
                  {/* Root → branch curved line */}
                  <path
                    d={`M ${CX} ${CY + 44} C ${CX} ${CY + 120}, ${bx} ${BRANCH_Y - 80}, ${bx} ${BRANCH_Y - 34}`}
                    fill="none" stroke={c.line} strokeWidth="2.5" strokeLinecap="round" opacity="0.75"
                  />
                  {/* Branch → sub-branches */}
                  {subs.map((_, j) => {
                    const sx = subStart + j * subSpacing;
                    return (
                      <path
                        key={j}
                        d={`M ${bx} ${BRANCH_Y + 70} C ${bx} ${BRANCH_Y + 110}, ${sx} ${SUB_Y - 30}, ${sx} ${SUB_Y - 16}`}
                        fill="none" stroke={c.line} strokeWidth="1.8" strokeLinecap="round" opacity="0.55"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* ── Root node ── */}
            <g>
              <rect
                x={CX - 155} y={CY - 44} width={310} height={88} rx={22}
                fill="url(#rootGrad)" filter="url(#shadow)"
              />
              <defs>
                <linearGradient id="rootGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <text x={CX} y={CY - 6} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="800" fill="white" letterSpacing="-0.5">
                {(data?.title ?? "Mind Map").length > 28 ? (data?.title ?? "").substring(0, 26) + "…" : (data?.title ?? "Mind Map")}
              </text>
              <text x={CX} y={CY + 20} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.75)" fontWeight="500">
                AI-generated study map
              </text>
            </g>

            {/* ── Branch nodes ── */}
            {branches.map((branch, i) => {
              const c = BRANCH_COLORS[i % BRANCH_COLORS.length];
              const bx = startX + i * spacing;
              const subs = (branch.subBranches ?? []).slice(0, 4);
              const subSpacing = Math.min(110, (spacing - 20) / Math.max(subs.length, 1));
              const subStart = bx - ((subs.length - 1) / 2) * subSpacing;
              const branchW = 170, branchH = 104;

              return (
                <g key={i}>
                  {/* Branch card */}
                  <rect
                    x={bx - branchW/2} y={BRANCH_Y - branchH/2} width={branchW} height={branchH} rx={14}
                    fill={c.bg} stroke={c.border} strokeWidth="2.5" filter="url(#shadow)"
                  />
                  <text x={bx} y={BRANCH_Y - 14} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={c.text}>
                    {branch.label.length > 18 ? branch.label.substring(0, 16) + "…" : branch.label}
                  </text>
                  {branch.notes && (
                    <text x={bx} y={BRANCH_Y + 14} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill="#64748b" fontStyle="italic">
                      {branch.notes.length > 26 ? branch.notes.substring(0, 24) + "…" : branch.notes}
                    </text>
                  )}

                  {/* Key Points badge */}
                  {subs.length > 0 && (
                    <g>
                      <rect x={bx - 52} y={BRANCH_Y + branchH/2 + 4} width={104} height={26} rx="8" fill={c.bg} stroke={c.border} strokeWidth="1.5" />
                      <text x={bx} y={BRANCH_Y + branchH/2 + 17} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={c.text} fontWeight="700">
                        ✦ Key Points
                      </text>
                    </g>
                  )}

                  {/* Sub-branches */}
                  {subs.map((sub, j) => {
                    const sx = subStart + j * subSpacing;
                    const sw = Math.min(subSpacing - 8, 96), sh = 36;
                    return (
                      <g key={j}>
                        <rect x={sx - sw/2} y={SUB_Y - sh/2} width={sw} height={sh} rx={8} fill="white" stroke={c.border} strokeWidth="1.8" filter="url(#shadow)" />
                        <text x={sx} y={SUB_Y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill={c.text}>
                          {sub.length > 13 ? sub.substring(0, 11) + "…" : sub}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Bottom label */}
            <text x={CX} y={SVG_H - 18} textAnchor="middle" fontSize="10" fill="#cbd5e1">
              AI-generated mind map • scroll or zoom to explore
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ onClick, title, children, primary = false }: {
  onClick: () => void; title: string; children: React.ReactNode; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        primary ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * ImageGenerator.tsx — Theory to Visual v4 (3D Animated Diagrams)
 *
 * All diagrams rendered as HTML+CSS with:
 *  • CSS 3D perspective transforms (rotateX, translateZ, perspective)
 *  • Smooth entrance animations (fade-up, scale-in, slide-in)
 *  • Hover lift effects with depth shadows
 *  • Animated connectors (draw-on stroke-dashoffset)
 *  • Floating/pulse animations on key nodes
 *  • Glass-morphism panels with backdrop-filter
 *  • Rich gradients, glows, and shadows
 */
import React, { useState, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Download, Loader2, BookOpen, RefreshCw, Maximize2, Minimize2, FileImage } from "lucide-react";
import { callAI } from "@/lib/aiClient";

// ── Diagram types ─────────────────────────────────────────────────────────────
const DIAGRAM_TYPES = [
  { value: "flowchart",  label: "🔀 Flowchart",     hint: "Processes, algorithms, decision trees" },
  { value: "mindmap",    label: "🧠 Mind Map",       hint: "Concepts with multiple sub-topics" },
  { value: "timeline",   label: "📅 Timeline",       hint: "Historical events, project phases" },
  { value: "cycle",      label: "🔄 Cycle Diagram",  hint: "Repeating processes (water cycle etc.)" },
  { value: "hierarchy",  label: "🏗️ Hierarchy",     hint: "Org charts, classification systems" },
  { value: "comparison", label: "⚖️ Comparison",    hint: "Compare options, approaches, features" },
];

// ── Palette ───────────────────────────────────────────────────────────────────
const PAL = [
  { from:"#6366f1", to:"#8b5cf6", text:"#fff", shadow:"rgba(99,102,241,0.45)", border:"#818cf8" },
  { from:"#10b981", to:"#059669", text:"#fff", shadow:"rgba(16,185,129,0.45)", border:"#34d399" },
  { from:"#f59e0b", to:"#d97706", text:"#fff", shadow:"rgba(245,158,11,0.45)", border:"#fbbf24" },
  { from:"#ec4899", to:"#db2777", text:"#fff", shadow:"rgba(236,72,153,0.45)", border:"#f472b6" },
  { from:"#3b82f6", to:"#2563eb", text:"#fff", shadow:"rgba(59,130,246,0.45)", border:"#60a5fa" },
  { from:"#14b8a6", to:"#0d9488", text:"#fff", shadow:"rgba(20,184,166,0.45)", border:"#2dd4bf" },
  { from:"#a855f7", to:"#9333ea", text:"#fff", shadow:"rgba(168,85,247,0.45)", border:"#c084fc" },
];

// Diagram animations defined in index.css

// ── Shared wrapper ────────────────────────────────────────────────────────────
function wrap3D(content: string, minH = 520): string {
  return `<div style="font-family:'Segoe UI',system-ui,sans-serif;min-height:${minH}px;
    background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);
    border-radius:20px;padding:32px;overflow:hidden;position:relative;">
    <!-- decorative bg orbs -->
    <div style="position:absolute;top:-80px;left:-80px;width:300px;height:300px;
      border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.18),transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;right:-60px;width:260px;height:260px;
      border-radius:50%;background:radial-gradient(circle,rgba(168,85,247,0.16),transparent 70%);pointer-events:none;"></div>
    ${content}
  </div>`;
}

// ── FLOWCHART ─────────────────────────────────────────────────────────────────
function makeFlowchart(nodes: {id:string;label:string;type?:string}[], edges: {from:string;to:string;label?:string}[]): string {
  // Simple top-down layout: BFS layers
  const inDeg = new Map<string,number>();
  nodes.forEach(n => inDeg.set(n.id, 0));
  edges.forEach(e => inDeg.set(e.to, (inDeg.get(e.to)??0)+1));
  const layers: string[][] = [];
  const visited = new Set<string>();
  const q = nodes.filter(n => !inDeg.get(n.id)).map(n => n.id);
  if (!q.length && nodes.length) q.push(nodes[0].id);
  while (q.length) {
    const layer = [...new Set(q.splice(0))].filter(id => !visited.has(id));
    if (!layer.length) break;
    layers.push(layer); layer.forEach(id => { visited.add(id); edges.filter(e=>e.from===id).forEach(e=>{ if(!visited.has(e.to)) q.push(e.to); }); });
  }
  nodes.forEach(n => { if (!visited.has(n.id)) { layers.push([n.id]); visited.add(n.id); }});

  const nodeMap = new Map(nodes.map(n=>[n.id,n]));
  const nodeIdx = new Map(nodes.map((n,i)=>[n.id,i]));
  const ITEM_W = 200, GAP_X = 28, GAP_Y = 90;

  let html = `<div class="diagram-scene" style="position:relative;">`;

  // Render layers
  layers.forEach((layer, li) => {
    const totalW = layer.length * ITEM_W + (layer.length-1) * GAP_X;
    html += `<div style="display:flex;justify-content:center;gap:${GAP_X}px;margin-bottom:${li<layers.length-1?GAP_Y:0}px;position:relative;">`;
    layer.forEach((id, ji) => {
      const n = nodeMap.get(id)!;
      const i = nodeIdx.get(id)??ji;
      const p = PAL[i%PAL.length];
      const delay = (li*0.15 + ji*0.08).toFixed(2);
      const isStart = n.type==="start"||i===0;
      const isEnd = n.type==="end"||i===nodes.length-1;
      const isDec = n.type==="decision";
      const borderR = isStart||isEnd ? "50px" : isDec ? "12px" : "16px";
      const rotStyle = isDec ? "transform:rotate(0deg);" : "";
      const shape = isDec
        ? `<div style="width:${ITEM_W}px;height:56px;background:linear-gradient(135deg,${p.from},${p.to});clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);display:flex;align-items:center;justify-content:center;">
             <span style="color:white;font-size:11px;font-weight:700;text-align:center;max-width:120px;">${n.label}</span></div>`
        : `<div style="padding:14px 18px;background:linear-gradient(135deg,${p.from},${p.to});
             border-radius:${borderR};color:white;font-size:12px;font-weight:700;
             text-align:center;min-height:48px;display:flex;align-items:center;justify-content:center;
             --sh:${p.shadow};box-shadow:0 8px 24px ${p.shadow},0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.2);
             border:1px solid ${p.border};">${n.label}</div>`;

      html += `<div class="node-3d" style="animation:fadeUp 0.5s ${delay}s both ease;--sh:${p.shadow};
        filter:drop-shadow(0 4px 16px ${p.shadow});flex-shrink:0;width:${ITEM_W}px;">${shape}</div>`;

      // Arrow down to next layer (first edge from this node)
      if (li < layers.length-1) {
        const nextEdge = edges.find(e=>e.from===id);
        if (nextEdge) {
          html += `<div style="position:absolute;bottom:-${GAP_Y-4}px;left:50%;transform:translateX(-50%);
            width:2px;height:${GAP_Y-8}px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
            <div class="connector-line" style="flex:1;width:2px;background:linear-gradient(to bottom,${p.from},${p.to});
              animation-delay:${(parseFloat(delay)+0.3).toFixed(2)}s;"></div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
              border-top:10px solid ${p.to};margin-top:-1px;"></div>
            ${nextEdge.label ? `<span style="position:absolute;top:40%;background:rgba(255,255,255,0.12);
              color:white;font-size:9px;font-weight:700;padding:2px 6px;
              border-radius:6px;white-space:nowrap;">${nextEdge.label}</span>` : ""}
          </div>`;
        }
      }
    });
    html += `</div>`;
  });

  html += `</div>`;
  return wrap3D(html, 120 + layers.length * 130);
}

// ── MIND MAP ─────────────────────────────────────────────────────────────────
function makeMindMap(center: string, branches: {label:string;items?:string[]}[]): string {
  const count = Math.min(branches.length, 6);
  const R = 210; // px from center to branch in the grid approach

  let html = `<div style="position:relative;min-height:640px;display:flex;align-items:center;justify-content:center;">`;

  // Center orb — floating animation
  html += `<div class="node-3d" style="position:absolute;z-index:10;
    animation:diag-float 4s ease-in-out infinite,scaleIn 0.6s 0.1s both;
    width:140px;height:140px;border-radius:50%;
    background:linear-gradient(135deg,#6366f1,#a855f7,#ec4899);
    box-shadow:0 0 60px rgba(139,92,246,0.7),0 20px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.3);
    display:flex;align-items:center;justify-content:center;text-align:center;
    border:2px solid rgba(255,255,255,0.2);">
    <span style="color:white;font-size:13px;font-weight:800;padding:8px;line-height:1.3;">${center}</span>
  </div>`;

  // SVG for connector lines
  const svgSize = 640;
  const cx = svgSize/2, cy = svgSize/2;
  let svgLines = `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" viewBox="0 0 ${svgSize} ${svgSize}">`;

  branches.slice(0, count).forEach((branch, i) => {
    const angle = (2*Math.PI*i/count) - Math.PI/2;
    const bx = cx + Math.cos(angle)*R;
    const by = cy + Math.sin(angle)*R;
    const p = PAL[i%PAL.length];
    const delay = (0.3 + i*0.12).toFixed(2);

    // Animated bezier line
    const cp1x = cx + Math.cos(angle)*R*0.4, cp1y = cy + Math.sin(angle)*R*0.4;
    svgLines += `<path d="M${cx},${cy} Q${cp1x},${cp1y} ${bx},${by}"
      fill="none" stroke="${p.from}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"
      stroke-dasharray="300" stroke-dashoffset="300">
      <animate attributeName="stroke-dashoffset" from="300" to="0" dur="0.7s" begin="${delay}s" fill="freeze"/>
    </path>`;

    // Sub-item lines
    (branch.items??[]).slice(0,4).forEach((_, j) => {
      const spread = (branch.items??[]).length <= 1 ? 0 : (j - ((branch.items??[]).length-1)/2) * 0.5;
      const sa = angle + spread;
      const sx = cx + Math.cos(sa)*(R+140), sy = cy + Math.sin(sa)*(R+140);
      svgLines += `<line x1="${bx}" y1="${by}" x2="${sx}" y2="${sy}"
        stroke="${p.border}" stroke-width="1.5" opacity="0.4" stroke-dasharray="4,3">
        <animate attributeName="opacity" from="0" to="0.4" dur="0.4s" begin="${(parseFloat(delay)+0.4).toFixed(2)}s" fill="freeze"/>
      </line>`;
    });
  });
  svgLines += `</svg>`;
  html += svgLines;

  // Branch bubbles + sub-items
  branches.slice(0, count).forEach((branch, i) => {
    const angle = (2*Math.PI*i/count) - Math.PI/2;
    const bx = cx + Math.cos(angle)*R;
    const by = cy + Math.sin(angle)*R;
    const p = PAL[i%PAL.length];
    const delay = (0.3 + i*0.12).toFixed(2);
    const leftHalf = Math.cos(angle) < -0.1;

    html += `<div class="node-3d" style="position:absolute;
      left:calc(${(bx/svgSize)*100}% - 70px);top:calc(${(by/svgSize)*100}% - 28px);
      animation:diag-scaleIn 0.5s ${delay}s both;z-index:5;
      width:140px;min-height:56px;padding:10px 14px;
      background:linear-gradient(135deg,${p.from},${p.to});
      border-radius:16px;border:1px solid ${p.border};
      box-shadow:0 8px 32px ${p.shadow},0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.2);
      display:flex;align-items:center;justify-content:center;text-align:center;">
      <span style="color:white;font-size:11px;font-weight:700;line-height:1.3;">${branch.label}</span>
    </div>`;

    (branch.items??[]).slice(0,4).forEach((item, j) => {
      const items = (branch.items??[]).slice(0,4);
      const spread = items.length<=1 ? 0 : (j-(items.length-1)/2)*0.5;
      const sa = angle + spread;
      const sx = cx + Math.cos(sa)*(R+140), sy = cy + Math.sin(sa)*(R+140);
      const itemDelay = (parseFloat(delay)+0.35+j*0.07).toFixed(2);
      html += `<div class="node-3d" style="position:absolute;
        left:calc(${(sx/svgSize)*100}% - 52px);top:calc(${(sy/svgSize)*100}% - 18px);
        animation:diag-popIn 0.4s ${itemDelay}s both;z-index:4;
        width:104px;padding:6px 10px;
        background:rgba(30,30,60,0.7);
        border-radius:10px;border:1px solid ${p.border};
        display:flex;align-items:center;justify-content:center;text-align:center;">
        <span style="color:white;font-size:10px;font-weight:500;opacity:0.9;line-height:1.3;">${item}</span>
      </div>`;
    });
  });

  html += `</div>`;
  return wrap3D(html, 640);
}

// ── TIMELINE ─────────────────────────────────────────────────────────────────
function makeTimeline(events: {year:string;title:string;desc?:string}[]): string {
  let html = `<div style="position:relative;padding:0 16px;">
    <!-- Spine -->
    <div style="position:absolute;left:50%;transform:translateX(-50%);top:0;bottom:0;width:3px;
      background:linear-gradient(to bottom,#6366f1,#a855f7,#ec4899);
      border-radius:4px;opacity:0.7;"></div>`;

  events.forEach((ev, i) => {
    const isLeft = i%2===0;
    const p = PAL[i%PAL.length];
    const delay = (i*0.15).toFixed(2);
    const anim = isLeft ? "slideRight" : "slideLeft";

    html += `<div style="display:flex;align-items:center;margin-bottom:36px;position:relative;
      ${isLeft ? "flex-direction:row" : "flex-direction:row-reverse"};">

      <!-- Card -->
      <div class="node-3d" style="width:calc(50% - 40px);
        animation:${anim} 0.55s ${delay}s both;
        background:rgba(30,30,60,0.85);
        border-radius:18px;padding:18px 20px;
        border:1px solid ${p.border};
        box-shadow:0 8px 32px ${p.shadow},0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="background:linear-gradient(135deg,${p.from},${p.to});
            color:white;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;
            box-shadow:0 2px 8px ${p.shadow};">${ev.year}</span>
        </div>
        <p style="color:white;font-size:13px;font-weight:700;margin:0 0 4px;line-height:1.3;">${ev.title}</p>
        ${ev.desc ? `<p style="color:rgba(255,255,255,0.6);font-size:11px;margin:0;line-height:1.4;">${ev.desc}</p>` : ""}
      </div>

      <!-- Center dot -->
      <div style="width:80px;flex-shrink:0;display:flex;justify-content:center;z-index:2;
        animation:diag-scaleIn 0.4s ${(parseFloat(delay)+0.1).toFixed(2)}s both;">
        <div style="width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,${p.from},${p.to});
          box-shadow:0 0 20px ${p.shadow},0 4px 12px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.3);
          border:3px solid rgba(255,255,255,0.2);
          display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:13px;font-weight:900;">${i+1}</span>
        </div>
      </div>

      <!-- Spacer -->
      <div style="width:calc(50% - 40px);"></div>
    </div>`;
  });

  html += `</div>`;
  return wrap3D(html, 120 + events.length * 110);
}

// ── CYCLE ─────────────────────────────────────────────────────────────────────
function makeCycle(steps: {label:string;desc?:string}[]): string {
  const count = Math.min(steps.length, 6);
  const size = 580;
  const cx = size/2, cy = size/2, R = 200;

  let html = `<div style="position:relative;width:${size}px;height:${size}px;margin:0 auto;">`;

  // SVG arc connectors
  let svg = `<svg style="position:absolute;inset:0;pointer-events:none;" viewBox="0 0 ${size} ${size}">`;
  for (let i=0; i<count; i++) {
    const a1 = (2*Math.PI*i/count)-Math.PI/2;
    const a2 = (2*Math.PI*(i+1)/count)-Math.PI/2;
    const x1 = cx+Math.cos(a1)*R, y1 = cy+Math.sin(a1)*R;
    const x2 = cx+Math.cos(a2)*R, y2 = cy+Math.sin(a2)*R;
    const am = (a1+a2)/2;
    const cpx = cx+Math.cos(am)*(R+55), cpy = cy+Math.sin(am)*(R+55);
    const p = PAL[i%PAL.length];
    const delay = (0.3+i*0.15).toFixed(2);
    const pLen = 350;
    svg += `<path d="M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}" fill="none"
      stroke="${p.from}" stroke-width="3" stroke-linecap="round"
      marker-end="url(#arr${i})" opacity="0.85"
      stroke-dasharray="${pLen}" stroke-dashoffset="${pLen}">
      <animate attributeName="stroke-dashoffset" from="${pLen}" to="0" dur="0.6s" begin="${delay}s" fill="freeze"/>
    </path>
    <defs><marker id="arr${i}" markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto">
      <polygon points="0 0,8 3.5,0 7" fill="${p.from}"/>
    </marker></defs>`;
  }
  svg += `</svg>`;
  html += svg;

  // Center hub
  html += `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10;
    animation:diag-float 4s ease-in-out infinite,scaleIn 0.5s 0.1s both;
    width:100px;height:100px;border-radius:50%;
    background:linear-gradient(135deg,#6366f1,#a855f7);
    box-shadow:0 0 50px rgba(139,92,246,0.6),0 12px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.3);
    display:flex;align-items:center;justify-content:center;">
    <span style="color:white;font-size:11px;font-weight:800;text-align:center;">🔄 Cycle</span>
  </div>`;

  // Step nodes
  steps.slice(0, count).forEach((step, i) => {
    const angle = (2*Math.PI*i/count)-Math.PI/2;
    const nx = cx + Math.cos(angle)*R;
    const ny = cy + Math.sin(angle)*R;
    const p = PAL[i%PAL.length];
    const delay = (0.2+i*0.13).toFixed(2);
    html += `<div class="node-3d" style="position:absolute;
      left:${nx-72}px;top:${ny-36}px;width:144px;
      animation:diag-popIn 0.5s ${delay}s both;z-index:5;
      padding:12px 14px;border-radius:16px;text-align:center;
      background:linear-gradient(135deg,${p.from},${p.to});
      box-shadow:0 8px 28px ${p.shadow},0 2px 8px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.2);
      border:1px solid ${p.border};">
      <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.25);
        margin:0 auto 6px;display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:900;color:white;">${i+1}</div>
      <p style="color:white;font-size:11px;font-weight:700;margin:0 0 3px;line-height:1.3;">${step.label}</p>
      ${step.desc ? `<p style="color:rgba(255,255,255,0.7);font-size:9px;margin:0;line-height:1.3;">${step.desc}</p>` : ""}
    </div>`;
  });

  html += `</div>`;
  return wrap3D(html, 640);
}

// ── HIERARCHY ─────────────────────────────────────────────────────────────────
function makeHierarchy(root: string, children: {label:string;children?:string[]}[]): string {
  const cols = Math.min(children.length, 5);
  const colW = Math.max(160, Math.min(200, 900/cols));

  let html = `<div style="text-align:center;">
  <!-- Root -->
  <div style="display:inline-block;animation:fadeUp 0.5s 0.10s both;margin-bottom:8px;">
    <div class="node-3d" style="display:inline-flex;align-items:center;justify-content:center;
      padding:16px 36px;border-radius:50px;
      background:linear-gradient(135deg,#6366f1,#a855f7,#ec4899);
      box-shadow:0 10px 40px rgba(139,92,246,0.55),0 4px 12px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.25);
      border:1px solid rgba(255,255,255,0.2);">
      <span style="color:white;font-size:15px;font-weight:800;">${root}</span>
    </div>
  </div>
  <!-- Vertical connector from root -->
  <div style="width:3px;height:28px;background:linear-gradient(to bottom,#8b5cf6,#6366f1);
    margin:0 auto;border-radius:2px;"></div>
  <!-- Horizontal bus -->
  <div style="position:relative;display:flex;justify-content:center;gap:${Math.max(8,24-cols*2)}px;
    padding-top:0;">
    <!-- bus line -->
    <div style="position:absolute;top:0;left:10%;right:10%;height:3px;
      background:linear-gradient(to right,transparent,#8b5cf6,transparent);border-radius:2px;"></div>`;

  children.slice(0, cols).forEach((child, i) => {
    const p = PAL[(i+1)%PAL.length];
    const delay = (0.25+i*0.1).toFixed(2);
    html += `<div style="width:${colW}px;flex-shrink:0;animation:fadeUp 0.5s ${delay}s both;">
      <!-- drop line -->
      <div style="width:3px;height:20px;background:${p.from};margin:0 auto;border-radius:2px;"></div>
      <!-- child card -->
      <div class="node-3d" style="padding:12px 14px;border-radius:16px;margin-bottom:10px;
        background:linear-gradient(135deg,${p.from},${p.to});
        box-shadow:0 8px 28px ${p.shadow},0 2px 8px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.2);
        border:1px solid ${p.border};">
        <p style="color:white;font-size:12px;font-weight:700;margin:0;text-align:center;line-height:1.3;">${child.label}</p>
      </div>
      <!-- grandchildren -->
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
        ${(child.children??[]).slice(0,4).map((gc, j) => `
        <div class="node-3d" style="width:90%;padding:8px 10px;border-radius:10px;
          animation:diag-popIn 0.4s ${(parseFloat(delay)+0.2+j*0.06).toFixed(2)}s both;
          background:rgba(30,30,60,0.7);
          border:1px solid ${p.border};text-align:center;">
          <span style="color:rgba(255,255,255,0.88);font-size:10px;font-weight:500;line-height:1.3;">${gc}</span>
        </div>`).join("")}
      </div>
    </div>`;
  });

  html += `</div></div>`;
  return wrap3D(html, 420);
}

// ── COMPARISON ────────────────────────────────────────────────────────────────
function makeComparison(items: {name:string;points:string[]}[]): string {
  const cols = Math.min(items.length, 3);
  const colW = cols === 2 ? 340 : 260;

  let html = `<div style="display:flex;gap:16px;justify-content:center;flex-wrap:nowrap;">`;

  items.slice(0, cols).forEach((item, i) => {
    const p = PAL[i%PAL.length];
    const delay = (i*0.15).toFixed(2);
    const maxPts = Math.max(...items.map(it=>it.points.length));
    const pts = [...item.points.slice(0, Math.min(item.points.length, 6))];

    html += `<div class="node-3d" style="width:${colW}px;flex-shrink:0;border-radius:20px;overflow:hidden;
      animation:fadeUp 0.55s ${delay}s both;
      box-shadow:0 16px 48px ${p.shadow},0 4px 16px rgba(0,0,0,0.4);
      border:1px solid ${p.border};">
      <!-- Header -->
      <div style="padding:20px;text-align:center;
        background:linear-gradient(135deg,${p.from},${p.to});
        border-bottom:1px solid ${p.border};
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.2);">
        <div style="width:48px;height:48px;border-radius:50%;
          background:rgba(255,255,255,0.2);margin:0 auto 10px;
          display:flex;align-items:center;justify-content:center;
          font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
          ${["🥇","🥈","🥉","⭐","💡","🔑"][i]||"•"}
        </div>
        <p style="color:white;font-size:15px;font-weight:800;margin:0;">${item.name}</p>
      </div>
      <!-- Points -->
      <div style="background:rgba(20,20,50,0.6);">
        ${pts.map((pt, j) => `
        <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);
          display:flex;align-items:flex-start;gap:10px;
          animation:diag-slideRight 0.4s ${(parseFloat(delay)+0.15+j*0.06).toFixed(2)}s both;
          background:${j%2===0?"rgba(255,255,255,0.04)":"transparent"};">
          <div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;
            background:linear-gradient(135deg,${p.from},${p.to});
            display:flex;align-items:center;justify-content:center;margin-top:1px;
            box-shadow:0 2px 8px ${p.shadow};">
            <span style="color:white;font-size:11px;font-weight:900;">✓</span>
          </div>
          <span style="color:rgba(255,255,255,0.85);font-size:11px;line-height:1.45;">${pt}</span>
        </div>`).join("")}
      </div>
    </div>`;
  });

  html += `</div>`;
  return wrap3D(html, 480);
}

// ── AI prompts / validators / makers (unchanged structure) ─────────────────────
const SYS = `You are an expert diagram data extractor. Return ONLY valid JSON — zero markdown fences, zero text outside the JSON. Node labels must be concise (2-5 words). Sub-items max 50 chars. Use ACCURATE content from the topic.`;

const PROMPTS: Record<string, (t:string)=>string> = {
  flowchart: t=>`Create a FLOWCHART for: "${t}"\nReturn JSON: {"nodes":[{"id":"1","label":"Start","type":"start"},{"id":"2","label":"Step","type":"process"},{"id":"3","label":"Decision?","type":"decision"},{"id":"4","label":"Yes path","type":"process"},{"id":"5","label":"No path","type":"process"},{"id":"6","label":"End","type":"end"}],"edges":[{"from":"1","to":"2"},{"from":"2","to":"3"},{"from":"3","to":"4","label":"Yes"},{"from":"3","to":"5","label":"No"},{"from":"4","to":"6"},{"from":"5","to":"6"}]}\nRULES: 5-9 nodes. Include a decision node. Replace ALL placeholders with accurate labels from "${t}".`,
  mindmap: t=>`Create a MIND MAP for: "${t}"\nReturn JSON: {"center":"Core Topic","branches":[{"label":"Branch 1","items":["item","item","item"]},{"label":"Branch 2","items":["item","item","item"]},{"label":"Branch 3","items":["item","item","item"]},{"label":"Branch 4","items":["item","item"]},{"label":"Branch 5","items":["item","item"]}]}\nRULES: 4-6 branches, 2-4 items each. All content accurate and specific to "${t}".`,
  timeline: t=>`Create a TIMELINE for: "${t}"\nReturn JSON: {"events":[{"year":"Period","title":"Event Title","desc":"Short description max 55 chars"}]}\nRULES: 5-8 events chronologically. Title 2-4 words. All accurate for "${t}".`,
  cycle: t=>`Create a CYCLE DIAGRAM for: "${t}"\nReturn JSON: {"steps":[{"label":"Step Name","desc":"What happens, max 45 chars"}]}\nRULES: 4-6 steps forming a CLOSED LOOP in correct order. All accurate for "${t}".`,
  hierarchy: t=>`Create a HIERARCHY for: "${t}"\nReturn JSON: {"root":"Top Concept","children":[{"label":"Category","children":["item","item","item"]},{"label":"Category","children":["item","item"]},{"label":"Category","children":["item","item"]},{"label":"Category","children":["item","item"]}]}\nRULES: 3-5 categories, 2-4 leaf items each. All specific and accurate for "${t}".`,
  comparison: t=>`Create a COMPARISON for: "${t}"\nReturn JSON: {"items":[{"name":"Option A","points":["point","point","point","point","point"]},{"name":"Option B","points":["point","point","point","point","point"]},{"name":"Option C","points":["point","point","point","point","point"]}]}\nRULES: 2-3 real options from "${t}". Exactly 5 points each ≤28 chars.`,
};

const VALIDATORS: Record<string,(d:unknown)=>boolean> = {
  flowchart:  d=>Array.isArray((d as {nodes:unknown[]}).nodes)&&(d as {nodes:unknown[]}).nodes.length>=3,
  mindmap:    d=>typeof (d as {center:string}).center==="string"&&Array.isArray((d as {branches:unknown[]}).branches)&&(d as {branches:unknown[]}).branches.length>=3,
  timeline:   d=>Array.isArray((d as {events:unknown[]}).events)&&(d as {events:unknown[]}).events.length>=3,
  cycle:      d=>Array.isArray((d as {steps:unknown[]}).steps)&&(d as {steps:unknown[]}).steps.length>=3,
  hierarchy:  d=>typeof (d as {root:string}).root==="string"&&Array.isArray((d as {children:unknown[]}).children),
  comparison: d=>Array.isArray((d as {items:unknown[]}).items)&&(d as {items:unknown[]}).items.length>=2,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAKERS: Record<string,(d:any)=>string> = {
  flowchart:  d=>makeFlowchart(d.nodes,d.edges),
  mindmap:    d=>makeMindMap(d.center,d.branches),
  timeline:   d=>makeTimeline(d.events),
  cycle:      d=>makeCycle(d.steps),
  hierarchy:  d=>makeHierarchy(d.root,d.children),
  comparison: d=>makeComparison(d.items),
};

// ── Main component ─────────────────────────────────────────────────────────────
// Memoized so the expensive innerHTML parse only runs when html changes
const DiagramOutput = memo(
  React.forwardRef<HTMLDivElement, { html: string }>(({ html }, ref) => (
    <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  ))
);
DiagramOutput.displayName = "DiagramOutput";

const ImageGenerator = () => {
  const navigate = useNavigate();
  const [theory, setTheory] = useState("");
  const [diagramType, setDiagramType] = useState("flowchart");
  const [htmlContent, setHtmlContent] = useState<string|null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const safeParseJSON = useCallback((raw: string) => {
    const clean = raw.replace(/```json\s*/gi,"").replace(/```/g,"").replace(/[\u200B-\u200D\uFEFF]/g,"").trim();
    const s1=clean.indexOf("{"),s2=clean.indexOf("[");
    const e1=clean.lastIndexOf("}"),e2=clean.lastIndexOf("]");
    if (s2!==-1&&e2!==-1&&(s2<s1||s1===-1)) return JSON.parse(clean.slice(s2,e2+1));
    if (s1!==-1&&e1!==-1) return JSON.parse(clean.slice(s1,e1+1));
    throw new Error("No JSON found in response.");
  },[]);

  const generate = async (topic: string, type: string) => {
    if (!topic.trim()) { toast.error("Please enter a concept or theory."); return; }
    setIsLoading(true); setHtmlContent(null);
    try {
      const raw = await callAI(PROMPTS[type](topic), SYS, 0.2, 1600);
      const j = safeParseJSON(raw);
      if (!VALIDATORS[type](j)) throw new Error("AI returned incomplete data. Please try again.");
      setHtmlContent(MAKERS[type](j));
      toast.success("3D diagram ready! ✨");
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally { setIsLoading(false); }
  };

  const downloadPNG = async () => {
    if (!outputRef.current || !htmlContent) return;
    try {
      // Try html2canvas first (installed via package.json)
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(outputRef.current, {
        scale: 2, backgroundColor: "#0f0c29", useCORS: true, logging: false,
        allowTaint: true,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `diagram-${diagramType}.png`;
      a.click();
      toast.success("PNG downloaded! 🖼️");
    } catch {
      // Fallback: open in new tab so user can right-click → save
      const fullPage = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0f0c29;}</style>
        </head><body>${htmlContent}</body></html>`;
      const blob = new Blob([fullPage], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        toast.info("Opened in new tab — right-click the diagram to save as image, or use browser Print → Save as PDF.");
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        toast.error("Popup blocked — please allow popups for this site.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background dark:from-gray-950 dark:via-gray-900 dark:to-background">
      <header className="sticky top-0 z-40 border-b dark:border-gray-800 bg-card/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-base font-bold dark:text-white">Theory to Visual <span className="text-xs text-indigo-500 font-semibold">3D</span></h1>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-6">

          {/* Input panel */}
          <Card className="lg:col-span-2 shadow-md flex flex-col dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <CardTitle className="text-lg">Your Theory</CardTitle>
              </div>
              <CardDescription className="text-xs pt-1">Describe the concept, process, or topic to visualise.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <Textarea
                placeholder={`e.g. "The water cycle"\n"Photosynthesis process"\n"OSI model layers"\n"French Revolution events"`}
                className="h-[140px] text-sm resize-none dark:bg-gray-800 dark:border-gray-600"
                value={theory} onChange={e=>setTheory(e.target.value)} disabled={isLoading}
              />
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Diagram Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {DIAGRAM_TYPES.map(dt=>(
                    <button key={dt.value} onClick={()=>setDiagramType(dt.value)} title={dt.hint}
                      className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition text-left ${
                        diagramType===dt.value
                          ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
                          : "border-border dark:border-gray-700 hover:border-primary/40 text-muted-foreground dark:text-gray-400"
                      }`}>{dt.label}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">{DIAGRAM_TYPES.find(d=>d.value===diagramType)?.hint}</p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button className="flex-1 bg-gradient-to-r from-primary to-secondary text-white font-bold"
                onClick={()=>generate(theory,diagramType)} disabled={isLoading||!theory.trim()}>
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Generating…</> : <><Sparkles className="w-4 h-4 mr-2"/>Generate 3D</>}
              </Button>
              {htmlContent&&!isLoading&&(
                <Button variant="outline" onClick={()=>setHtmlContent(null)} className="dark:border-gray-600">
                  <RefreshCw className="w-4 h-4"/>
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Output panel */}
          <Card className={`lg:col-span-3 shadow-md flex flex-col dark:bg-gray-900 dark:border-gray-700 ${isFullscreen?"fixed inset-3 z-50":""}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base dark:text-white">3D Animated Diagram</CardTitle>
                <CardDescription className="text-xs">CSS 3D transforms · Entrance animations · Hover depth</CardDescription>
              </div>
              {htmlContent&&!isLoading&&(
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={()=>setIsFullscreen(f=>!f)} className="h-8 w-8 p-0 dark:border-gray-600">
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5"/> : <Maximize2 className="w-3.5 h-3.5"/>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadPNG} className="h-8 px-2.5 dark:border-gray-600 text-indigo-600 dark:text-indigo-400">
                    <FileImage className="w-3.5 h-3.5 mr-1"/>PNG
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-grow p-3 min-h-[480px] overflow-auto">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin"/>
                    <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-500"/>
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Building your 3D diagram…</p>
                </div>
              )}
              {htmlContent&&!isLoading&&(
                <DiagramOutput ref={outputRef} html={htmlContent}/>
              )}
              {!htmlContent&&!isLoading&&(
                <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950 dark:to-purple-950 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-indigo-300 dark:text-indigo-600" strokeWidth={1.5}/>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Your 3D diagram will appear here</p>
                  <p className="text-xs text-muted-foreground/60">Click an example below or enter your own topic</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Example tiles — auto-generate */}
        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {[
            {icon:"🔀",topic:"User login authentication flow",type:"flowchart"},
            {icon:"🧠",topic:"Machine learning concepts",type:"mindmap"},
            {icon:"📅",topic:"History of the Internet",type:"timeline"},
            {icon:"🔄",topic:"Water cycle in nature",type:"cycle"},
            {icon:"🏗️",topic:"Types of operating systems",type:"hierarchy"},
            {icon:"⚖️",topic:"SQL vs NoSQL vs NewSQL",type:"comparison"},
          ].map(ex=>(
            <button key={ex.topic} onClick={()=>{ setTheory(ex.topic); setDiagramType(ex.type); generate(ex.topic,ex.type); }}
              disabled={isLoading}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-0.5 transition-all text-left group disabled:opacity-50">
              <span className="text-2xl shrink-0">{ex.icon}</span>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{ex.topic}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{ex.type} · 3D</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ImageGenerator;

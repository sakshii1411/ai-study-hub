/**
 * ImageGenerator.tsx — Theory to Visual  (v3 — premium visuals)
 *
 * Improvements over v2:
 *  • Linear gradients on every node/shape
 *  • Glass-morphism background panels
 *  • Curved, tapered connector lines with glow
 *  • Richer typography: two font sizes (title + subtitle) per node
 *  • Flowchart: coloured per-node, gradient start/end pills, glow arrows
 *  • Mind Map: curved Bezier arms, gradient center orb, pill sub-items
 *  • Timeline: alternating left/right zigzag, gradient spine, icon circles
 *  • Cycle: radial gradient fill, animated-look arc connectors
 *  • Hierarchy: gradient root banner, connector elbows, leaf chips
 *  • Comparison: gradient headers, checkmark badges, alternating rows
 *  • PNG export (in addition to SVG)
 */
import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Image as ImageIcon, Sparkles, Download,
  Loader2, BookOpen, RefreshCw, Maximize2, Minimize2,
  ZoomIn, ZoomOut, FileImage,
} from "lucide-react";
import { callAI } from "@/lib/aiClient";

// ─── Diagram type catalogue ───────────────────────────────────────────────────
const DIAGRAM_TYPES = [
  { value: "flowchart",   label: "🔀 Flowchart",      hint: "Processes, algorithms, decision trees" },
  { value: "mindmap",     label: "🧠 Mind Map",        hint: "Concepts with multiple sub-topics" },
  { value: "timeline",    label: "📅 Timeline",        hint: "Historical events, project phases" },
  { value: "cycle",       label: "🔄 Cycle Diagram",   hint: "Repeating processes (water cycle etc.)" },
  { value: "hierarchy",   label: "🏗️ Hierarchy",      hint: "Org charts, classification systems" },
  { value: "comparison",  label: "⚖️ Comparison",     hint: "Compare options, approaches, features" },
];

// ─── Colour palettes (bg light, bg dark gradient stop, border, text, accent) ──
const PAL = [
  { l:"#dbeafe", d:"#bfdbfe", g:"#3b82f6", b:"#2563eb", t:"#1e3a8a", a:"#1d4ed8" },
  { l:"#dcfce7", d:"#bbf7d0", g:"#22c55e", b:"#16a34a", t:"#14532d", a:"#15803d" },
  { l:"#f3e8ff", d:"#e9d5ff", g:"#a855f7", b:"#9333ea", t:"#581c87", a:"#7c3aed" },
  { l:"#fff7ed", d:"#fed7aa", g:"#f97316", b:"#ea580c", t:"#7c2d12", a:"#c2410c" },
  { l:"#fce7f3", d:"#fbcfe8", g:"#ec4899", b:"#db2777", t:"#831843", a:"#be185d" },
  { l:"#ccfbf1", d:"#99f6e4", g:"#14b8a6", b:"#0d9488", t:"#134e4a", a:"#0f766e" },
  { l:"#fef9c3", d:"#fef08a", g:"#eab308", b:"#ca8a04", t:"#713f12", a:"#a16207" },
];

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, maxCh: number, maxLines: number): string[] {
  const words = String(text ?? "").trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxCh && cur) {
      lines.push(cur);
      if (lines.length >= maxLines - 1) { cur = w.slice(0, maxCh - 1) + (words.indexOf(w) < words.length - 1 ? "…" : ""); break; }
      cur = w.length > maxCh ? w.slice(0, maxCh - 1) + "…" : w;
    } else { cur = cand.length > maxCh ? cand.slice(0, maxCh - 1) + "…" : cand; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

function txt(
  x: number, cy: number, lines: string[],
  fs: number, fill: string, fw = "600", anchor = "middle", lhExtra = 4
): string {
  const lh = fs + lhExtra;
  const startY = cy - ((lines.length - 1) * lh) / 2;
  return lines.map((l, i) =>
    `<text x="${x}" y="${startY + i * lh}" text-anchor="${anchor}" dominant-baseline="middle" ` +
    `font-size="${fs}" font-weight="${fw}" fill="${fill}" ` +
    `font-family="'Segoe UI',system-ui,sans-serif">${esc(l)}</text>`
  ).join("");
}

// Shared defs block (gradients + filters) injected per diagram
function sharedDefs(extra = ""): string {
  return `<defs>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#00000022"/>
  </filter>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  ${PAL.map((p, i) => `
  <linearGradient id="ng${i}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${p.l}"/>
    <stop offset="100%" stop-color="${p.d}"/>
  </linearGradient>
  <linearGradient id="dg${i}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${p.g}"/>
    <stop offset="100%" stop-color="${p.a}"/>
  </linearGradient>`).join("")}
  <linearGradient id="bg0" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#f0f4ff"/>
    <stop offset="100%" stop-color="#fafbff"/>
  </linearGradient>
  <linearGradient id="spine" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#6366f1"/>
    <stop offset="100%" stop-color="#a855f7"/>
  </linearGradient>
  ${extra}
</defs>`;
}

// ─── FLOWCHART ────────────────────────────────────────────────────────────────
function makeFlowchart(
  nodes: { id: string; label: string; type?: string }[],
  edges: { from: string; to: string; label?: string }[]
): string {
  const NW = 210, NH = 64, HGAP = 270, VGAP = 120;

  // BFS layering
  const inDeg = new Map<string, number>();
  nodes.forEach(n => inDeg.set(n.id, 0));
  edges.forEach(e => inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1));
  const visited = new Set<string>();
  const layers: string[][] = [];
  const q = nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  if (!q.length && nodes.length) q.push(nodes[0].id);

  while (q.length) {
    const layer = [...new Set(q.splice(0))];
    const newLayer = layer.filter(id => !visited.has(id));
    if (newLayer.length) { layers.push(newLayer); newLayer.forEach(id => { visited.add(id); edges.filter(e => e.from === id).forEach(e => { if (!visited.has(e.to)) q.push(e.to); }); }); }
  }
  nodes.forEach(n => { if (!visited.has(n.id)) layers.push([n.id]); });

  const maxPR = Math.max(...layers.map(l => l.length), 1);
  const svgW = Math.max(560, maxPR * HGAP + 120);
  const svgH = layers.length * VGAP + 120;

  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, li) => {
    const rowW = layer.length * HGAP;
    const sx = (svgW - rowW) / 2 + HGAP / 2;
    layer.forEach((id, j) => pos.set(id, { x: sx + j * HGAP, y: 70 + li * VGAP }));
  });

  // Node colour by index
  const nodeIdx = new Map<string, number>();
  nodes.forEach((n, i) => nodeIdx.set(n.id, i));

  let arrows = "";
  const seen = new Set<string>();
  edges.forEach(e => {
    if (seen.has(`${e.from}-${e.to}`)) return; seen.add(`${e.from}-${e.to}`);
    const f = pos.get(e.from), t = pos.get(e.to);
    if (!f || !t) return;
    const sameX = Math.abs(f.x - t.x) < 5;
    const my = (f.y + t.y) / 2;
    const d = sameX
      ? `M${f.x},${f.y + NH / 2} L${t.x},${t.y - NH / 2}`
      : `M${f.x},${f.y + NH / 2} C${f.x},${my} ${t.x},${my} ${t.x},${t.y - NH / 2}`;
    const fi = nodeIdx.get(e.from) ?? 0;
    const col = PAL[fi % PAL.length].g;
    arrows += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arr${fi % PAL.length})" opacity="0.85"/>`;
    if (e.label) {
      const mx = (f.x + t.x) / 2, lmy = my;
      arrows += `<rect x="${mx - 24}" y="${lmy - 11}" width="48" height="22" rx="6" fill="white" stroke="${col}" stroke-width="1" opacity="0.95"/>`;
      arrows += txt(mx, lmy, [String(e.label).slice(0, 10)], 10, col, "700");
    }
  });

  let nodeSvg = "";
  nodes.forEach((n, i) => {
    const p = pos.get(n.id); if (!p) return;
    const c = PAL[i % PAL.length];
    const isStart = n.type === "start" || i === 0;
    const isEnd = n.type === "end" || i === nodes.length - 1;
    const isDec = n.type === "decision";
    const lines = wrap(n.label, 20, 3);
    const nodeH = Math.max(NH, lines.length * 16 + 24);

    if (isDec) {
      const hw = NW / 2 + 10, hh = nodeH / 2 + 12;
      nodeSvg += `<polygon points="${p.x},${p.y - hh} ${p.x + hw},${p.y} ${p.x},${p.y + hh} ${p.x - hw},${p.y}" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="2.5" filter="url(#sh)"/>`;
      nodeSvg += txt(p.x, p.y, lines, 11, c.t, "700");
    } else if (isStart || isEnd) {
      nodeSvg += `<rect x="${p.x - NW / 2}" y="${p.y - nodeH / 2}" width="${NW}" height="${nodeH}" rx="${nodeH / 2}" fill="url(#dg${i % PAL.length})" stroke="${c.b}" stroke-width="2" filter="url(#sh)"/>`;
      nodeSvg += txt(p.x, p.y, lines, 12, "white", "700");
    } else {
      nodeSvg += `<rect x="${p.x - NW / 2}" y="${p.y - nodeH / 2}" width="${NW}" height="${nodeH}" rx="14" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="2" filter="url(#sh)"/>`;
      nodeSvg += txt(p.x, p.y, lines, 12, c.t, "600");
    }
  });

  const arrowMarkers = PAL.map((p, i) =>
    `<marker id="arr${i}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="${p.g}"/>
    </marker>`).join("");

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${sharedDefs(arrowMarkers)}
  <rect width="${svgW}" height="${svgH}" fill="url(#bg0)" rx="16"/>
  ${arrows}
  <g>${nodeSvg}</g>
</svg>`;
}

// ─── MIND MAP ─────────────────────────────────────────────────────────────────
function makeMindMap(center: string, branches: { label: string; items?: string[] }[]): string {
  const count = Math.min(branches.length, 7);
  const svgW = 1160, svgH = 820;
  const cx = svgW / 2, cy = svgH / 2;
  const R = 250, subR = 155;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="url(#bg0)" rx="16"/>`;

  // Glowing rings
  svg += `<circle cx="${cx}" cy="${cy}" r="${R + 40}" fill="none" stroke="#6366f133" stroke-width="1" stroke-dasharray="6,5"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${R - 40}" fill="none" stroke="#a855f722" stroke-width="1" stroke-dasharray="4,6"/>`;

  // Center orb
  svg += `<circle cx="${cx}" cy="${cy}" r="80" fill="url(#dg2)" stroke="#7c3aed" stroke-width="3" filter="url(#sh)"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="80" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>`;
  const cLines = wrap(center, 14, 3);
  svg += txt(cx, cy, cLines, 14, "white", "800");

  branches.slice(0, count).forEach((branch, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const bx = cx + Math.cos(angle) * R;
    const by = cy + Math.sin(angle) * R;
    const c = PAL[i % PAL.length];

    // Curved arm from orb edge to branch
    const ox = cx + Math.cos(angle) * 82, oy = cy + Math.sin(angle) * 82;
    const bex = bx - Math.cos(angle) * 78, bey = by - Math.sin(angle) * 34;
    const cpx = cx + Math.cos(angle) * (R / 2), cpy = cy + Math.sin(angle) * (R / 2);
    svg += `<path d="M${ox},${oy} Q${cpx},${cpy} ${bex},${bey}" fill="none" stroke="${c.g}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;

    // Branch bubble
    const bLines = wrap(branch.label, 13, 2);
    const BW = 148, BH = Math.max(52, bLines.length * 18 + 18);
    svg += `<rect x="${bx - BW / 2}" y="${by - BH / 2}" width="${BW}" height="${BH}" rx="14" fill="url(#dg${i % PAL.length})" stroke="${c.b}" stroke-width="2" filter="url(#sh)"/>`;
    svg += txt(bx, by, bLines, 12, "white", "700");

    // Sub-items
    const items = (branch.items ?? []).slice(0, 4);
    items.forEach((item, j) => {
      const spread = items.length <= 1 ? 0 : (j - (items.length - 1) / 2) * 0.44;
      const sAngle = angle + spread;
      const sx = cx + Math.cos(sAngle) * (R + subR);
      const sy = cy + Math.sin(sAngle) * (R + subR);

      const arm1x = bx + Math.cos(sAngle) * (BW / 2);
      const arm1y = by + Math.sin(sAngle) * (BH / 2);
      const arm2x = sx - Math.cos(sAngle) * 58;
      const arm2y = sy - Math.sin(sAngle) * 18;
      svg += `<line x1="${arm1x}" y1="${arm1y}" x2="${arm2x}" y2="${arm2y}" stroke="${c.g}" stroke-width="1.8" opacity="0.5" stroke-dasharray="4,3"/>`;

      const iLines = wrap(item, 12, 2);
      const IW = 116, IH = Math.max(34, iLines.length * 14 + 14);
      svg += `<rect x="${sx - IW / 2}" y="${sy - IH / 2}" width="${IW}" height="${IH}" rx="10" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="1.5"/>`;
      svg += txt(sx, sy, iLines, 10, c.t, "600");
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${sharedDefs()}
  ${svg}
</svg>`;
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function makeTimeline(events: { year: string; title: string; desc?: string }[]): string {
  const ROW_H = 110;
  const svgW = 900;
  const svgH = events.length * ROW_H + 100;
  const spineX = svgW / 2;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="url(#bg0)" rx="16"/>`;
  // Gradient spine
  svg += `<line x1="${spineX}" y1="30" x2="${spineX}" y2="${svgH - 20}" stroke="url(#spine)" stroke-width="4" stroke-linecap="round"/>`;

  events.forEach((ev, i) => {
    const y = 55 + i * ROW_H;
    const c = PAL[i % PAL.length];
    const isLeft = i % 2 === 0;
    const cardW = 330, cardX = isLeft ? spineX - 24 - cardW : spineX + 24;

    // Dot on spine
    svg += `<circle cx="${spineX}" cy="${y}" r="16" fill="url(#dg${i % PAL.length})" stroke="white" stroke-width="3" filter="url(#sh)"/>`;
    svg += txt(spineX, y, [String(i + 1)], 11, "white", "800");

    // Connector elbow
    const elbowX = isLeft ? spineX - 22 : spineX + 22;
    svg += `<line x1="${elbowX}" y1="${y}" x2="${isLeft ? cardX + cardW : cardX}" y2="${y}" stroke="${c.g}" stroke-width="2" stroke-dasharray="5,3" opacity="0.6"/>`;

    // Year badge above
    const yearLines = wrap(String(ev.year ?? ""), 8, 1);
    const yx = isLeft ? spineX - 28 : spineX + 28;
    const ya = isLeft ? "end" : "start";
    svg += txt(yx, y - 24, yearLines, 11, c.b, "800", ya, 5);

    // Card
    const titleLines = wrap(String(ev.title ?? ""), 28, 2);
    const descLines = ev.desc ? wrap(String(ev.desc), 38, 2) : [];
    const cardH = Math.max(60, (titleLines.length + descLines.length) * 18 + 24);

    svg += `<rect x="${cardX}" y="${y - cardH / 2}" width="${cardW}" height="${cardH}" rx="14" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="2" filter="url(#sh)"/>`;
    // Left accent bar
    svg += `<rect x="${cardX}" y="${y - cardH / 2}" width="6" height="${cardH}" rx="6" fill="url(#dg${i % PAL.length})"/>`;

    const textX = cardX + 18;
    const titleY = descLines.length ? y - descLines.length * 9 - 2 : y;
    svg += txt(textX, titleY, titleLines, 13, c.t, "700", "start", 5);
    if (descLines.length) svg += txt(textX, y + titleLines.length * 10 + 2, descLines, 11, "#64748b", "400", "start", 5);
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${sharedDefs()}
  ${svg}
</svg>`;
}

// ─── CYCLE ────────────────────────────────────────────────────────────────────
function makeCycle(steps: { label: string; desc?: string }[]): string {
  const count = Math.min(steps.length, 7);
  const svgW = 800, svgH = 760;
  const cx = svgW / 2, cy = svgH / 2;
  const R = 240;
  const rx = 88, ry = 50;

  const arrowMarkers = PAL.map((p, i) =>
    `<marker id="ca${i}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <polygon points="0 0,9 3.5,0 7" fill="${p.g}"/>
    </marker>`).join("");

  const positions = Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R, angle };
  });

  let svg = `<rect width="${svgW}" height="${svgH}" fill="url(#bg0)" rx="16"/>`;

  // Decorative track circle
  svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8,5"/>`;

  // Center hub
  svg += `<circle cx="${cx}" cy="${cy}" r="62" fill="url(#dg2)" filter="url(#sh)"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="62" fill="none" stroke="white" stroke-width="1.5" opacity="0.3"/>`;
  const hubLines = wrap("Cycle", 8, 1);
  svg += txt(cx, cy, hubLines, 16, "white", "800");

  positions.forEach((p, i) => {
    const next = positions[(i + 1) % count];
    const c = PAL[i % PAL.length];

    // Arc connector between nodes
    const midA = (p.angle + next.angle) / 2;
    const cpx = cx + Math.cos(midA) * (R + 48);
    const cpy = cy + Math.sin(midA) * (R + 48);
    svg += `<path d="M${p.x} ${p.y} Q${cpx} ${cpy} ${next.x} ${next.y}" fill="none" stroke="${c.g}" stroke-width="3" stroke-linecap="round" marker-end="url(#ca${i})" opacity="0.8"/>`;

    // Ellipse node with gradient
    svg += `<ellipse cx="${p.x}" cy="${p.y}" rx="${rx}" ry="${ry}" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="2.5" filter="url(#sh)"/>`;

    // Step number badge
    const bx = p.x + rx * 0.68, by = p.y - ry * 0.72;
    svg += `<circle cx="${bx}" cy="${by}" r="14" fill="url(#dg${i % PAL.length})" stroke="white" stroke-width="2"/>`;
    svg += txt(bx, by, [String(i + 1)], 11, "white", "800");

    const lines = wrap(steps[i].label, 11, 2);
    svg += txt(p.x, p.y - (steps[i].desc ? 6 : 0), lines, 11, c.t, "700");
    if (steps[i].desc) {
      const dLines = wrap(steps[i].desc!, 13, 1);
      svg += txt(p.x, p.y + 13, dLines, 9, "#64748b", "400");
    }
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${sharedDefs(arrowMarkers)}
  ${svg}
</svg>`;
}

// ─── HIERARCHY ────────────────────────────────────────────────────────────────
function makeHierarchy(root: string, children: { label: string; children?: string[] }[]): string {
  const cols = Math.min(children.length, 5);
  const COL_W = 185;
  const NW = 168, NH = 54;
  const maxSubs = Math.max(...children.map(c => (c.children ?? []).length), 0);
  const svgW = Math.max(760, cols * COL_W + 120);
  const svgH = maxSubs > 0 ? 370 : 230;
  const cx = svgW / 2;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="url(#bg0)" rx="16"/>`;

  // Root banner — gradient pill
  const rootLines = wrap(root, 18, 2);
  const rootH = Math.max(NH, rootLines.length * 18 + 18);
  svg += `<rect x="${cx - NW / 2 - 10}" y="14" width="${NW + 20}" height="${rootH}" rx="16" fill="url(#dg2)" filter="url(#sh)"/>`;
  svg += `<rect x="${cx - NW / 2 - 10}" y="14" width="${NW + 20}" height="${rootH}" rx="16" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>`;
  svg += txt(cx, 14 + rootH / 2, rootLines, 13, "white", "800");

  const totalW = cols * COL_W;
  const startX = cx - totalW / 2 + COL_W / 2;

  // Horizontal bus line
  if (cols > 1) {
    svg += `<line x1="${startX}" y1="108" x2="${startX + (cols - 1) * COL_W}" y2="108" stroke="#c7d2fe" stroke-width="2.5"/>`;
  }

  children.slice(0, cols).forEach((child, i) => {
    const bx = startX + i * COL_W;
    const by = 84;
    const c = PAL[i % PAL.length];

    // Drop from root
    svg += `<line x1="${cx}" y1="${14 + rootH}" x2="${bx}" y2="${by}" stroke="#818cf8" stroke-width="2" stroke-dasharray="5,3" opacity="0.7"/>`;

    const bLines = wrap(child.label, 14, 2);
    const BH = Math.max(NH, bLines.length * 17 + 18);
    svg += `<rect x="${bx - NW / 2}" y="${by}" width="${NW}" height="${BH}" rx="12" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="2" filter="url(#sh)"/>`;
    svg += `<rect x="${bx - NW / 2}" y="${by}" width="5" height="${BH}" rx="5" fill="url(#dg${i % PAL.length})"/>`;
    svg += txt(bx + 3, by + BH / 2, bLines, 11, c.t, "700");

    const subs = (child.children ?? []).slice(0, 4);
    const subCount = subs.length;
    const subSpan = Math.min(subCount * 90, NW + 20);
    subs.forEach((gc, j) => {
      const gcx = subs.length === 1 ? bx : bx - subSpan / 2 + j * (subSpan / (subCount - 1));
      const gcy = by + BH + 50;
      svg += `<line x1="${bx}" y1="${by + BH}" x2="${gcx}" y2="${gcy}" stroke="${c.g}" stroke-width="1.6" opacity="0.6"/>`;
      const gcLines = wrap(gc, 11, 2);
      const GW = 100, GH = Math.max(34, gcLines.length * 14 + 14);
      svg += `<rect x="${gcx - GW / 2}" y="${gcy}" width="${GW}" height="${GH}" rx="9" fill="url(#ng${i % PAL.length})" stroke="${c.b}" stroke-width="1.5"/>`;
      svg += txt(gcx, gcy + GH / 2, gcLines, 10, c.t, "600");
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${sharedDefs()}
  ${svg}
</svg>`;
}

// ─── COMPARISON ───────────────────────────────────────────────────────────────
function makeComparison(items: { name: string; points: string[] }[]): string {
  const cols = Math.min(items.length, 3);
  const COL_W = 258, HDR_H = 80, ROW_H = 56, PAD = 18, GAP = 10;
  const maxPts = Math.max(...items.map(it => it.points.length), 3);
  const svgW = cols * COL_W + PAD * 2 + (cols - 1) * GAP;
  const svgH = HDR_H + maxPts * ROW_H + PAD * 2 + 24;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="url(#bg0)" rx="16"/>`;

  items.slice(0, cols).forEach((item, i) => {
    const x = PAD + i * (COL_W + GAP);
    const c = PAL[i % PAL.length];

    // Gradient header
    svg += `<rect x="${x}" y="${PAD}" width="${COL_W}" height="${HDR_H}" rx="14" fill="url(#dg${i % PAL.length})" filter="url(#sh)"/>`;
    svg += `<rect x="${x}" y="${PAD}" width="${COL_W}" height="${HDR_H}" rx="14" fill="none" stroke="white" stroke-width="1" opacity="0.2"/>`;
    const nLines = wrap(item.name, 17, 2);
    svg += txt(x + COL_W / 2, PAD + HDR_H / 2, nLines, 14, "white", "800");

    const pts = [...item.points.slice(0, maxPts)];
    while (pts.length < maxPts) pts.push("");

    pts.forEach((pt, j) => {
      const py = PAD + HDR_H + 6 + j * ROW_H;
      const isEven = j % 2 === 0;
      const fill = isEven ? `url(#ng${i % PAL.length})` : "white";
      svg += `<rect x="${x}" y="${py}" width="${COL_W}" height="${ROW_H - 4}" rx="10" fill="${fill}" stroke="${c.b}" stroke-width="1.3"/>`;
      if (pt) {
        // Checkmark badge
        svg += `<circle cx="${x + 22}" cy="${py + (ROW_H - 4) / 2}" r="10" fill="url(#dg${i % PAL.length})"/>`;
        svg += txt(x + 22, py + (ROW_H - 4) / 2, ["✓"], 10, "white", "900");
        const ptLines = wrap(pt, 21, 2);
        svg += txt(x + 40, py + (ROW_H - 4) / 2, ptLines, 10, c.t, "500", "start", 4);
      }
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${sharedDefs()}
  ${svg}
</svg>`;
}

// ─── Main component ───────────────────────────────────────────────────────────
const SYS = `You are an expert diagram data extractor. Return ONLY valid JSON — zero markdown fences, zero text outside the JSON. Node labels must be concise (2-5 words). Sub-items max 50 chars. Use ACCURATE content from the topic — no generic placeholders.`;

const PROMPTS: Record<string, (t: string) => string> = {
  flowchart: t => `Create a FLOWCHART for: "${t}"
Return JSON: {"nodes":[{"id":"1","label":"Start","type":"start"},{"id":"2","label":"Step","type":"process"},{"id":"3","label":"Decision?","type":"decision"},{"id":"4","label":"Yes path","type":"process"},{"id":"5","label":"No path","type":"process"},{"id":"6","label":"End","type":"end"}],"edges":[{"from":"1","to":"2"},{"from":"2","to":"3"},{"from":"3","to":"4","label":"Yes"},{"from":"3","to":"5","label":"No"},{"from":"4","to":"6"},{"from":"5","to":"6"}]}
RULES: 5-9 nodes. Include a decision node if logical. type = start|process|decision|end. Replace ALL placeholders with accurate labels from "${t}".`,

  mindmap: t => `Create a MIND MAP for: "${t}"
Return JSON: {"center":"Core Topic","branches":[{"label":"Branch 1","items":["item","item","item"]},{"label":"Branch 2","items":["item","item","item"]},{"label":"Branch 3","items":["item","item","item"]},{"label":"Branch 4","items":["item","item"]},{"label":"Branch 5","items":["item","item"]}]}
RULES: 4-6 branches, 2-4 items each. All content accurate and specific to "${t}".`,

  timeline: t => `Create a TIMELINE for: "${t}"
Return JSON: {"events":[{"year":"Period","title":"Event","desc":"Short description max 55 chars"},...]}
RULES: 5-8 events chronologically. Title 2-4 words. Year can be a phase name. All accurate for "${t}".`,

  cycle: t => `Create a CYCLE DIAGRAM for: "${t}"
Return JSON: {"steps":[{"label":"Step Name","desc":"What happens, max 45 chars"},...]}
RULES: 4-6 steps forming a CLOSED LOOP in correct order. All accurate for "${t}".`,

  hierarchy: t => `Create a HIERARCHY for: "${t}"
Return JSON: {"root":"Top Concept","children":[{"label":"Category","children":["item","item","item"]},{"label":"Category","children":["item","item"]},{"label":"Category","children":["item","item"]},{"label":"Category","children":["item","item"]}]}
RULES: 3-5 categories, 2-4 leaf items each. All specific and accurate for "${t}".`,

  comparison: t => `Create a COMPARISON for: "${t}"
Return JSON: {"items":[{"name":"Option A","points":["point","point","point","point","point"]},{"name":"Option B","points":["point","point","point","point","point"]},{"name":"Option C","points":["point","point","point","point","point"]}]}
RULES: 2-3 real options from "${t}". Exactly 5 points each ≤28 chars. Highlight real differences.`,
};

const VALIDATORS: Record<string, (d: unknown) => boolean> = {
  flowchart:  d => Array.isArray((d as {nodes:unknown[]}).nodes) && (d as {nodes:unknown[]}).nodes.length >= 3,
  mindmap:    d => typeof (d as {center:string}).center === "string" && Array.isArray((d as {branches:unknown[]}).branches) && (d as {branches:unknown[]}).branches.length >= 3,
  timeline:   d => Array.isArray((d as {events:unknown[]}).events) && (d as {events:unknown[]}).events.length >= 3,
  cycle:      d => Array.isArray((d as {steps:unknown[]}).steps) && (d as {steps:unknown[]}).steps.length >= 3,
  hierarchy:  d => typeof (d as {root:string}).root === "string" && Array.isArray((d as {children:unknown[]}).children),
  comparison: d => Array.isArray((d as {items:unknown[]}).items) && (d as {items:unknown[]}).items.length >= 2,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAKERS: Record<string, (d: any) => string> = {
  flowchart:  d => makeFlowchart(d.nodes, d.edges),
  mindmap:    d => makeMindMap(d.center, d.branches),
  timeline:   d => makeTimeline(d.events),
  cycle:      d => makeCycle(d.steps),
  hierarchy:  d => makeHierarchy(d.root, d.children),
  comparison: d => makeComparison(d.items),
};

const ImageGenerator = () => {
  const navigate = useNavigate();
  const [theory, setTheory] = useState("");
  const [diagramType, setDiagramType] = useState("flowchart");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeParseJSON = useCallback((raw: string) => {
    const clean = raw.replace(/```json\s*/gi, "").replace(/```/g, "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    const s1 = clean.indexOf("{"), s2 = clean.indexOf("[");
    const e1 = clean.lastIndexOf("}"), e2 = clean.lastIndexOf("]");
    if (s2 !== -1 && e2 !== -1 && (s2 < s1 || s1 === -1)) return JSON.parse(clean.slice(s2, e2 + 1));
    if (s1 !== -1 && e1 !== -1) return JSON.parse(clean.slice(s1, e1 + 1));
    throw new Error("No JSON in response.");
  }, []);

  const handleGenerate = async () => {
    const trimmed = theory.trim();
    if (!trimmed) { toast.error("Please enter a concept or theory."); return; }
    setIsLoading(true); setSvgContent(null); setZoom(1);
    try {
      const raw = await callAI(PROMPTS[diagramType](trimmed), SYS, 0.2, 1600);
      const j = safeParseJSON(raw);
      if (!VALIDATORS[diagramType](j)) throw new Error("AI returned incomplete data. Please try again.");
      setSvgContent(MAKERS[diagramType](j));
      toast.success("Diagram generated! ✨");
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally { setIsLoading(false); }
  };

  const downloadSVG = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `diagram-${diagramType}.svg` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const downloadPNG = () => {
    if (!svgContent) return;
    const img = new Image();
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2; canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.fillStyle = "#fafbff"; ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      const a = Object.assign(document.createElement("a"), { href: canvas.toDataURL("image/png"), download: `diagram-${diagramType}.png` });
      a.click(); URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background dark:from-gray-950 dark:via-gray-900 dark:to-background">
      <header className="sticky top-0 z-40 border-b dark:border-gray-800 bg-card/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-base font-bold dark:text-white">Theory to Visual</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Input panel (2 cols) ── */}
          <Card className="lg:col-span-2 shadow-md flex flex-col dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <CardTitle className="text-lg">Your Theory</CardTitle>
              </div>
              <CardDescription className="text-xs pt-1">Describe the concept, process, or topic.</CardDescription>
            </CardHeader>

            <CardContent className="flex-grow space-y-4">
              <Textarea
                placeholder={`e.g. "The water cycle: evaporation → condensation → precipitation → runoff"\nor "Photosynthesis process"\nor "OSI model layers"`}
                className="h-[160px] text-sm resize-none dark:bg-gray-800 dark:border-gray-600"
                value={theory}
                onChange={e => setTheory(e.target.value)}
                disabled={isLoading}
              />

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Diagram Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {DIAGRAM_TYPES.map(dt => (
                    <button key={dt.value} onClick={() => setDiagramType(dt.value)} title={dt.hint}
                      className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition text-left ${
                        diagramType === dt.value
                          ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
                          : "border-border dark:border-gray-700 hover:border-primary/40 text-muted-foreground dark:text-gray-400"
                      }`}>
                      {dt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {DIAGRAM_TYPES.find(d => d.value === diagramType)?.hint}
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex gap-2">
              <Button className="flex-1 bg-gradient-to-r from-primary to-secondary text-white font-bold"
                onClick={handleGenerate} disabled={isLoading || !theory.trim()}>
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                  : <><Sparkles className="w-4 h-4 mr-2" />Generate</>}
              </Button>
              {svgContent && !isLoading && (
                <Button variant="outline" onClick={() => { setSvgContent(null); setZoom(1); }} className="dark:border-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* ── Output panel (3 cols) ── */}
          <Card className={`lg:col-span-3 shadow-md flex flex-col dark:bg-gray-900 dark:border-gray-700 ${isFullscreen ? "fixed inset-3 z-50" : ""}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base dark:text-white">Generated Diagram</CardTitle>
                <CardDescription className="text-xs">Premium AI-generated SVG with gradients & shadows</CardDescription>
              </div>
              {svgContent && !isLoading && (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.25, z - 0.15))} className="h-8 w-8 p-0 dark:border-gray-600"><ZoomOut className="w-3.5 h-3.5" /></Button>
                  <span className="text-xs text-muted-foreground w-9 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(3, z + 0.15))} className="h-8 w-8 p-0 dark:border-gray-600"><ZoomIn className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setZoom(1)} className="h-8 px-2 text-xs dark:border-gray-600">1:1</Button>
                  <Button variant="outline" size="sm" onClick={() => setIsFullscreen(f => !f)} className="h-8 w-8 p-0 dark:border-gray-600">
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadSVG} className="h-8 px-2.5 dark:border-gray-600">
                    <Download className="w-3.5 h-3.5 mr-1" />SVG
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadPNG} className="h-8 px-2.5 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                    <FileImage className="w-3.5 h-3.5 mr-1" />PNG
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-grow p-3 min-h-[440px] overflow-hidden">
              <div ref={containerRef}
                className="w-full h-full min-h-[420px] bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-gray-800 dark:to-gray-900 rounded-2xl border border-dashed border-border/50 dark:border-gray-700 overflow-auto flex items-start justify-center p-3">
                {svgContent && !isLoading && (
                  <div className="w-full transition-transform duration-200"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                    dangerouslySetInnerHTML={{ __html: svgContent }} />
                )}
                {isLoading && (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-500" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">Crafting your diagram…</p>
                    <p className="text-xs text-muted-foreground/60">AI is building your visual</p>
                  </div>
                )}
                {!svgContent && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950 dark:to-purple-950 flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-indigo-300 dark:text-indigo-600" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Your diagram will appear here</p>
                    <p className="text-xs text-muted-foreground/60">Choose a type, enter a topic, click Generate</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Examples row */}
        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {[
            { icon:"🔀", topic:"Login authentication process", type:"flowchart" },
            { icon:"🧠", topic:"Machine learning concepts", type:"mindmap" },
            { icon:"📅", topic:"History of the Internet", type:"timeline" },
            { icon:"🔄", topic:"Water cycle", type:"cycle" },
            { icon:"🏗️", topic:"Types of operating systems", type:"hierarchy" },
            { icon:"⚖️", topic:"SQL vs NoSQL vs NewSQL", type:"comparison" },
          ].map(ex => (
            <button key={ex.topic} onClick={() => { setTheory(ex.topic); setDiagramType(ex.type); }}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-0.5 transition-all text-left group">
              <span className="text-2xl shrink-0">{ex.icon}</span>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{ex.topic}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{ex.type}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ImageGenerator;

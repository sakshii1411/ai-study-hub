/**
 * ImageGenerator.tsx — Theory to Visual
 * Fully fixed: proper text wrapping, dynamic sizing, no overlaps, distinct diagram types.
 */
import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, Sparkles, Download, Loader2, Info, BookOpen, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { callAI } from "@/lib/aiClient";

const DIAGRAM_TYPES = [
  { value: "flowchart",  label: "🔀 Flowchart",    hint: "Processes, algorithms, decision trees" },
  { value: "mindmap",   label: "🧠 Mind Map",       hint: "Concepts with multiple sub-topics" },
  { value: "timeline",  label: "📅 Timeline",       hint: "Historical events, project phases" },
  { value: "cycle",     label: "🔄 Cycle Diagram",  hint: "Repeating processes (water cycle etc.)" },
  { value: "hierarchy", label: "🏗️ Hierarchy",     hint: "Org charts, classification systems" },
  { value: "comparison",label: "⚖️ Comparison",    hint: "Compare options, approaches, features" },
];

const PALETTE = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a", dark: "#2563eb" },
  { bg: "#dcfce7", border: "#22c55e", text: "#14532d", dark: "#16a34a" },
  { bg: "#f3e8ff", border: "#a855f7", text: "#581c87", dark: "#9333ea" },
  { bg: "#fff7ed", border: "#f97316", text: "#7c2d12", dark: "#ea580c" },
  { bg: "#fce7f3", border: "#ec4899", text: "#831843", dark: "#db2777" },
  { bg: "#ccfbf1", border: "#14b8a6", text: "#134e4a", dark: "#0d9488" },
  { bg: "#fef9c3", border: "#eab308", text: "#713f12", dark: "#ca8a04" },
];

// ── Text utilities ────────────────────────────────────────────────────────────

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = String(text ?? "").trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine - 1) + "…" : word;
      if (lines.length >= maxLines - 1) {
        if (words.indexOf(word) < words.length - 1) current += "…";
        break;
      }
    } else {
      current = candidate.length > maxCharsPerLine ? candidate.slice(0, maxCharsPerLine - 1) + "…" : candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function renderWrappedText(
  x: number, cy: number, lines: string[],
  fontSize: number, fill: string, fontWeight = "600", anchor = "middle"
): string {
  const lh = fontSize + 4;
  const totalH = lines.length * lh;
  const startY = cy - (totalH / 2) + lh / 2;
  return lines
    .map((line, i) =>
      `<text x="${x}" y="${startY + i * lh}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" font-family="system-ui,sans-serif">${line}</text>`
    ).join("");
}

// ── FLOWCHART ─────────────────────────────────────────────────────────────────
function makeFlowchart(nodes: { id: string; label: string; type?: string }[], edges: { from: string; to: string; label?: string }[]): string {
  const NW = 200, NH = 62, HGAP = 260, VGAP = 110;
  // Topological layout: columns based on connectivity
  const inDeg = new Map<string, number>();
  nodes.forEach((n) => inDeg.set(n.id, 0));
  edges.forEach((e) => inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1));
  
  // BFS layer assignment
  const layers: string[][] = [];
  const visited = new Set<string>();
  const queue: string[] = nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (queue.length === 0 && nodes.length > 0) queue.push(nodes[0].id);
  
  while (queue.length > 0) {
    const layer: string[] = [...queue];
    queue.length = 0;
    layer.forEach((id) => {
      if (!visited.has(id)) {
        visited.add(id);
        edges.filter((e) => e.from === id).forEach((e) => {
          if (!visited.has(e.to)) queue.push(e.to);
        });
      }
    });
    if (layer.filter((id) => !visited.has(id) || layers.flat().includes(id)).length > 0 || layer.length > 0) {
      const newLayer = layer.filter((id, idx, arr) => arr.indexOf(id) === idx);
      if (newLayer.length > 0) layers.push(newLayer);
    }
  }
  // Add any unvisited nodes
  nodes.forEach((n) => { if (!visited.has(n.id)) layers.push([n.id]); });

  const maxPerRow = Math.max(...layers.map((l) => l.length), 1);
  const svgW = Math.max(500, maxPerRow * HGAP + 100);
  const svgH = layers.length * VGAP + 100;

  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, li) => {
    const rowW = layer.length * HGAP;
    const startX = (svgW - rowW) / 2 + HGAP / 2;
    layer.forEach((id, j) => {
      pos.set(id, { x: startX + j * HGAP, y: 60 + li * VGAP });
    });
  });

  // Marker defs
  let defs = `<defs>
    <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#6366f1"/>
    </marker>
    <filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.13"/></filter>
  </defs>`;

  let edgeSvg = "";
  const seen = new Set<string>();
  edges.forEach((e) => {
    const key = `${e.from}-${e.to}`;
    if (seen.has(key)) return; seen.add(key);
    const f = pos.get(e.from), t = pos.get(e.to);
    if (!f || !t) return;
    const sameX = Math.abs(f.x - t.x) < 5;
    let d: string;
    if (sameX) {
      d = `M${f.x},${f.y + NH / 2} L${t.x},${t.y - NH / 2}`;
    } else {
      const my = (f.y + t.y) / 2;
      d = `M${f.x},${f.y + NH / 2} C${f.x},${my} ${t.x},${my} ${t.x},${t.y - NH / 2}`;
    }
    edgeSvg += `<path d="${d}" fill="none" stroke="#6366f1" stroke-width="2" marker-end="url(#arr)"/>`;
    if (e.label) {
      const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
      edgeSvg += `<rect x="${mx - 22}" y="${my - 10}" width="44" height="18" rx="5" fill="white" opacity="0.95" stroke="#e2e8f0" stroke-width="1"/>`;
      edgeSvg += `<text x="${mx}" y="${my + 1}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#4b5563" font-family="system-ui,sans-serif">${String(e.label).slice(0, 12)}</text>`;
    }
  });

  let nodeSvg = "";
  nodes.forEach((n, i) => {
    const p = pos.get(n.id);
    if (!p) return;
    const c = PALETTE[i % PALETTE.length];
    const isStart = n.type === "start" || i === 0;
    const isEnd = n.type === "end" || i === nodes.length - 1;
    const isDec = n.type === "decision";

    const lines = wrapText(n.label, 18, 3);
    const lh = 14;
    const textH = lines.length * lh;
    const nodeH = Math.max(NH, textH + 24);

    if (isDec) {
      // Diamond shape
      const hw = NW / 2, hh = nodeH / 2 + 6;
      nodeSvg += `<polygon points="${p.x},${p.y - hh} ${p.x + hw},${p.y} ${p.x},${p.y + hh} ${p.x - hw},${p.y}" fill="${c.bg}" stroke="${c.border}" stroke-width="2.5" filter="url(#sh)"/>`;
    } else if (isStart || isEnd) {
      nodeSvg += `<rect x="${p.x - NW / 2}" y="${p.y - nodeH / 2}" width="${NW}" height="${nodeH}" rx="${nodeH / 2}" fill="${c.dark}" stroke="${c.border}" stroke-width="2.5" filter="url(#sh)"/>`;
    } else {
      nodeSvg += `<rect x="${p.x - NW / 2}" y="${p.y - nodeH / 2}" width="${NW}" height="${nodeH}" rx="10" fill="${c.bg}" stroke="${c.border}" stroke-width="2.5" filter="url(#sh)"/>`;
    }
    const fill = (isStart || isEnd) ? "white" : c.text;
    nodeSvg += renderWrappedText(p.x, p.y, lines, 12, fill);
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="${svgW}" height="${svgH}" fill="#f8fafc" rx="14"/>
  ${edgeSvg}
  <g>${nodeSvg}</g>
</svg>`;
}

// ── MIND MAP ──────────────────────────────────────────────────────────────────
function makeMindMap(center: string, branches: { label: string; items?: string[] }[]): string {
  const count = Math.min(branches.length, 7);
  const maxSubs = Math.max(...branches.slice(0, count).map((b) => (b.items ?? []).length), 0);
  const hasDeepSubs = maxSubs > 0;
  const svgW = hasDeepSubs ? 1100 : 900;
  const svgH = hasDeepSubs ? 780 : 640;
  const cx = svgW / 2, cy = svgH / 2;
  const branchR = hasDeepSubs ? 230 : 190;
  const subR = 145;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="#f0f4ff" rx="14"/>`;

  // Center
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="120" ry="55" fill="#4f46e5" stroke="#3730a3" stroke-width="3" filter="url(#sh)"/>`;
  const cLines = wrapText(center, 16, 2);
  svg += renderWrappedText(cx, cy, cLines, 13, "white", "700");

  branches.slice(0, count).forEach((branch, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const bx = cx + Math.cos(angle) * branchR;
    const by = cy + Math.sin(angle) * branchR;
    const c = PALETTE[i % PALETTE.length];

    // Line center→branch
    const lx1 = cx + Math.cos(angle) * 122;
    const ly1 = cy + Math.sin(angle) * 57;
    const lx2 = bx - Math.cos(angle) * 72;
    const ly2 = by - Math.sin(angle) * 30;
    svg += `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${c.border}" stroke-width="2.5"/>`;

    const bLines = wrapText(branch.label, 14, 2);
    const BH = Math.max(52, bLines.length * 16 + 16);
    svg += `<rect x="${bx - 72}" y="${by - BH / 2}" width="144" height="${BH}" rx="12" fill="${c.bg}" stroke="${c.border}" stroke-width="2.5" filter="url(#sh)"/>`;
    svg += renderWrappedText(bx, by, bLines, 11, c.text, "700");

    // Sub-items
    const items = (branch.items ?? []).slice(0, 4);
    items.forEach((item, j) => {
      const spread = items.length <= 1 ? 0 : (j - (items.length - 1) / 2) * 0.42;
      const sAngle = angle + spread;
      const sx = cx + Math.cos(sAngle) * (branchR + subR);
      const sy = cy + Math.sin(sAngle) * (branchR + subR);
      const sx2 = bx + Math.cos(sAngle) * 72;
      const sy2 = by + Math.sin(sAngle) * (BH / 2);
      const tx2 = sx - Math.cos(sAngle) * 54;
      const ty2 = sy - Math.sin(sAngle) * 18;
      svg += `<line x1="${sx2}" y1="${sy2}" x2="${tx2}" y2="${ty2}" stroke="${c.border}" stroke-width="1.5" opacity="0.7"/>`;
      const iLines = wrapText(item, 13, 2);
      const IH = Math.max(34, iLines.length * 14 + 12);
      svg += `<rect x="${sx - 54}" y="${sy - IH / 2}" width="108" height="${IH}" rx="8" fill="white" stroke="${c.border}" stroke-width="1.5"/>`;
      svg += renderWrappedText(sx, sy, iLines, 10, c.text, "500");
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-opacity="0.15"/></filter></defs>
  ${svg}
</svg>`;
}

// ── TIMELINE ──────────────────────────────────────────────────────────────────
function makeTimeline(events: { year: string; title: string; desc?: string }[]): string {
  const ROW_H = 100;
  const svgW = 860;
  const svgH = events.length * ROW_H + 80;
  const lineX = 155;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="#f8fafc" rx="14"/>
  <line x1="${lineX}" y1="30" x2="${lineX}" y2="${svgH - 20}" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>`;

  events.forEach((ev, i) => {
    const y = 50 + i * ROW_H;
    const c = PALETTE[i % PALETTE.length];

    // Dot
    svg += `<circle cx="${lineX}" cy="${y}" r="13" fill="${c.dark}" stroke="white" stroke-width="3"/>`;
    svg += `<text x="${lineX}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white" font-weight="700" font-family="system-ui,sans-serif">${i + 1}</text>`;

    // Year
    const yearLines = wrapText(String(ev.year ?? ""), 10, 2);
    svg += renderWrappedText(lineX - 18, y, yearLines, 11, c.dark, "700", "end");

    // Card
    const cardX = lineX + 26;
    const cardW = svgW - cardX - 24;
    const titleLines = wrapText(String(ev.title ?? ""), 42, 2);
    const descLines = ev.desc ? wrapText(String(ev.desc), 54, 2) : [];
    const cardH = Math.max(54, (titleLines.length + descLines.length) * 17 + 20);

    svg += `<rect x="${cardX}" y="${y - cardH / 2}" width="${cardW}" height="${cardH}" rx="10" fill="${c.bg}" stroke="${c.border}" stroke-width="1.8" filter="url(#sh)"/>`;

    const topY = ev.desc ? y - descLines.length * 9 : y;
    svg += renderWrappedText(cardX + 16, topY - (descLines.length > 0 ? 10 : 0), titleLines, 13, c.text, "700", "start");
    if (descLines.length > 0) {
      svg += renderWrappedText(cardX + 16, y + titleLines.length * 10 + 2, descLines, 11, "#64748b", "400", "start");
    }
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.12"/></filter></defs>
  ${svg}
</svg>`;
}

// ── CYCLE DIAGRAM ─────────────────────────────────────────────────────────────
function makeCycle(steps: { label: string; desc?: string }[]): string {
  const count = Math.min(steps.length, 7);
  const svgW = 760, svgH = 720;
  const cx = svgW / 2, cy = svgH / 2;
  const R = 230;
  const nodeRx = 78, nodeRy = 46;

  let defs = `<defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-opacity="0.13"/></filter>`;
  PALETTE.slice(0, count).forEach((c, i) => {
    defs += `<marker id="ca${i}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0,9 3.5,0 7" fill="${c.border}"/></marker>`;
  });
  defs += "</defs>";

  let svg = `<rect width="${svgW}" height="${svgH}" fill="#fafbff" rx="14"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8,5"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="58" fill="white" stroke="#e2e8f0" stroke-width="2"/>`;
  svg += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#6366f1" font-family="system-ui,sans-serif">Cycle</text>`;
  svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#94a3b8" font-family="system-ui,sans-serif">Diagram</text>`;

  const positions = steps.slice(0, count).map((_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R, angle };
  });

  positions.forEach((p, i) => {
    const next = positions[(i + 1) % count];
    const c = PALETTE[i % PALETTE.length];

    // Arc arrow
    const midAngle = (p.angle + next.angle) / 2;
    const cpx = cx + Math.cos(midAngle) * (R + 35);
    const cpy = cy + Math.sin(midAngle) * (R + 35);
    svg += `<path d="M${p.x} ${p.y} Q${cpx} ${cpy} ${next.x} ${next.y}" fill="none" stroke="${c.border}" stroke-width="2.5" marker-end="url(#ca${i})"/>`;

    // Node
    svg += `<ellipse cx="${p.x}" cy="${p.y}" rx="${nodeRx}" ry="${nodeRy}" fill="${c.bg}" stroke="${c.border}" stroke-width="2.5" filter="url(#sh)"/>`;

    // Badge
    const bx = p.x + nodeRx * 0.65, by = p.y - nodeRy * 0.65;
    svg += `<circle cx="${bx}" cy="${by}" r="13" fill="${c.dark}" stroke="white" stroke-width="2"/>`;
    svg += `<text x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="white" font-family="system-ui,sans-serif">${i + 1}</text>`;

    const lines = wrapText(steps[i].label, 11, 2);
    svg += renderWrappedText(p.x, p.y, lines, 11, c.text, "700");
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">${defs}${svg}</svg>`;
}

// ── HIERARCHY ─────────────────────────────────────────────────────────────────
function makeHierarchy(root: string, children: { label: string; children?: string[] }[]): string {
  const cols = Math.min(children.length, 5);
  const maxSubs = Math.max(...children.map((c) => (c.children ?? []).length), 0);
  const COL_W = 175;
  const svgW = Math.max(720, cols * COL_W + 100);
  const svgH = maxSubs > 0 ? 330 : 210;
  const cx = svgW / 2;
  const NW = 160, NH = 50;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="#f8fafc" rx="14"/>`;

  // Root
  const rootLines = wrapText(root, 16, 2);
  svg += `<rect x="${cx - NW / 2}" y="16" width="${NW}" height="${NH}" rx="12" fill="#4f46e5" stroke="#3730a3" stroke-width="2.5" filter="url(#sh)"/>`;
  svg += renderWrappedText(cx, 16 + NH / 2, rootLines, 12, "white", "700");

  const totalW = cols * COL_W;
  const startX = cx - totalW / 2 + COL_W / 2;

  // Horizontal connector
  if (cols > 1) {
    svg += `<line x1="${startX}" y1="100" x2="${startX + (cols - 1) * COL_W}" y2="100" stroke="#c7d2fe" stroke-width="2"/>`;
  }

  children.slice(0, cols).forEach((child, i) => {
    const bx = startX + i * COL_W;
    const by = 78;
    const c = PALETTE[i % PALETTE.length];

    svg += `<line x1="${cx}" y1="${16 + NH}" x2="${bx}" y2="${by}" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="5,3"/>`;

    const bLines = wrapText(child.label, 14, 2);
    const BH = Math.max(NH, bLines.length * 16 + 16);
    svg += `<rect x="${bx - NW / 2}" y="${by}" width="${NW}" height="${BH}" rx="10" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#sh)"/>`;
    svg += renderWrappedText(bx, by + BH / 2, bLines, 11, c.text, "600");

    const subs = (child.children ?? []).slice(0, 4);
    const subCount = subs.length;
    const subSpan = subCount * 100;
    subs.forEach((gc, j) => {
      const gcx = bx - subSpan / 2 + j * (subSpan / Math.max(subCount - 1, 1));
      const gcy = by + BH + 52;
      svg += `<line x1="${bx}" y1="${by + BH}" x2="${gcx}" y2="${gcy}" stroke="${c.border}" stroke-width="1.4" opacity="0.8"/>`;
      const gcLines = wrapText(gc, 12, 2);
      const GH = Math.max(36, gcLines.length * 14 + 12);
      svg += `<rect x="${gcx - 46}" y="${gcy}" width="92" height="${GH}" rx="7" fill="white" stroke="${c.border}" stroke-width="1.5"/>`;
      svg += renderWrappedText(gcx, gcy + GH / 2, gcLines, 10, c.text, "500");
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-opacity="0.12"/></filter></defs>
  ${svg}
</svg>`;
}

// ── COMPARISON ────────────────────────────────────────────────────────────────
function makeComparison(items: { name: string; points: string[] }[]): string {
  const cols = Math.min(items.length, 3);
  const COL_W = 250;
  const HDR_H = 66;
  const maxPts = Math.max(...items.map((it) => it.points.length), 3);
  const ROW_H = 52;
  const PAD = 20;
  const svgW = cols * COL_W + PAD * 2 + (cols - 1) * 12;
  const svgH = HDR_H + maxPts * ROW_H + PAD * 2 + 30;

  let svg = `<rect width="${svgW}" height="${svgH}" fill="#f8fafc" rx="14"/>`;

  items.slice(0, cols).forEach((item, i) => {
    const x = PAD + i * (COL_W + 12);
    const c = PALETTE[i % PALETTE.length];

    const nameLines = wrapText(item.name, 18, 2);
    svg += `<rect x="${x}" y="${PAD}" width="${COL_W}" height="${HDR_H}" rx="12" fill="${c.dark}"/>`;
    svg += renderWrappedText(x + COL_W / 2, PAD + HDR_H / 2, nameLines, 13, "white", "700");

    const pts = [...item.points.slice(0, maxPts)];
    while (pts.length < maxPts) pts.push("");
    pts.forEach((pt, j) => {
      const py = PAD + HDR_H + 8 + j * ROW_H;
      const isEven = j % 2 === 0;
      svg += `<rect x="${x}" y="${py}" width="${COL_W}" height="${ROW_H - 5}" rx="8" fill="${isEven ? c.bg : "white"}" stroke="${c.border}" stroke-width="1.2"/>`;
      if (pt) {
        svg += `<text x="${x + 28}" y="${py + 14}" dominant-baseline="middle" font-size="11" fill="${c.dark}" font-weight="700" font-family="system-ui,sans-serif">✓</text>`;
        const ptLines = wrapText(pt, 22, 2);
        svg += renderWrappedText(x + 42, py + (ROW_H - 5) / 2, ptLines, 10, c.text, "500", "start");
      }
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

// ── Main component ────────────────────────────────────────────────────────────
const ImageGenerator = () => {
  const navigate = useNavigate();
  const [theory, setTheory] = useState("");
  const [diagramType, setDiagramType] = useState("flowchart");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);

  const SYS = `You are an expert diagram data extractor. Return ONLY valid JSON. Zero markdown fences. Zero text outside the JSON. Keep node labels concise (2-5 words max). Sub-items/descriptions can be up to 50 chars. Use ACCURATE content from the topic — no generic placeholders.`;

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
      let svg = "";

      const prompts: Record<string, string> = {
        flowchart: `Create an accurate FLOWCHART for: "${trimmed}"\nReturn JSON: {"nodes":[{"id":"1","label":"Short Label","type":"start"},{"id":"2","label":"Short Label","type":"process"},{"id":"3","label":"Decision?","type":"decision"},{"id":"4","label":"Yes Result","type":"process"},{"id":"5","label":"No Result","type":"process"},{"id":"6","label":"End","type":"end"}],"edges":[{"from":"1","to":"2"},{"from":"2","to":"3"},{"from":"3","to":"4","label":"Yes"},{"from":"3","to":"5","label":"No"},{"from":"4","to":"6"},{"from":"5","to":"6"}]}\nRULES: 5-8 nodes. Include a decision if logical. Labels MAX 4 words each. type: start|process|decision|end. Replace all placeholders with accurate labels from the topic.`,
        mindmap: `Create an accurate MIND MAP for: "${trimmed}"\nReturn JSON: {"center":"Core Topic","branches":[{"label":"Aspect 1","items":["fact","fact","fact"]},{"label":"Aspect 2","items":["fact","fact","fact"]},{"label":"Aspect 3","items":["fact","fact","fact"]},{"label":"Aspect 4","items":["fact","fact"]},{"label":"Aspect 5","items":["fact","fact"]}]}\nRULES: 4-6 branches. 2-4 items each. Branch labels 2-3 words. Items max 5 words. All content accurate.`,
        timeline: `Create an accurate TIMELINE for: "${trimmed}"\nReturn JSON: {"events":[{"year":"Period/Year","title":"Event Name","desc":"Brief accurate description max 50 chars"},...]}\nRULES: 5-8 events in chronological order. Title 2-4 words. Year can be a phase label. All content accurate.`,
        cycle: `Create an accurate CYCLE DIAGRAM for: "${trimmed}"\nReturn JSON: {"steps":[{"label":"Step Name","desc":"What happens, max 45 chars"},...]}\nRULES: 4-6 steps forming a CLOSED LOOP. Labels 2-3 words. Correct order. All accurate.`,
        hierarchy: `Create an accurate HIERARCHY for: "${trimmed}"\nReturn JSON: {"root":"Top Concept","children":[{"label":"Category 1","children":["item","item","item"]},{"label":"Category 2","children":["item","item","item"]},{"label":"Category 3","children":["item","item"]},{"label":"Category 4","children":["item","item"]}]}\nRULES: 3-5 categories. 2-4 leaf items. All names specific and accurate. Max 3 words per label.`,
        comparison: `Create an accurate COMPARISON for: "${trimmed}"\nReturn JSON: {"items":[{"name":"Option A","points":["point","point","point","point","point"]},{"name":"Option B","points":["point","point","point","point","point"]},{"name":"Option C","points":["point","point","point","point","point"]}]}\nRULES: 2-3 real options from the topic. Exactly 5 points each. Max 25 chars per point. Highlight real differences.`,
      };

      const validators: Record<string, (d: any) => boolean> = {
        flowchart: (d) => Array.isArray(d.nodes) && d.nodes.length >= 3 && Array.isArray(d.edges),
        mindmap: (d) => typeof d.center === "string" && Array.isArray(d.branches) && d.branches.length >= 3,
        timeline: (d) => Array.isArray(d.events) && d.events.length >= 3,
        cycle: (d) => Array.isArray(d.steps) && d.steps.length >= 3,
        hierarchy: (d) => typeof d.root === "string" && Array.isArray(d.children) && d.children.length >= 2,
        comparison: (d) => Array.isArray(d.items) && d.items.length >= 2,
      };

      const makers: Record<string, (d: any) => string> = {
        flowchart: (d) => makeFlowchart(d.nodes, d.edges),
        mindmap: (d) => makeMindMap(d.center, d.branches),
        timeline: (d) => makeTimeline(d.events),
        cycle: (d) => makeCycle(d.steps),
        hierarchy: (d) => makeHierarchy(d.root, d.children),
        comparison: (d) => makeComparison(d.items),
      };

      const raw = await callAI(prompts[diagramType], SYS, 0.2, 1400);
      const j = safeParseJSON(raw);
      if (!validators[diagramType](j)) throw new Error("AI returned incomplete data. Please try again.");
      svg = makers[diagramType](j);

      setSvgContent(svg);
      toast.success("Diagram generated!");
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `diagram-${diagramType}.svg` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 text-center rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-6 border border-border/50 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-2 text-primary">
            <ImageIcon className="w-7 h-7" />
            <h1 className="text-2xl md:text-3xl font-bold">Theory to Visual</h1>
          </div>
          <p className="text-sm text-muted-foreground">Transform study notes into beautiful AI-generated diagrams.</p>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <Card className="shadow-md flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <CardTitle className="text-lg">Your Theory</CardTitle>
              </div>
              <CardDescription className="text-xs pt-1">Describe the concept you want to visualise.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <Textarea
                placeholder="e.g. The water cycle: evaporation → condensation → precipitation → runoff → back to ocean"
                className="h-[180px] text-sm resize-none"
                value={theory}
                onChange={(e) => setTheory(e.target.value)}
                disabled={isLoading}
              />
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Diagram Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {DIAGRAM_TYPES.map((dt) => (
                    <button key={dt.value} onClick={() => setDiagramType(dt.value)} title={dt.hint}
                      className={`px-2 py-2 rounded-xl border-2 text-xs font-semibold transition ${
                        diagramType === dt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40 text-muted-foreground"
                      }`}>
                      {dt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {DIAGRAM_TYPES.find((d) => d.value === diagramType)?.hint}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
                onClick={handleGenerate} disabled={isLoading || !theory.trim()}>
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                  : <><Sparkles className="w-4 h-4 mr-2" />Generate Diagram</>}
              </Button>
              {svgContent && !isLoading && (
                <Button variant="outline" onClick={() => { setSvgContent(null); setZoom(1); }} title="Reset">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Output panel */}
          <Card className={`shadow-md flex flex-col ${isFullscreen ? "fixed inset-4 z-50 m-0" : ""}`}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Generated Diagram</CardTitle>
                <CardDescription className="text-xs">AI-generated SVG — fully coloured and structured.</CardDescription>
              </div>
              <div className="flex gap-1.5 items-center">
                {svgContent && !isLoading && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} title="Zoom out" className="h-8 w-8 p-0">
                      <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} title="Zoom in" className="h-8 w-8 p-0">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setZoom(1)} title="Reset zoom" className="h-8 px-2 text-xs">
                      1:1
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsFullscreen((f) => !f)} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} className="h-8 w-8 p-0">
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 px-2.5">
                      <Download className="w-3.5 h-3.5 mr-1" />SVG
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-grow flex items-start justify-center p-3 min-h-[380px] overflow-hidden">
              <div ref={diagramRef}
                className="w-full h-full bg-muted/40 rounded-xl flex items-start justify-center overflow-auto border border-dashed border-border/50 min-h-[360px] p-2">
                {svgContent && !isLoading && (
                  <div
                    className="transition-transform duration-200 w-full"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />
                )}
                {isLoading && (
                  <div className="text-center p-4 flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Creating your diagram…</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Analysing content and building visuals</p>
                  </div>
                )}
                {!svgContent && !isLoading && (
                  <div className="text-center p-4 flex flex-col items-center justify-center h-full">
                    <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-muted-foreground">Your diagram will appear here</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Select a type and click Generate</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card className="mt-6 border-l-4 border-blue-400 bg-blue-50/50">
          <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <CardTitle className="text-sm font-semibold text-blue-800">Tips for best results</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ul className="space-y-1 text-xs text-blue-700 list-disc list-inside">
              <li><strong>Flowchart</strong>: Use for processes, algorithms, decision trees (e.g. "login process", "sorting algorithm")</li>
              <li><strong>Mind Map</strong>: Use for concepts with multiple sub-topics (e.g. "AI in healthcare", "climate change causes")</li>
              <li><strong>Timeline</strong>: Use for historical events, project phases (e.g. "history of computing", "SDLC phases")</li>
              <li><strong>Cycle</strong>: Use for repeating processes (e.g. "water cycle", "agile sprint cycle", "business cycle")</li>
              <li><strong>Hierarchy</strong>: Use for org charts, classification systems (e.g. "OS types", "company structure")</li>
              <li><strong>Comparison</strong>: Use to compare options/features (e.g. "SQL vs NoSQL", "React vs Vue vs Angular")</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ImageGenerator;

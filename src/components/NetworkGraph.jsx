import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { P } from '../styles/theme';
import { RELATIONSHIP_TYPES } from '../data/constants';

export const NetworkGraph = forwardRef(function NetworkGraph({
  network,
  companyColors,
  showCompanyLinks,
  allCompanyLinks,
  dimRelationships,
  linkingMode,
  onCompanyClick,
  onContactClick,
  setSelectedContact,
  userCompanyColor,
  focusNode,
  selectedCompany,
  showRelationshipLabels,
  showContactDots,
  showContactLines,
  showCompanyText,
}, ref) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);
  const nodesRef = useRef(null);
  const contactDotsRef = useRef(null);
  const gRef = useRef(null);
  const companyGroupsRef = useRef(null);
  const contactLinksRef = useRef(null);
  const companyLinksRef = useRef(null);
  const companyLinkLabelRef = useRef(null);
  const companyLinkLabelBgRef = useRef(null);
  const userBubbleRef = useRef(null);
  const selectedCompanyRef = useRef(null);
  selectedCompanyRef.current = selectedCompany;
  const showRelationshipLabelsRef = useRef(showRelationshipLabels);
  showRelationshipLabelsRef.current = showRelationshipLabels;
  const showContactDotsRef = useRef(showContactDots);
  showContactDotsRef.current = showContactDots;
  const showContactLinesRef = useRef(showContactLines);
  showContactLinesRef.current = showContactLines;
  const showCompanyTextRef = useRef(showCompanyText);
  showCompanyTextRef.current = showCompanyText;
  const contactGroupRef = useRef(null);
  const contactLinkGroupRef = useRef(null);
  const minimapRef = useRef(null);
  const minimapInfoRef = useRef(null);
  const getCompanyRadiusRef = useRef(null);
  const drawMinimapRef = useRef(null);
  const agarActiveRef = useRef(false);
  const agarCellPosRef = useRef(null);
  const agarEatenRef = useRef(null);

  useImperativeHandle(ref, () => ({
    zoomToFit: () => {
      const nodes = nodesRef.current;
      const svg = svgRef.current;
      const zoom = zoomRef.current;
      if (!nodes || !svg || !zoom || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        if (n.x == null || n.y == null) return;
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x);
        maxY = Math.max(maxY, n.y);
      });
      if (!isFinite(minX)) return;
      const pad = 80;
      const bw = (maxX - minX) + pad * 2;
      const bh = (maxY - minY) + pad * 2;
      const scale = Math.min(w / bw, h / bh, 2);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const t = d3.zoomIdentity.translate(w / 2, h / 2).scale(scale).translate(-cx, -cy);
      d3.select(svg).transition().duration(600).call(zoom.transform, t);
    },
    centerOnCompany: () => {
      const nodes = nodesRef.current;
      const svg = svgRef.current;
      const zoom = zoomRef.current;
      if (!nodes || !svg || !zoom || !containerRef.current) return;
      const userNode = nodes.find(n => n.type === "company" && n.isUserCompany);
      if (!userNode || userNode.x == null) return;
      const rect = containerRef.current.getBoundingClientRect();
      const t = d3.zoomIdentity.translate(rect.width / 2, rect.height / 2).scale(1).translate(-userNode.x, -userNode.y);
      d3.select(svg).transition().duration(600).call(zoom.transform, t);
    },
    getSvgElement: () => svgRef.current,
  }));

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    if (!width) return;

    // Resolved color for user's company (custom or default accent)
    const ucColor = userCompanyColor || P.accent;

    // Stop any existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    // Basic glow for c-level contacts etc.
    const glow = defs.append("filter").attr("id", "gl");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "b");
    const fm = glow.append("feMerge");
    fm.append("feMergeNode").attr("in", "b");
    fm.append("feMergeNode").attr("in", "SourceGraphic");

    // Sun glow for user's company — large soft corona
    const sunGlow = defs.append("filter").attr("id", "sun-glow")
      .attr("x", "-400%").attr("y", "-400%").attr("width", "900%").attr("height", "900%");
    sunGlow.append("feGaussianBlur").attr("stdDeviation", "18").attr("result", "b1");
    sunGlow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "6").attr("result", "b2");
    const sfm = sunGlow.append("feMerge");
    sfm.append("feMergeNode").attr("in", "b1");
    sfm.append("feMergeNode").attr("in", "b2");
    sfm.append("feMergeNode").attr("in", "SourceGraphic");

    // Glow filter for hovered relationship lines
    const linkGlow = defs.append("filter").attr("id", "link-glow")
      .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    linkGlow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "b");
    const lgm = linkGlow.append("feMerge");
    lgm.append("feMergeNode").attr("in", "b");
    lgm.append("feMergeNode").attr("in", "SourceGraphic");

    // Radial gradient for sun core
    const sunGrad = defs.append("radialGradient").attr("id", "sun-gradient");
    sunGrad.append("stop").attr("offset", "0%").attr("stop-color", ucColor).attr("stop-opacity", 0.35);
    sunGrad.append("stop").attr("offset", "30%").attr("stop-color", ucColor).attr("stop-opacity", 0.18);
    sunGrad.append("stop").attr("offset", "60%").attr("stop-color", ucColor).attr("stop-opacity", 0.07);
    sunGrad.append("stop").attr("offset", "100%").attr("stop-color", ucColor).attr("stop-opacity", 0);

    // Planet shading gradient — 3D sphere illusion (light from upper-left)
    const planetShade = defs.append("radialGradient").attr("id", "planet-shade")
      .attr("cx", "30%").attr("cy", "30%").attr("r", "70%");
    planetShade.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.18);
    planetShade.append("stop").attr("offset", "40%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.04);
    planetShade.append("stop").attr("offset", "100%").attr("stop-color", "#000000").attr("stop-opacity", 0.3);

    // Black hole gradient — dark void center
    const bhGrad = defs.append("radialGradient").attr("id", "bh-gradient");
    bhGrad.append("stop").attr("offset", "0%").attr("stop-color", "#000000").attr("stop-opacity", 1);
    bhGrad.append("stop").attr("offset", "50%").attr("stop-color", "#05000D").attr("stop-opacity", 0.95);
    bhGrad.append("stop").attr("offset", "80%").attr("stop-color", "#1a0030").attr("stop-opacity", 0.5);
    bhGrad.append("stop").attr("offset", "100%").attr("stop-color", "#7C3AED").attr("stop-opacity", 0);

    // Black hole glow filter
    const bhGlow = defs.append("filter").attr("id", "bh-glow")
      .attr("x", "-150%").attr("y", "-150%").attr("width", "400%").attr("height", "400%");
    bhGlow.append("feGaussianBlur").attr("stdDeviation", "6").attr("result", "b");
    const bhm = bhGlow.append("feMerge");
    bhm.append("feMergeNode").attr("in", "b");
    bhm.append("feMergeNode").attr("in", "SourceGraphic");

    // Accretion disk gradient
    const diskGrad = defs.append("linearGradient").attr("id", "bh-disk-grad")
      .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
    diskGrad.append("stop").attr("offset", "0%").attr("stop-color", "#7C3AED").attr("stop-opacity", 0);
    diskGrad.append("stop").attr("offset", "25%").attr("stop-color", "#A855F7").attr("stop-opacity", 0.7);
    diskGrad.append("stop").attr("offset", "50%").attr("stop-color", "#E9D5FF").attr("stop-opacity", 1);
    diskGrad.append("stop").attr("offset", "75%").attr("stop-color", "#A855F7").attr("stop-opacity", 0.7);
    diskGrad.append("stop").attr("offset", "100%").attr("stop-color", "#7C3AED").attr("stop-opacity", 0);

    // Corona classes (used for zoom-based opacity control, no CSS animation)
    // + animated dash offset for inferred connections
    // + black hole accretion disk rotation
    svg.append("style").text(`
      .sun-corona, .sun-corona-outer { transition: opacity 0.3s ease; }
      @keyframes link-flow { to { stroke-dashoffset: -24; } }
      @keyframes inferred-flow { to { stroke-dashoffset: -16; } }
      .company-link-flow { animation: link-flow 2s linear infinite; }
      .company-link-inferred { animation: inferred-flow 1.5s linear infinite; }
      @keyframes bh-spin { to { stroke-dashoffset: -40; } }
      .bh-ring { animation: bh-spin 3s linear infinite; }
      @keyframes sun-orbit { to { stroke-dashoffset: -50; } }
      @keyframes sun-orbit-rev { to { stroke-dashoffset: 60; } }
      @keyframes sun-pulse { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
      .sun-orbit-1 { animation: sun-orbit 6s linear infinite; }
      .sun-orbit-2 { animation: sun-orbit-rev 10s linear infinite; }
      .sun-pulse { animation: sun-pulse 4s ease-in-out infinite; }
      .selected-orbit-1 { animation: sun-orbit 8s linear infinite; }
      .selected-orbit-2 { animation: sun-orbit-rev 12s linear infinite; }
    `);

    // Arrow markers for company-to-company links
    const arrowTypes = {
      lead: { color: "#F59E0B", bidir: false },
      customer: { color: "#00E5A0", bidir: false },
      partner: { color: "#8B5CF6", bidir: true },
      investor: { color: "#3B82F6", bidir: false },
      competitor: { color: "#EF4444", bidir: true },
      inferred: { color: "#64748B", bidir: false },
    };
    const baseMarkerSize = 18;
    Object.entries(arrowTypes).forEach(([type, { color }]) => {
      const marker = defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8).attr("refY", 0)
        .attr("markerWidth", baseMarkerSize).attr("markerHeight", baseMarkerSize)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto");
      marker.append("path")
        .attr("d", "M0,-3 Q5,-3 10,0 Q5,3 0,3 Q1.5,0 0,-3 Z")
        .attr("fill", color);
      // Reverse arrow for bidirectional
      const markerRev = defs.append("marker")
        .attr("id", `arrow-${type}-rev`)
        .attr("viewBox", "-10 -5 10 10")
        .attr("refX", -8).attr("refY", 0)
        .attr("markerWidth", baseMarkerSize).attr("markerHeight", baseMarkerSize)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto");
      markerRev.append("path")
        .attr("d", "M0,-3 Q-5,-3 -10,0 Q-5,3 0,3 Q-1.5,0 0,-3 Z")
        .attr("fill", color);
    });

    const g = svg.append("g");
    gRef.current = g;
    let currentZoomScale = 1;
    let cullFrame = null;
    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", e => {
      g.attr("transform", e.transform);
      const prevScale = currentZoomScale;
      currentZoomScale = e.transform.k;
      if (prevScale !== currentZoomScale) {
        // Scale corona/glow intensity with zoom — bigger glow when zoomed out, subtle when zoomed in
        const glowOpacity = Math.max(0.1, Math.min(1, (1.8 - currentZoomScale) / 1.2));
        g.selectAll(".sun-corona, .sun-corona-outer").style("opacity", glowOpacity);
        g.selectAll(".sun-glow-bubble").attr("filter", currentZoomScale < 2.5 ? "url(#sun-glow)" : "none");
        // Expand sun corona/orbit radius when zoomed out so it fills more of the canvas
        const coronaBoost = Math.max(1, 1 / Math.pow(currentZoomScale, 0.6));
        g.selectAll(".sun-scalable").each(function() {
          const el = d3.select(this);
          const baseR = +el.attr("data-base-r");
          if (baseR) el.attr("r", baseR * coronaBoost);
        });
        // Scale arrow markers + stroke widths inversely with zoom for consistent screen size
        const scaleFactor = 1 / Math.sqrt(currentZoomScale);
        const markerSize = baseMarkerSize * scaleFactor;
        defs.selectAll("marker").attr("markerWidth", markerSize).attr("markerHeight", markerSize);
        g.selectAll(".company-link-visible").each(function(d) {
          const base = 2 + (d.strength || 0.5) * 2;
          d3.select(this).attr("stroke-width", base * scaleFactor);
        });
      }
      // Viewport culling — debounced to avoid running every frame during fast pan
      if (cullFrame) cancelAnimationFrame(cullFrame);
      cullFrame = requestAnimationFrame(() => {
        cullViewport(e.transform);
        drawMinimap(e.transform);
      });
    });
    svg.call(zoom);
    // Initial generous bounds; tightened by drawMinimap once nodes have positions
    zoom.translateExtent([[-width, -height], [width * 2, height * 2]]);
    zoomRef.current = zoom;

    // Viewport culling: hide elements outside the visible screen for performance
    const cullViewport = (transform) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const k = transform.k;
      const tx = transform.x;
      const ty = transform.y;
      // Viewport bounds in world (simulation) coordinates, with margin
      const margin = 200;
      const vx0 = (-tx - margin) / k;
      const vy0 = (-ty - margin) / k;
      const vx1 = (r.width - tx + margin) / k;
      const vy1 = (r.height - ty + margin) / k;

      const inView = (x, y) => x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;

      // Cull company groups
      if (companyGroupsRef.current) {
        companyGroupsRef.current.each(function(d) {
          this.style.display = (d.x != null && inView(d.x, d.y)) ? "" : "none";
        });
      }
      // Cull contact dots
      if (contactDotsRef.current && showContactDotsRef.current) {
        contactDotsRef.current.each(function(d) {
          this.style.display = (d.x != null && inView(d.x, d.y)) ? "" : "none";
        });
      }
    };

    // Minimap: draw company dots + viewport rect on canvas
    const mmW = 260, mmH = 180;
    const drawMinimap = (transform) => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const ns = nodesRef.current;
      if (!ns || ns.length === 0) return;

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== mmW * dpr) {
        canvas.width = mmW * dpr;
        canvas.height = mmH * dpr;
      }

      const ctx = canvas.getContext('2d');

      // Compute world bounds from company nodes
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of ns) {
        if (n.x == null || n.type !== 'company') continue;
        x0 = Math.min(x0, n.x);
        y0 = Math.min(y0, n.y);
        x1 = Math.max(x1, n.x);
        y1 = Math.max(y1, n.y);
      }
      if (!isFinite(x0)) return;

      const pad = 300;
      x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;

      // Constrain panning to world bounds
      zoom.translateExtent([[x0, y0], [x1, y1]]);

      const bw = x1 - x0;
      const bh = y1 - y0;
      const sc = Math.min(mmW / bw, mmH / bh);
      const offX = (mmW - bw * sc) / 2;
      const offY = (mmH - bh * sc) / 2;

      minimapInfoRef.current = { x0, y0, scale: sc, offsetX: offX, offsetY: offY };

      ctx.clearRect(0, 0, mmW * dpr, mmH * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Build connected map: company ID → relationship color for minimap
      const sel = selectedCompanyRef.current;
      let connectedMap = null; // Map<id, color>
      if (sel) {
        connectedMap = new Map();
        connectedMap.set(sel.id, null); // selected company itself, no relation color
        allCompanyLinks.forEach(l => {
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const relColor = (l.type && RELATIONSHIP_TYPES[l.type]) ? RELATIONSHIP_TYPES[l.type].color : P.purple;
          if (sId === sel.id && !connectedMap.has(tId)) connectedMap.set(tId, relColor);
          if (tId === sel.id && !connectedMap.has(sId)) connectedMap.set(sId, relColor);
        });
      }

      // Company dots
      const eatenIds = agarEatenRef.current;
      for (const n of ns) {
        if (n.x == null || n.type !== 'company') continue;
        if (eatenIds && eatenIds.has(n.id)) continue;
        if (agarActiveRef.current && n.isUserCompany) continue; // agar cell dot replaces this
        const x = (n.x - x0) * sc + offX;
        const y = (n.y - y0) * sc + offY;
        const dimmed = connectedMap && !n.isUserCompany && !connectedMap.has(n.id);
        ctx.globalAlpha = dimmed ? 0.15 : 1;
        if (n.name === 'Unbekannt') {
          // Black hole glow
          const grad = ctx.createRadialGradient(x, y, 0, x, y, 7);
          grad.addColorStop(0, '#7C3AED60');
          grad.addColorStop(0.5, '#7C3AED25');
          grad.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // Dark core
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#0a0010';
          ctx.fill();
          // Purple ring
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#A855F7';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (n.isUserCompany) {
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = userCompanyColor || P.accent;
          ctx.fill();
        } else {
          const isSelected = sel && n.id === sel.id;
          const relColor = connectedMap ? connectedMap.get(n.id) : null;
          const dotColor = relColor || (companyColors[n.id] || P.accent);
          // Connected companies get relation-colored dots; selected gets larger
          ctx.beginPath();
          ctx.arc(x, y, isSelected ? 3 : (relColor ? 2.5 : 1.5), 0, Math.PI * 2);
          ctx.fillStyle = dotColor + (isSelected || relColor ? 'FF' : '90');
          ctx.fill();
          // Selection ring around selected company
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.strokeStyle = dotColor;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Agar cell dot on minimap
      const cellPos = agarCellPosRef.current;
      if (cellPos && agarActiveRef.current) {
        const cx = (cellPos.x - x0) * sc + offX;
        const cy = (cellPos.y - y0) * sc + offY;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
        grad.addColorStop(0, (userCompanyColor || P.accent));
        grad.addColorStop(0.5, (userCompanyColor || P.accent) + '80');
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = userCompanyColor || P.accent;
        ctx.fill();
      }

      // Viewport rectangle
      const k = transform.k;
      const cr = containerRef.current?.getBoundingClientRect();
      if (cr) {
        const vx = (-transform.x / k - x0) * sc + offX;
        const vy = (-transform.y / k - y0) * sc + offY;
        const vw = (cr.width / k) * sc;
        const vh = (cr.height / k) * sc;
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vx, vy, vw, vh);
        ctx.fillStyle = P.accent + '15';
        ctx.fillRect(vx, vy, vw, vh);
      }

      ctx.restore();
    };
    drawMinimapRef.current = drawMinimap;

    const allNodes = [
      ...network.companyNodes,
      ...network.contactNodes
    ];
    const idSet = new Set(allNodes.map(n => n.id));
    const allLinks = network.links.filter(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      return idSet.has(s) && idSet.has(t);
    });

    const nodes = allNodes.map(d => ({ ...d }));
    nodesRef.current = nodes;
    const links = allLinks.map(d => ({ ...d }));

    // Find user's company node and fix it at center
    const userCompanyNode = nodes.find(n => n.type === "company" && n.isUserCompany);
    if (userCompanyNode) {
      userCompanyNode.fx = width / 2;
      userCompanyNode.fy = height / 2;
    }

    // Performance: adjust for large networks
    const isLargeNetwork = nodes.length > 200;
    // (thresholds removed — contact dots/lines now controlled by toolbar toggles)

    // Compute radius scaling from actual company data
    const companyDataNodes = nodes.filter(n => n.type === "company" && !n.isUserCompany);
    const sizes = companyDataNodes.map(n => Math.max(n.estimatedSize || 100, 10));
    const minSize = Math.log10(Math.min(...sizes, 10));
    const maxSize = Math.log10(Math.max(...sizes, 100));
    const sizeRange = maxSize - minSize || 1;
    const canvasScale = Math.min(width, height);
    const minR = canvasScale / (isLargeNetwork ? 120 : 80);
    const maxR = canvasScale / (isLargeNetwork ? 12 : 8);

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(isLargeNetwork ? 60 : 80))
      .force("charge", d3.forceManyBody().strength(d => {
        if (d.type === "company") {
          // Charge proportional to radius squared for consistent spacing
          const r = d.isUserCompany ? maxR * 0.55 : (() => {
            const size = Math.max(d.estimatedSize || 100, 10);
            const t = Math.max(0, Math.min(1, (Math.log10(size) - minSize) / sizeRange));
            return minR + Math.pow(t, 0.6) * (maxR - minR);
          })();
          return -r * r * 0.15;
        }
        if (d.isUser) return isLargeNetwork ? -40 : -60;
        return isLargeNetwork ? -20 : -40;
      }))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => {
        if (d.type === "company") {
          // Approximate getCompanyRadius + padding (exact values computed after sim init)
          if (d.isUserCompany) return canvasScale / (isLargeNetwork ? 20 : 15) + 5;
          const size = Math.max(d.estimatedSize || 100, 10);
          const cMinR = canvasScale / (isLargeNetwork ? 120 : 80);
          const cMaxR = canvasScale / (isLargeNetwork ? 12 : 8);
          const t = Math.max(0, Math.min(1, (Math.log10(size) - minSize) / sizeRange));
          return cMinR + Math.pow(t, 0.6) * (cMaxR - cMinR) + 5;
        }
        if (d.isUser) return isLargeNetwork ? 18 : 22;
        return isLargeNetwork ? 4 + (d.normalizedInfluence || 0) * 5 : 6 + (d.normalizedInfluence || 0) * 8;
      }))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03))
      .alphaDecay(isLargeNetwork ? 0.05 : 0.02);

    simulationRef.current = sim;

    // Easter egg: hold timer integrated into drag (D3 drag intercepts mousedown)
    let agarHoldTimer = null;
    let agarDragStart = null;
    const drag = d3.drag()
      .on("start", (e, d) => {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
        if (d.isUserCompany) {
          agarDragStart = { x: e.x, y: e.y };
          agarHoldTimer = setTimeout(() => {
            agarHoldTimer = null;
            svgRef.current?.dispatchEvent(new CustomEvent("agar-start"));
          }, 5000);
        }
      })
      .on("drag", (e, d) => {
        d.fx = e.x; d.fy = e.y;
        // Cancel hold if mouse moved more than 10px
        if (agarHoldTimer && agarDragStart) {
          const dx = e.x - agarDragStart.x;
          const dy = e.y - agarDragStart.y;
          if (Math.sqrt(dx * dx + dy * dy) > 10) {
            clearTimeout(agarHoldTimer);
            agarHoldTimer = null;
          }
        }
      })
      .on("end", (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
        if (agarHoldTimer) { clearTimeout(agarHoldTimer); agarHoldTimer = null; }
      });

    // Company-to-company links
    const companyLinkData = showCompanyLinks ? allCompanyLinks.filter(l => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      return idSet.has(sourceId) && idSet.has(targetId);
    }) : [];

    const getArrowType = (d) => d.type && arrowTypes[d.type] ? d.type : "inferred";

    // Pre-compute curve offset for links sharing the same company pair
    const linkPairKey = (d) => {
      const s = typeof d.source === "object" ? d.source.id : d.source;
      const t = typeof d.target === "object" ? d.target.id : d.target;
      return s < t ? `${s}|${t}` : `${t}|${s}`;
    };
    const pairGroups = {};
    companyLinkData.forEach(d => {
      const key = linkPairKey(d);
      if (!pairGroups[key]) pairGroups[key] = [];
      pairGroups[key].push(d);
    });
    const linkCurve = new Map();
    Object.values(pairGroups).forEach(group => {
      const n = group.length;
      group.forEach((d, i) => {
        // Single link: straight (0). Multiple: curve outward, centered around 0
        linkCurve.set(d, n === 1 ? 0 : (i - (n - 1) / 2) * 0.4);
      });
    });

    const companyLinkGroup = g.append("g");
    // Set of companies that have at least one relationship connection
    const linkedCompanyIds = new Set();
    allCompanyLinks.forEach(l => {
      linkedCompanyIds.add(typeof l.source === "object" ? l.source.id : l.source);
      linkedCompanyIds.add(typeof l.target === "object" ? l.target.id : l.target);
    });

    const companyLink = companyLinksRef.current = companyLinkGroup.selectAll("path.company-link-visible").data(companyLinkData).join("path")
      .attr("class", d => `company-link-visible${d.type === "inferred" ? " company-link-inferred" : " company-link-flow"}`)
      .attr("stroke", d => {
        if (d.type && RELATIONSHIP_TYPES[d.type]) {
          return RELATIONSHIP_TYPES[d.type].color;
        }
        return "#64748B";
      })
      .attr("stroke-width", d => 2 + (d.strength || 0.5) * 2)
      .attr("opacity", d => d.type === "inferred" ? 0.45 : 0.65)
      .attr("stroke-dasharray", d => d.type === "inferred" ? "3,13" : "8,16")
      .attr("stroke-linecap", "round")
      .attr("fill", "none")
      .attr("marker-end", d => `url(#arrow-${getArrowType(d)})`)
      .attr("marker-start", d => {
        const type = getArrowType(d);
        return arrowTypes[type]?.bidir ? `url(#arrow-${type}-rev)` : null;
      });

    // Relationship label backgrounds + text at midpoint
    const labelDisplay = showRelationshipLabelsRef.current ? null : "none";
    const companyLinkLabelBg = companyLinkGroup.selectAll("rect.company-link-label-bg").data(companyLinkData).join("rect")
      .attr("class", "company-link-label-bg")
      .attr("fill", "#0D0D0D")
      .attr("fill-opacity", 0.85)
      .attr("rx", 3).attr("ry", 3)
      .attr("pointer-events", "none")
      .attr("display", labelDisplay);

    const companyLinkLabel = companyLinkGroup.selectAll("text.company-link-label").data(companyLinkData).join("text")
      .attr("class", "company-link-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 7.5)
      .attr("font-weight", 600)
      .style("font-family", "'JetBrains Mono', monospace")
      .attr("pointer-events", "none")
      .attr("fill", d => {
        if (d.type && RELATIONSHIP_TYPES[d.type]) return RELATIONSHIP_TYPES[d.type].color;
        return P.purple;
      })
      .text(d => {
        if (d.type && RELATIONSHIP_TYPES[d.type]) return RELATIONSHIP_TYPES[d.type].label;
        return "Verknüpft";
      })
      .attr("display", labelDisplay);

    // Invisible wider hit areas for hover
    const companyLinkHit = companyLinkGroup.selectAll("path.company-link-hit").data(companyLinkData).join("path")
      .attr("class", "company-link-hit")
      .attr("stroke", "transparent")
      .attr("stroke-width", 14)
      .attr("fill", "none")
      .attr("cursor", "pointer")
      .on("mouseover", function(_, d) {
        // Skip hover on dimmed paths when a company is selected
        const sc = selectedCompanyRef.current;
        if (sc) {
          const sId = typeof d.source === "object" ? d.source.id : d.source;
          const tId = typeof d.target === "object" ? d.target.id : d.target;
          if (sId !== sc.id && tId !== sc.id) return;
        }
        const idx = companyLinkData.indexOf(d);
        companyLink.filter((_, i) => i === idx)
          .attr("opacity", 1)
          .attr("filter", "url(#link-glow)");
      })
      .on("mouseout", function(_, d) {
        const sc = selectedCompanyRef.current;
        if (sc) {
          const sId = typeof d.source === "object" ? d.source.id : d.source;
          const tId = typeof d.target === "object" ? d.target.id : d.target;
          if (sId !== sc.id && tId !== sc.id) return;
        }
        const idx = companyLinkData.indexOf(d);
        const baseOpacity = d.type === "inferred" ? 0.3 : 0.65;
        companyLink.filter((_, i) => i === idx)
          .attr("opacity", baseOpacity)
          .attr("filter", null);
      });

    companyLinkLabelRef.current = companyLinkLabel;
    companyLinkLabelBgRef.current = companyLinkLabelBg;

    // Contact-to-company links
    const linkGroup = g.append("g")
      .attr("display", showContactLinesRef.current ? null : "none");
    const link = contactLinksRef.current = linkGroup.selectAll("line").data(links).join("line")
      .attr("stroke", d => {
        const tid = typeof d.target === "object" ? d.target.id : d.target;
        return (companyColors[tid] || P.border) + "20";
      })
      .attr("stroke-width", isLargeNetwork ? 0.3 : 0.6);
    contactLinkGroupRef.current = linkGroup;

    // Company bubbles
    const cG = companyGroupsRef.current = g.append("g").selectAll("g").data(nodes.filter(n => n.type === "company")).join("g")
      .attr("cursor", linkingMode ? "crosshair" : "pointer")
      .on("click", (_, d) => onCompanyClick(d))
      .on("mouseover", function(_, d) {
        const group = d3.select(this);
        const color = companyColors[d.id] || P.accent;
        if (d.isUserCompany) {
          group.select(".sun-glow-bubble")
            .transition().duration(200)
            .attr("stroke-width", 3.5)
            .attr("fill", `${ucColor}40`);
        } else if (d.name === "Unbekannt") {
          group.select(".company-bubble")
            .transition().duration(200)
            .attr("stroke", "#7C3AED70")
            .attr("fill", "#08000F");
        } else {
          group.select(".company-bubble")
            .transition().duration(200)
            .attr("stroke-width", 2)
            .attr("stroke", color + "80")
            .attr("fill", color + "40");
        }
      })
      .on("mouseout", function(_, d) {
        const group = d3.select(this);
        const color = companyColors[d.id] || P.accent;
        if (d.isUserCompany) {
          group.select(".sun-glow-bubble")
            .transition().duration(300)
            .attr("stroke-width", 2.5)
            .attr("fill", `${ucColor}30`);
        } else if (d.name === "Unbekannt") {
          group.select(".company-bubble")
            .transition().duration(300)
            .attr("stroke", "#7C3AED40")
            .attr("fill", "#030006");
        } else {
          group.select(".company-bubble")
            .transition().duration(300)
            .attr("stroke-width", 1.5)
            .attr("stroke", color + "55")
            .attr("fill", color + "30");
        }
      })
      .call(drag);

    const getCompanyRadius = (d) => {
      if (d.isUserCompany) {
        return maxR * (isLargeNetwork ? 0.6 : 0.55);
      }
      const size = Math.max(d.estimatedSize || 100, 10);
      const t = (Math.log10(size) - minSize) / sizeRange;
      const clamped = Math.max(0, Math.min(1, t));
      return minR + Math.pow(clamped, 0.6) * (maxR - minR);
    };
    getCompanyRadiusRef.current = getCompanyRadius;

    // Outer corona for user's company (rendered behind everything in the group)
    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 6)
      .attr("data-base-r", d => getCompanyRadius(d) * 6)
      .attr("fill", "url(#sun-gradient)")
      .attr("class", "sun-corona-outer sun-scalable")
      .attr("pointer-events", "none");

    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 4)
      .attr("data-base-r", d => getCompanyRadius(d) * 4)
      .attr("fill", "url(#sun-gradient)")
      .attr("class", "sun-corona sun-scalable")
      .attr("pointer-events", "none");

    // Ring accents
    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 5)
      .attr("data-base-r", d => getCompanyRadius(d) * 5)
      .attr("fill", "none")
      .attr("stroke", ucColor + "15")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,6")
      .attr("class", "sun-corona sun-scalable")
      .attr("pointer-events", "none");

    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 3)
      .attr("data-base-r", d => getCompanyRadius(d) * 3)
      .attr("fill", "none")
      .attr("stroke", ucColor + "20")
      .attr("stroke-width", 0.8)
      .attr("class", "sun-corona sun-scalable")
      .attr("pointer-events", "none");

    // Animated orbit rings for user's company (sun)
    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 1.5)
      .attr("data-base-r", d => getCompanyRadius(d) * 1.5)
      .attr("fill", "none")
      .attr("stroke", ucColor)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4,10")
      .attr("opacity", 0.4)
      .attr("class", "sun-orbit-1 sun-corona sun-scalable")
      .attr("pointer-events", "none");

    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 2.2)
      .attr("data-base-r", d => getCompanyRadius(d) * 2.2)
      .attr("fill", "none")
      .attr("stroke", ucColor)
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "6,14")
      .attr("opacity", 0.25)
      .attr("class", "sun-orbit-2 sun-corona sun-scalable")
      .attr("pointer-events", "none");

    // Black hole effects for "Unbekannt" company
    const bhFilter = d => d.name === "Unbekannt";

    // Gravitational lensing glow (outermost)
    cG.filter(bhFilter).append("circle")
      .attr("r", d => getCompanyRadius(d) * 3)
      .attr("fill", "url(#bh-gradient)")
      .attr("pointer-events", "none");

    // Accretion disk — tilted ellipse
    cG.filter(bhFilter).append("ellipse")
      .attr("rx", d => getCompanyRadius(d) * 2)
      .attr("ry", d => getCompanyRadius(d) * 0.5)
      .attr("transform", "rotate(-20)")
      .attr("fill", "none")
      .attr("stroke", "url(#bh-disk-grad)")
      .attr("stroke-width", d => Math.max(2, getCompanyRadius(d) * 0.15))
      .attr("opacity", 0.5)
      .attr("filter", "url(#bh-glow)")
      .attr("pointer-events", "none");

    // Spinning ring particles
    cG.filter(bhFilter).append("circle")
      .attr("r", d => getCompanyRadius(d) * 1.6)
      .attr("fill", "none")
      .attr("stroke", "#A855F7")
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "2,8")
      .attr("opacity", 0.4)
      .attr("class", "bh-ring")
      .attr("pointer-events", "none");

    // Photon sphere — bright thin ring at event horizon edge
    cG.filter(bhFilter).append("circle")
      .attr("r", d => getCompanyRadius(d) * 1.08)
      .attr("fill", "none")
      .attr("stroke", "#C084FC")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.6)
      .attr("filter", "url(#bh-glow)")
      .attr("pointer-events", "none");

    // Main bubble
    cG.append("circle")
      .attr("r", getCompanyRadius)
      .attr("fill", d => {
        if (d.isUserCompany) return `${ucColor}30`;
        if (d.name === "Unbekannt") return "#030006";
        const c = companyColors[d.id] || P.accent;
        return c + (linkedCompanyIds.has(d.id) ? "60" : "18");
      })
      .attr("stroke", d => {
        if (d.isUserCompany) return ucColor;
        if (d.name === "Unbekannt") return "#7C3AED40";
        const c = companyColors[d.id] || P.accent;
        return c + (linkedCompanyIds.has(d.id) ? "BB" : "35");
      })
      .attr("stroke-width", d => d.isUserCompany ? 2.5 : d.name === "Unbekannt" ? 2 : linkedCompanyIds.has(d.id) ? 2.5 : 1)
      .attr("filter", d => d.isUserCompany ? "url(#sun-glow)" : "none")
      .attr("class", d => d.isUserCompany ? "sun-glow-bubble sun-pulse" : "company-bubble");


    const formatSize = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
      return n.toString();
    };

    const companyTextDisplay = showCompanyTextRef.current ? null : "none";
    cG.append("text")
      .attr("class", "company-text")
      .text(d => {
        if (d.name === "Unbekannt") return "?";
        const radius = getCompanyRadius(d);
        const maxLen = d.isUserCompany ? 25 : Math.max(8, Math.min(18, Math.floor(radius / 4)));
        return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + "…" : d.name;
      })
      .attr("text-anchor", "middle").attr("dy", d => d.name === "Unbekannt" ? "-0.6em" : "-0.3em")
      .attr("fill", d => {
        if (d.isUserCompany) return ucColor;
        if (d.name === "Unbekannt") return "#A855F7";
        return companyColors[d.id] || P.accent;
      })
      .attr("font-size", d => {
        if (d.isUserCompany) return 14;
        const sizeScale = Math.log10(Math.max(d.estimatedSize || 100, 10));
        return Math.min(7 + sizeScale * 1.2, 13);
      })
      .attr("font-weight", d => d.isUserCompany ? 700 : 600)
      .style("font-family", "'JetBrains Mono', monospace").attr("pointer-events", "none")
      .attr("display", companyTextDisplay);

    cG.append("text")
      .attr("class", "company-text company-detail-text")
      .text(d => d.name === "Unbekannt" ? "" : formatSize(d.estimatedSize || 0))
      .attr("text-anchor", "middle").attr("dy", "1em")
      .attr("fill", P.textMuted)
      .attr("font-size", d => {
        const sizeScale = Math.log10(Math.max(d.estimatedSize || 100, 10));
        return Math.min(7 + sizeScale * 0.8, 12);
      })
      .attr("font-weight", 700)
      .style("font-family", "'JetBrains Mono', monospace").attr("pointer-events", "none")
      .attr("display", companyTextDisplay);

    cG.append("text")
      .attr("class", "company-text company-detail-text")
      .text(d => {
        if (d.isUserCompany) return "MEINE FIRMA";
        if (d.name === "Unbekannt") return `${d.memberCount} nicht zugeordnet`;
        return `${d.memberCount} conn.`;
      })
      .attr("text-anchor", "middle").attr("dy", "2.2em")
      .attr("fill", d => {
        if (d.isUserCompany) return ucColor + "80";
        if (d.name === "Unbekannt") return "#A855F780";
        return P.textDim;
      })
      .attr("font-size", d => d.isUserCompany ? 8 : 6)
      .attr("font-weight", d => d.isUserCompany ? 600 : 500)
      .attr("letter-spacing", d => d.isUserCompany ? "1px" : "0")
      .style("font-family", "'JetBrains Mono', monospace").attr("pointer-events", "none")
      .attr("display", companyTextDisplay);

    // User bubble (rendered separately, larger and labeled)
    const userNode = nodes.find(n => n.type === "contact" && n.isUser);
    if (userNode) {
      const uG = userBubbleRef.current = g.append("g").selectAll("g")
        .data([userNode]).join("g")
        .attr("cursor", "pointer")
        .on("click", (_, d) => { onContactClick(d); })
        .call(drag);

      const userRadius = isLargeNetwork ? 14 : 18;

      uG.append("circle")
        .attr("r", userRadius)
        .attr("fill", ucColor + "18")
        .attr("stroke", ucColor)
        .attr("stroke-width", 1.5)
        .attr("filter", "url(#gl)");

      uG.append("text")
        .text(d => {
          const maxLen = 12;
          return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + "…" : d.name;
        })
        .attr("text-anchor", "middle").attr("dy", "0.05em")
        .attr("fill", ucColor)
        .attr("font-size", isLargeNetwork ? 6 : 7)
        .attr("font-weight", 700)
        .style("font-family", "'JetBrains Mono', monospace")
        .attr("pointer-events", "none");

      uG.append("text")
        .text("ICH")
        .attr("text-anchor", "middle").attr("dy", "1.6em")
        .attr("fill", ucColor + "60")
        .attr("font-size", 5)
        .attr("font-weight", 600)
        .attr("letter-spacing", "0.5px")
        .style("font-family", "'JetBrains Mono', monospace")
        .attr("pointer-events", "none");

      // Update user bubble position on tick
      sim.on("tick.user", () => {
        uG.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    }

    // Contact dots (exclude user node, rendered above)
    const contactRadius = (d) => isLargeNetwork ? 1.5 + (d.normalizedInfluence || 0) * 4 : 2.5 + (d.normalizedInfluence || 0) * 7;

    const contactGroup = g.append("g")
      .attr("display", showContactDotsRef.current ? null : "none");
    contactGroupRef.current = contactGroup;

    const cN = contactGroup.selectAll("circle").data(nodes.filter(n => n.type === "contact" && !n.isUser)).join("circle")
      .attr("r", contactRadius)
      .attr("fill", d => (companyColors[`company_${d.company}`] || P.textMuted) + "CC")
      .attr("stroke", d => d.seniority >= 8 ? P.gold + "BB" : "transparent")
      .attr("stroke-width", d => d.seniority >= 8 ? 1.5 : 0)
      .attr("cursor", "pointer").attr("opacity", 0.85)
      .on("mouseover", function(_, d) {
        // When a company is selected, ignore hover on contacts from other companies
        const sc = selectedCompanyRef.current;
        if (sc && d.company !== sc.name) return;
        d3.select(this)
          .attr("r", contactRadius(d) * 1.8)
          .attr("opacity", 1);
        // Show this contact's links on hover (if lines toggle is on)
        if (showContactLinesRef.current) {
          linkGroup.attr("display", null);
          link.attr("display", l => (l.source.id === d.id || l.target.id === d.id) ? null : "none");
        }
        setSelectedContact(d);
      })
      .on("mouseout", function(_, d) {
        const sc = selectedCompanyRef.current;
        if (sc && d.company !== sc.name) return;
        d3.select(this)
          .attr("r", contactRadius(d))
          .attr("opacity", sc ? 1 : 0.85);
        // Restore toggle-based visibility
        if (showContactLinesRef.current) {
          link.attr("display", null);
        } else {
          linkGroup.attr("display", "none");
        }
      })
      .on("click", (_, d) => { onContactClick(d); })
      .call(drag);
    contactDotsRef.current = cN;

    // Node lookup for company links
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let tickCount = 0;

    // Cache company radii — they never change after init
    const radiusCache = new Map();
    const getCachedRadius = (node) => {
      let r = radiusCache.get(node.id);
      if (r === undefined) {
        r = getCompanyRadius(node) + 4;
        radiusCache.set(node.id, r);
      }
      return r;
    };

    // Pre-build indexed DOM arrays for O(1) access in tick (instead of .filter per index)
    const hitNodes = companyLinkHit.nodes();
    const labelNodes = companyLinkLabel.nodes();
    const labelBgNodes = companyLinkLabelBg.nodes();

    // Cache label bounding box sizes (text content doesn't change, only position)
    const labelBBoxCache = new Map();
    const pad = 3;

    // Pre-resolve source/target IDs and curve values per link
    const linkMeta = companyLinkData.map(d => ({
      sId: typeof d.source === "object" ? d.source.id : d.source,
      tId: typeof d.target === "object" ? d.target.id : d.target,
      curve: linkCurve.get(d) || 0,
    }));

    sim.on("tick", () => {
      tickCount++;
      // Update contact-to-company links every 3rd tick
      if (tickCount % 3 === 0) {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      }

      companyLink.each(function(d, i) {
        const meta = linkMeta[i];
        const sourceNode = nodeMap.get(typeof d.source === "object" ? d.source.id : meta.sId);
        const targetNode = nodeMap.get(typeof d.target === "object" ? d.target.id : meta.tId);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / dist, uy = dy / dist;
          const sr = getCachedRadius(sourceNode);
          const tr = getCachedRadius(targetNode);
          const x1 = sourceNode.x + ux * sr;
          const y1 = sourceNode.y + uy * sr;
          const x2 = targetNode.x - ux * tr;
          const y2 = targetNode.y - uy * tr;
          let pathD, labelX, labelY;
          if (meta.curve === 0) {
            pathD = `M${x1},${y1}L${x2},${y2}`;
            labelX = (x1 + x2) / 2;
            labelY = (y1 + y2) / 2;
          } else {
            const flip = meta.sId > meta.tId ? -1 : 1;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const cpx = mx + (-uy) * dist * meta.curve * flip;
            const cpy = my + ux * dist * meta.curve * flip;
            pathD = `M${x1},${y1}Q${cpx},${cpy} ${x2},${y2}`;
            labelX = 0.25 * x1 + 0.5 * cpx + 0.25 * x2;
            labelY = 0.25 * y1 + 0.5 * cpy + 0.25 * y2;
          }
          this.setAttribute("d", pathD);
          // Update hit area path (direct DOM, no filter scan)
          hitNodes[i].setAttribute("d", pathD);
          // Offset label slightly perpendicular to the line
          const lx = labelX - uy * 8;
          const ly = labelY + ux * 8;
          // Update label text position (direct DOM)
          const labelEl = labelNodes[i];
          labelEl.setAttribute("x", lx);
          labelEl.setAttribute("y", ly);
          // Update background rect using cached bbox dimensions
          let cached = labelBBoxCache.get(i);
          if (!cached) {
            const bbox = labelEl.getBBox();
            cached = { w: bbox.width + pad * 2, h: bbox.height + pad * 2, dx: bbox.width / 2 + pad, dy: bbox.height / 2 + pad };
            labelBBoxCache.set(i, cached);
          }
          const bgEl = labelBgNodes[i];
          bgEl.setAttribute("x", lx - cached.dx);
          bgEl.setAttribute("y", ly - cached.dy);
          bgEl.setAttribute("width", cached.w);
          bgEl.setAttribute("height", cached.h);
        }
      });

      cG.each(function(d) {
        if (this.style.display === "none" || this.classList.contains("agar-eaten")) return;
        this.setAttribute("transform", `translate(${d.x},${d.y})`);
      });
      cN.attr("cx", d => d.x).attr("cy", d => d.y);

      // Periodic viewport culling during simulation (every 10th tick)
      // Skip during agar game — game controls its own camera, stale zoom transform would cull wrong nodes
      if (tickCount % 10 === 0 && !agarActiveRef.current) {
        const t = d3.zoomTransform(svg.node());
        cullViewport(t);
        drawMinimap(t);
      }
    });

    // Initial zoom
    const initialScale = isLargeNetwork ? 0.6 : 0.8;
    setTimeout(() => {
      svg.transition().duration(800).call(
        zoom.transform,
        d3.zoomIdentity.scale(initialScale).translate(width * (1 - initialScale) / 2 / initialScale, height * (1 - initialScale) / 2 / initialScale)
      );
    }, 800);

    return () => {
      sim.stop();
      if (cullFrame) cancelAnimationFrame(cullFrame);
    };
  }, [network, companyColors, showCompanyLinks, allCompanyLinks, linkingMode, onCompanyClick, onContactClick, setSelectedContact, userCompanyColor]);

  // Pan/zoom to focused node
  useEffect(() => {
    if (!focusNode || !svgRef.current || !zoomRef.current || !nodesRef.current) return;
    const node = nodesRef.current.find(n => n.id === focusNode.id);
    if (!node || node.x == null || node.y == null) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    const scale = 1.5;
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-node.x, -node.y);

    d3.select(svgRef.current)
      .transition()
      .duration(600)
      .call(zoomRef.current.transform, transform);
  }, [focusNode]);

  // Toggle relationship labels visibility from external prop
  useEffect(() => {
    const label = companyLinkLabelRef.current;
    const bg = companyLinkLabelBgRef.current;
    if (!label || !bg) return;
    if (showRelationshipLabels) {
      label.attr("display", null);
      bg.attr("display", null);
    } else {
      label.attr("display", "none");
      bg.attr("display", "none");
    }
  }, [showRelationshipLabels]);

  // Toggle contact dots visibility from external prop
  useEffect(() => {
    const group = contactGroupRef.current;
    if (!group) return;
    group.attr("display", showContactDots ? null : "none");
  }, [showContactDots]);

  // Toggle contact lines visibility from external prop
  useEffect(() => {
    const group = contactLinkGroupRef.current;
    if (!group) return;
    group.attr("display", showContactLines ? null : "none");
  }, [showContactLines]);

  // Toggle company bubble text visibility from external prop
  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.selectAll(".company-text").attr("display", showCompanyText ? null : "none");
  }, [showCompanyText]);

  // Highlight big players and connected companies when a company is selected
  useEffect(() => {
    if (!gRef.current || !contactDotsRef.current || !nodesRef.current) return;
    if (agarActiveRef.current) return; // skip selection mode during game
    const g = gRef.current;
    const cN = contactDotsRef.current;
    const cG = companyGroupsRef.current;
    const cLinks = companyLinksRef.current;

    // Remove any previous highlight labels and selected orbits
    g.selectAll(".big-player-label").remove();
    g.selectAll(".big-player-ring").remove();
    g.selectAll(".selected-orbit").remove();

    if (!selectedCompany) {
      // Reset all contact dots and company bubbles to normal
      cN.attr("display", null).attr("opacity", 0.85);
      if (cG) cG.transition().duration(300).attr("opacity", 1);
      if (cLinks) cLinks.attr("display", null).transition().duration(300).attr("opacity", 1);
      // Restore label opacity
      const cLabel = companyLinkLabelRef.current;
      const cLabelBg = companyLinkLabelBgRef.current;
      if (cLabel) cLabel.attr("display", null).transition().duration(300).attr("opacity", 1);
      if (cLabelBg) cLabelBg.attr("display", null).transition().duration(300).attr("opacity", 1);
      // Restore zoom/toggle-based visibility
      const contactGrp = contactGroupRef.current;
      if (contactGrp) {
        contactGrp.attr("display", showContactDotsRef.current ? null : "none");
      }
      const linkGrp = contactLinkGroupRef.current;
      if (linkGrp) {
        linkGrp.attr("display", showContactLinesRef.current ? null : "none");
      }
      // Restore company text toggle state
      g.selectAll(".company-text").attr("display", showCompanyTextRef.current ? null : "none");
      // Redraw minimap without selection dimming
      if (drawMinimapRef.current && svgRef.current) {
        drawMinimapRef.current(d3.zoomTransform(svgRef.current.node ? svgRef.current.node() : svgRef.current));
      }
      return;
    }

    const companyName = selectedCompany.name;
    const selectedId = selectedCompany.id;

    // Build set of directly connected company IDs using full (unfiltered) relationships
    // so dimming works correctly even when the link-type filter is set to "none"
    const connectedIds = new Set();
    connectedIds.add(selectedId);
    (dimRelationships || allCompanyLinks).forEach(l => {
      const sId = typeof l.source === "object" ? l.source.id : l.source;
      const tId = typeof l.target === "object" ? l.target.id : l.target;
      if (sId === selectedId) connectedIds.add(tId);
      if (tId === selectedId) connectedIds.add(sId);
    });

    // Build set of connected company names for contact filtering
    const connectedNames = new Set();
    connectedNames.add(companyName);
    if (nodesRef.current) {
      nodesRef.current.forEach(n => {
        if (n.type === "company" && connectedIds.has(n.id)) {
          connectedNames.add(n.name);
        }
      });
    }

    // Dim companies that aren't connected; keep user's company visible
    if (cG) {
      cG.transition().duration(300)
        .attr("opacity", d => d.isUserCompany || connectedIds.has(d.id) ? 1 : 0.12);
    }

    // Dim company-to-company links, arrows, and labels that don't involve the selected company
    const isConnectedLink = d => {
      const sId = typeof d.source === "object" ? d.source.id : d.source;
      const tId = typeof d.target === "object" ? d.target.id : d.target;
      return sId === selectedId || tId === selectedId;
    };
    if (cLinks) {
      cLinks.attr("display", d => isConnectedLink(d) ? null : "none")
        .transition().duration(300)
        .attr("opacity", d => isConnectedLink(d) ? 1 : 0.07);
    }
    const cLabel = companyLinkLabelRef.current;
    const cLabelBg = companyLinkLabelBgRef.current;
    if (cLabel) {
      cLabel.attr("display", d => isConnectedLink(d) ? null : "none")
        .transition().duration(300)
        .attr("opacity", d => isConnectedLink(d) ? 1 : 0.07);
    }
    if (cLabelBg) {
      cLabelBg.attr("display", d => isConnectedLink(d) ? null : "none")
        .transition().duration(300)
        .attr("opacity", d => isConnectedLink(d) ? 1 : 0.07);
    }

    // Show company names for all; hide size/count detail text on non-connected companies
    if (cG) {
      cG.selectAll(".company-text").attr("display", null);
      cG.selectAll(".company-detail-text").attr("display", function() {
        const d = d3.select(this.parentNode).datum();
        return d.isUserCompany || connectedIds.has(d.id) ? null : "none";
      });
    }

    // Force contact dots + lines visible for selected company (even if toggled off / zoomed out)
    const contactGrp = contactGroupRef.current;
    if (contactGrp) {
      cN.attr("cx", d => d.x).attr("cy", d => d.y);
      contactGrp.attr("display", null);
    }
    const linkGrp = contactLinkGroupRef.current;
    const cLink = contactLinksRef.current;
    if (linkGrp && cLink) {
      cLink.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
           .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      linkGrp.attr("display", null);
      // Only show lines for contacts in the selected/connected companies
      cLink.attr("display", d => {
        const sId = typeof d.source === "object" ? d.source.id : d.source;
        const tId = typeof d.target === "object" ? d.target.id : d.target;
        const sNode = nodesRef.current.find(n => n.id === sId);
        const tNode = nodesRef.current.find(n => n.id === tId);
        const sComp = sNode?.company || "";
        const tComp = tNode?.company || "";
        return (connectedNames.has(sComp) || connectedIds.has(sId)) &&
               (connectedNames.has(tComp) || connectedIds.has(tId)) ? null : "none";
      });
    }

    // Hide contacts of unconnected companies for performance; show connected ones
    cN.attr("display", d => connectedNames.has(d.company) ? null : "none")
      .attr("opacity", d => connectedNames.has(d.company) ? 1 : 0.08);

    // Find big players: top contacts by seniority/influence in the selected company
    const companyContacts = nodesRef.current.filter(
      n => n.type === "contact" && !n.isUser && n.company === companyName
    );
    const bigPlayers = [...companyContacts]
      .sort((a, b) => (b.seniority || 0) - (a.seniority || 0) || (b.influenceScore || 0) - (a.influenceScore || 0))
      .slice(0, 8)
      .filter(c => (c.seniority || 0) >= 2);

    // Add rings and name labels for big players
    const labelsGroup = g.append("g").attr("class", "big-player-label");
    const ringsGroup = g.append("g").attr("class", "big-player-ring");

    bigPlayers.forEach(p => {
      const color = companyColors[`company_${companyName}`] || P.accent;
      const r = 3 + (p.normalizedInfluence || 0) * 8;

      // Pulsing ring
      ringsGroup.append("circle")
        .attr("cx", p.x).attr("cy", p.y)
        .attr("r", r + 4)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.2)
        .attr("stroke-opacity", 0.7)
        .attr("stroke-dasharray", p.seniority >= 8 ? "none" : "2,2");

      // Name label
      labelsGroup.append("text")
        .attr("x", p.x)
        .attr("y", p.y - r - 5)
        .attr("text-anchor", "middle")
        .attr("fill", color)
        .attr("font-size", p.seniority >= 8 ? 8 : 7)
        .attr("font-weight", p.seniority >= 8 ? 700 : 500)
        .style("font-family", "'JetBrains Mono', monospace")
        .attr("pointer-events", "none")
        .text(p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name);

      // Role label (smaller, below name)
      if (p.position) {
        labelsGroup.append("text")
          .attr("x", p.x)
          .attr("y", p.y - r - 5 + 9)
          .attr("text-anchor", "middle")
          .attr("fill", P.textDim)
          .attr("font-size", 5)
          .attr("font-weight", 400)
          .style("font-family", "'JetBrains Mono', monospace")
          .attr("pointer-events", "none")
          .text(p.position.length > 22 ? p.position.slice(0, 21) + "…" : p.position);
      }
    });

    // Add animated orbit rings to the selected company (scaled by bubble size)
    if (cG) {
      const selGroup = cG.filter(d => d.id === selectedId);
      if (!selGroup.empty()) {
        const selData = selGroup.datum();
        const selColor = companyColors[`company_${companyName}`] || P.accent;
        const radiusFn = getCompanyRadiusRef.current;
        const selR = selData && radiusFn ? radiusFn(selData) : 20;

        if (!selData?.isUserCompany) {
          const s = selR / 25; // scale factor relative to a ~25px "medium" bubble
          selGroup.append("circle")
            .attr("r", selR * 1.5)
            .attr("fill", "none")
            .attr("stroke", selColor)
            .attr("stroke-width", Math.max(0.8, 1.2 * s))
            .attr("stroke-dasharray", `${4 * s},${10 * s}`)
            .attr("opacity", 0.4)
            .attr("class", "selected-orbit-1 selected-orbit")
            .attr("pointer-events", "none");

          selGroup.append("circle")
            .attr("r", selR * 2.2)
            .attr("fill", "none")
            .attr("stroke", selColor)
            .attr("stroke-width", Math.max(0.5, 0.8 * s))
            .attr("stroke-dasharray", `${6 * s},${14 * s}`)
            .attr("opacity", 0.25)
            .attr("class", "selected-orbit-2 selected-orbit")
            .attr("pointer-events", "none");
        }
      }
    }

    // Redraw minimap with selection dimming + relation colors
    if (drawMinimapRef.current && svgRef.current) {
      drawMinimapRef.current(d3.zoomTransform(svgRef.current.node ? svgRef.current.node() : svgRef.current));
    }

    // Update label positions on simulation tick
    const tickHandler = () => {
      bigPlayers.forEach((p, i) => {
        const r = 3 + (p.normalizedInfluence || 0) * 8;
        ringsGroup.selectAll("circle").filter((_, idx) => idx === i)
          .attr("cx", p.x).attr("cy", p.y);
        labelsGroup.selectAll("text").filter((_, idx) => idx === (p.position ? i * 2 : i))
          .attr("x", p.x).attr("y", p.y - r - 5);
        if (p.position) {
          labelsGroup.selectAll("text").filter((_, idx) => idx === i * 2 + 1)
            .attr("x", p.x).attr("y", p.y - r - 5 + 9);
        }
      });
    };

    if (simulationRef.current) {
      simulationRef.current.on("tick.highlight", tickHandler);
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.on("tick.highlight", null);
      }
    };
  }, [selectedCompany, companyColors, dimRelationships, allCompanyLinks]);

  // Easter egg: double-click your company → agar.io mode
  useEffect(() => {
    let active = false;
    let cleanup = null;

    const escHandler = (e) => {
      if (active && e.key === "Escape" && cleanup) cleanup();
    };

    const agarStartHandler = () => {
      if (active) return;
      // Show mode selection overlay
      const modeOverlay = document.createElement("div");
      Object.assign(modeOverlay.style, {
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.85)", zIndex: 9999,
        fontFamily: "'JetBrains Mono', monospace",
      });
      document.body.appendChild(modeOverlay);
      const mTitle = document.createElement("div");
      Object.assign(mTitle.style, {
        fontSize: "24px", fontWeight: 700, color: "#fff", marginBottom: "8px", letterSpacing: "2px",
      });
      mTitle.textContent = "SPIELMODUS";
      modeOverlay.appendChild(mTitle);
      const mSub = document.createElement("div");
      Object.assign(mSub.style, { fontSize: "10px", color: "#ffffff50", marginBottom: "32px" });
      mSub.textContent = "Wähle deinen Modus";
      modeOverlay.appendChild(mSub);
      const btnRow = document.createElement("div");
      Object.assign(btnRow.style, { display: "flex", gap: "20px" });
      modeOverlay.appendChild(btnRow);
      const makeBtn = (label, desc, color, mode) => {
        const btn = document.createElement("div");
        Object.assign(btn.style, {
          padding: "20px 28px", borderRadius: "10px", cursor: "pointer",
          border: `2px solid ${color}50`, background: `${color}10`,
          textAlign: "center", transition: "all 0.2s", minWidth: "170px",
        });
        btn.onmouseenter = () => { btn.style.background = `${color}25`; btn.style.borderColor = color; };
        btn.onmouseleave = () => { btn.style.background = `${color}10`; btn.style.borderColor = `${color}50`; };
        const lbl = document.createElement("div");
        Object.assign(lbl.style, { fontSize: "16px", fontWeight: 700, color, marginBottom: "8px" });
        lbl.textContent = label;
        btn.appendChild(lbl);
        const dsc = document.createElement("div");
        Object.assign(dsc.style, { fontSize: "9px", color: "#ffffff60", lineHeight: "1.6", whiteSpace: "pre-line" });
        dsc.textContent = desc;
        btn.appendChild(dsc);
        btn.onclick = () => {
          modeOverlay.remove();
          window.removeEventListener("keydown", closeMode);
          active = true;
          cleanup = runAgar(mode);
        };
        btnRow.appendChild(btn);
      };
      makeBtn("ZEITRENNEN", "30 Sekunden um alle\nFirmen zu absorbieren", "#F59E0B", "timed");
      makeBtn("ÜBERLEBEN", "Weiche dem Schwarzen Loch\naus und fresse alle Firmen", "#A855F7", "survival");
      const closeMode = (e) => {
        if (e.key === "Escape") { modeOverlay.remove(); window.removeEventListener("keydown", closeMode); }
      };
      window.addEventListener("keydown", closeMode);
    };

    const formatTimer = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const runAgar = (mode) => {
      const isSurvival = mode === "survival";
      const g = gRef.current;
      const cG = companyGroupsRef.current;
      const cN = contactDotsRef.current;
      const link = contactLinksRef.current;
      const companyLink = companyLinksRef.current;
      if (!g || !nodesRef.current || !cG) { active = false; return null; }

      const nodes = nodesRef.current;
      const userNode = nodes.find(n => n.type === "company" && n.isUserCompany);
      if (!userNode) { active = false; return null; }

      // Track alive companies
      const others = nodes.filter(n => n.type === "company" && !n.isUserCompany);
      const bhNode = isSurvival ? others.find(n => n.name === "Unbekannt") : null;
      const eatableCount = bhNode ? others.length - 1 : others.length;
      const eaten = new Set();
      let score = 0;

      // Save original radii
      const origRadii = {};
      g.selectAll(".company-bubble").each(function(d) {
        origRadii[d.id] = +d3.select(this).attr("r");
      });

      // Hide entire user company group (bubble + labels + corona)
      cG.filter(d => d.isUserCompany).attr("opacity", 0);

      // Hide user company's contacts and connections
      const userCompanyName = userNode.id.replace("company_", "");
      if (cN) cN.filter(d => d.company === userCompanyName)
        .transition().duration(300).attr("r", 0).attr("opacity", 0);
      if (link) link.filter(d => {
        const sId = typeof d.source === "object" ? d.source.id : d.source;
        const tId = typeof d.target === "object" ? d.target.id : d.target;
        return sId === userNode.id || tId === userNode.id;
      }).transition().duration(300).attr("opacity", 0);
      if (companyLink) companyLink.filter(d => {
        const sId = typeof d.source === "object" ? d.source.id : d.source;
        const tId = typeof d.target === "object" ? d.target.id : d.target;
        return sId === userNode.id || tId === userNode.id;
      }).transition().duration(300).attr("opacity", 0);
      const uG = userBubbleRef.current;
      if (uG) uG.transition().duration(300).attr("opacity", 0);

      // Mark game as active and disable hover/click on company bubbles
      agarActiveRef.current = true;
      agarEatenRef.current = eaten; // share eaten set with minimap
      if (cG) {
        cG.style("pointer-events", "none");
        // Un-cull all companies so none are hidden from viewport culling
        cG.style("display", null);
      }

      // ── Game initial state: hide everything except company bubbles ──
      // Relationship lines + labels + hit areas
      if (companyLink) companyLink.transition().duration(300).attr("opacity", 0);
      const clLabel = companyLinkLabelRef.current;
      const clLabelBg = companyLinkLabelBgRef.current;
      if (clLabel) clLabel.attr("display", "none");
      if (clLabelBg) clLabelBg.attr("display", "none");
      g.selectAll(".company-link-hit").attr("display", "none");
      // Contact dots + contact links
      const contactGrp = contactGroupRef.current;
      if (contactGrp) contactGrp.attr("display", "none");
      const linkGrp = contactLinkGroupRef.current;
      if (linkGrp) linkGrp.attr("display", "none");
      // Company text labels (name, size, count)
      g.selectAll(".company-text").attr("display", "none");
      // Sun corona/orbit rings
      g.selectAll(".sun-corona, .sun-corona-outer, .sun-scalable").attr("display", "none");
      // Black hole effects — keep visible in survival mode
      if (!isSurvival) {
        g.selectAll(".bh-ring").attr("display", "none");
        g.selectAll("[filter='url(#bh-glow)']").attr("display", "none");
      }

      // Hide sidebar, top bar, and overlays
      window.dispatchEvent(new CustomEvent("agar-fullscreen", { detail: { active: true } }));

      // Move minimap to bottom-right corner for game mode
      const mmCanvas = minimapRef.current;
      if (mmCanvas) {
        mmCanvas.style.bottom = "12px";
        mmCanvas.style.right = "12px";
      }

      // Create agar cell overlay
      const svgEl = svgRef.current;
      const defs = d3.select(svgEl).select("defs");
      const agarGroup = g.append("g").attr("class", "agar-easter-egg");
      let cellR = origRadii[userNode.id] || 35;
      let targetR = cellR;
      let cellArea = Math.PI * cellR * cellR;
      let cellX = userNode.x, cellY = userNode.y;
      let mouseX = cellX, mouseY = cellY;
      let frame = 0;
      const cc = userCompanyColor || "#00E5A0";
      const svgRect = svgEl.getBoundingClientRect();

      // Unpin user company so simulation can still move things
      userNode.fx = null;
      userNode.fy = null;

      // Give each company a smooth wander angle
      const wanderAngles = new Map();
      others.forEach(o => wanderAngles.set(o.id, Math.random() * Math.PI * 2));

      // Disable manual zoom/pan during game
      const svgSel = d3.select(svgEl);
      svgSel.on(".zoom", null);

      // Add flee force + smooth wandering
      const sim = simulationRef.current;
      let bhChaseSpeed = 5; // survival mode: black hole chase speed, increases over time
      if (sim) {
        sim.force("agar-flee", () => {
          others.forEach(other => {
            if (eaten.has(other.id)) return;
            // Black hole chases the player in survival mode (only after countdown)
            if (isSurvival && bhNode && other.id === bhNode.id && gameRunning) {
              const dx = cellX - other.x;
              const dy = cellY - other.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              other.vx += (dx / dist) * bhChaseSpeed;
              other.vy += (dy / dist) * bhChaseSpeed;
              // Dampen to prevent jittering
              other.vx *= 0.88;
              other.vy *= 0.88;
              return;
            }
            // Smooth wandering: slowly rotate wander angle, apply gentle drift
            let angle = wanderAngles.get(other.id);
            angle += (Math.random() - 0.5) * 0.3;
            wanderAngles.set(other.id, angle);
            other.vx += Math.cos(angle) * 0.5;
            other.vy += Math.sin(angle) * 0.5;
            // Flee from agar cell
            const dx = other.x - cellX;
            const dy = other.y - cellY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const fleeRadius = cellR * 3.5;
            if (dist < fleeRadius) {
              const strength = Math.pow(1 - dist / fleeRadius, 2) * 8;
              other.vx += (dx / dist) * strength;
              other.vy += (dy / dist) * strength;
            }
          });
        });
        // Keep some center gravity so companies stay in the playfield
        sim.force("x", d3.forceX(svgRect.width / 2).strength(0.01));
        sim.force("y", d3.forceY(svgRect.height / 2).strength(0.01));
        sim.alpha(0.3).restart();
      }

      // Agar cell radial gradient
      const agarGrad = defs.append("radialGradient").attr("id", "agar-cell-grad");
      agarGrad.append("stop").attr("offset", "0%").attr("stop-color", cc).attr("stop-opacity", 0.6);
      agarGrad.append("stop").attr("offset", "70%").attr("stop-color", cc).attr("stop-opacity", 0.3);
      agarGrad.append("stop").attr("offset", "100%").attr("stop-color", cc).attr("stop-opacity", 0.1);

      // Agar cell glow filter
      const agarGlow = defs.append("filter").attr("id", "agar-glow")
        .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      agarGlow.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "b");
      const agm = agarGlow.append("feMerge");
      agm.append("feMergeNode").attr("in", "b");
      agm.append("feMergeNode").attr("in", "SourceGraphic");

      // Outer glow ring
      const cellGlow = agarGroup.append("circle")
        .attr("cx", cellX).attr("cy", cellY)
        .attr("r", cellR * 1.3)
        .attr("fill", "none")
        .attr("stroke", cc)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.2)
        .attr("filter", "url(#agar-glow)");

      // Cell body
      const cell = agarGroup.append("circle")
        .attr("cx", cellX).attr("cy", cellY)
        .attr("r", cellR)
        .attr("fill", "url(#agar-cell-grad)")
        .attr("stroke", cc)
        .attr("stroke-width", 2.5)
        .attr("stroke-opacity", 0.8)
        .attr("filter", "url(#agar-glow)");

      // Membrane ring (pulsing)
      const membrane = agarGroup.append("circle")
        .attr("cx", cellX).attr("cy", cellY)
        .attr("r", cellR)
        .attr("fill", "none")
        .attr("stroke", cc)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.4)
        .attr("stroke-dasharray", "4,3");

      // Name label on cell
      const cellLabel = agarGroup.append("text")
        .attr("x", cellX).attr("y", cellY)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", "#fff")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .style("font-family", "'JetBrains Mono', monospace")
        .attr("pointer-events", "none")
        .text(userNode.name);

      const totalTime = isSurvival ? 0 : 30;
      let timeLeft = totalTime; // timed: counts down; survival: counts up

      // Fixed HUD (DOM elements pinned to viewport)
      const font = "'JetBrains Mono', monospace";

      const hudContainer = document.createElement("div");
      hudContainer.className = "agar-hud";
      Object.assign(hudContainer.style, {
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        pointerEvents: "none", zIndex: 9998, fontFamily: font,
      });
      document.body.appendChild(hudContainer);

      // Score box (top-right)
      const scoreBox = document.createElement("div");
      Object.assign(scoreBox.style, {
        position: "absolute", top: "16px", right: "16px",
        background: "rgba(0,0,0,0.6)", border: `1px solid ${cc}60`,
        borderRadius: "8px", padding: "8px 20px", textAlign: "center",
      });
      const scoreEl = document.createElement("div");
      Object.assign(scoreEl.style, { fontSize: "13px", fontWeight: 700, color: "#fff" });
      scoreEl.textContent = "Score: 0";
      const progressEl = document.createElement("div");
      Object.assign(progressEl.style, { fontSize: "9px", fontWeight: 500, color: cc, marginTop: "2px" });
      progressEl.textContent = `0 / ${eatableCount}`;
      // Mode badge
      const modeBadge = document.createElement("div");
      Object.assign(modeBadge.style, {
        position: "absolute", top: "16px", left: "16px",
        background: isSurvival ? "#A855F720" : "#F59E0B20",
        border: `1px solid ${isSurvival ? "#A855F760" : "#F59E0B60"}`,
        borderRadius: "6px", padding: "4px 12px",
        fontSize: "9px", fontWeight: 700, letterSpacing: "1px",
        color: isSurvival ? "#A855F7" : "#F59E0B",
      });
      modeBadge.textContent = isSurvival ? "ÜBERLEBEN" : "ZEITRENNEN";
      hudContainer.appendChild(modeBadge);
      scoreBox.appendChild(scoreEl);
      scoreBox.appendChild(progressEl);
      hudContainer.appendChild(scoreBox);

      // Timer box (below score)
      const timerBox = document.createElement("div");
      Object.assign(timerBox.style, {
        position: "absolute", top: "72px", right: "16px",
        background: "rgba(0,0,0,0.6)", border: `1px solid ${cc}60`,
        borderRadius: "8px", padding: "6px 20px", textAlign: "center",
      });
      const timerEl = document.createElement("div");
      Object.assign(timerEl.style, { fontSize: "18px", fontWeight: 700, color: "#fff" });
      timerEl.textContent = isSurvival ? "0:00" : formatTimer(totalTime);
      timerBox.appendChild(timerEl);
      hudContainer.appendChild(timerBox);

      // ESC hint (bottom-right)
      const escHint = document.createElement("div");
      Object.assign(escHint.style, {
        position: "absolute", bottom: "16px", right: "16px",
        fontSize: "10px", color: "rgba(255,255,255,0.3)",
      });
      escHint.textContent = "ESC to quit";
      hudContainer.appendChild(escHint);

      // Particle burst helper
      const spawnParticles = (x, y, color, count) => {
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
          const speed = 30 + Math.random() * 50;
          const tx = x + Math.cos(angle) * speed;
          const ty = y + Math.sin(angle) * speed;
          const size = 2 + Math.random() * 4;
          agarGroup.append("circle")
            .attr("cx", x).attr("cy", y)
            .attr("r", size)
            .attr("fill", color)
            .attr("opacity", 0.9)
            .transition().duration(400 + Math.random() * 300)
            .ease(d3.easeCubicOut)
            .attr("cx", tx).attr("cy", ty)
            .attr("r", 0).attr("opacity", 0)
            .remove();
        }
      };

      // Mouse tracking — convert screen coords to SVG coords
      const onMouseMove = (e) => {
        const svgEl = svgRef.current;
        if (!svgEl) return;
        const pt = svgEl.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const transform = g.node().getScreenCTM();
        if (transform) {
          const svgPt = pt.matrixTransform(transform.inverse());
          mouseX = svgPt.x;
          mouseY = svgPt.y;
        }
      };
      window.addEventListener("mousemove", onMouseMove);

      // Countdown: Ready, Set, GO! (DOM overlay for fullscreen)
      const countdownDiv = document.createElement("div");
      countdownDiv.className = "agar-countdown-overlay";
      Object.assign(countdownDiv.style, {
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", zIndex: 9999, pointerEvents: "none",
        fontFamily: "'JetBrains Mono', monospace",
      });
      document.body.appendChild(countdownDiv);

      const showCountdown = (text, delay, color) => {
        setTimeout(() => {
          const el = document.createElement("div");
          Object.assign(el.style, {
            position: "absolute", color: color || "#fff",
            fontSize: "80px", fontWeight: 700, opacity: 0,
            transition: "all 0.2s ease-out",
            textShadow: `0 0 30px ${color || "#fff"}`,
          });
          el.textContent = text;
          countdownDiv.appendChild(el);
          requestAnimationFrame(() => {
            el.style.opacity = "1";
            el.style.transform = "scale(1)";
            setTimeout(() => {
              el.style.transition = "all 0.5s ease-in";
              el.style.opacity = "0";
              el.style.transform = "scale(1.5)";
              setTimeout(() => el.remove(), 500);
            }, 300);
          });
        }, delay);
      };

      showCountdown("Ready", 0, "#fff");
      showCountdown("Set", 800, cc);
      showCountdown("GO!", 1600, "#FFD700");

      // Remove countdown overlay after sequence
      setTimeout(() => { countdownDiv.remove(); }, 2400);

      // Start game loop after countdown
      let gameLoopId = null;
      let gameRunning = false;
      const vw = svgRect.width, vh = svgRect.height;
      const innerGlow = agarGroup.select(".agar-inner");
      let camScale = d3.zoomTransform(svgEl).k;
      let camX = d3.zoomTransform(svgEl).x;
      let camY = d3.zoomTransform(svgEl).y;

      const gameStep = () => {
        if (!gameRunning) return;
        frame++;

        // Timer
        if (isSurvival) {
          timeLeft += 1 / 60;
          if (frame % 3 === 0) timerEl.textContent = formatTimer(timeLeft);
          // Increase black hole speed over time
          bhChaseSpeed = 5 + timeLeft * 0.15;
        } else {
          timeLeft -= 1 / 60;
          if (frame % 3 === 0) {
            timerEl.textContent = formatTimer(Math.max(0, timeLeft));
            if (timeLeft <= 10) timerEl.style.color = timeLeft <= 5 ? "#EF4444" : "#F59E0B";
          }
          if (timeLeft <= 0) { endGame(null, true); return; }
        }

        // Follow mouse with gravity
        cellX += (mouseX - cellX) * 0.15;
        cellY += (mouseY - cellY) * 0.15;

        // Smooth growth towards target radius
        cellR += (targetR - cellR) * 0.12;

        // Sync black hole size with player cell in survival mode
        if (bhNode) {
          const bhG = cG.filter(d => d.id === bhNode.id);
          bhG.select(".company-bubble").attr("r", cellR);
          // Scale all effect circles proportionally
          const bhCircles = bhG.selectAll("circle:not(.company-bubble)").nodes();
          const bhEllipses = bhG.selectAll("ellipse").nodes();
          const origBhR = origRadii[bhNode.id] || 20;
          const scale = cellR / origBhR;
          bhCircles.forEach(c => {
            const cls = c.getAttribute("class") || "";
            if (cls.includes("bh-ring")) d3.select(c).attr("r", origBhR * 1.6 * scale);
            else {
              const origR = parseFloat(c.getAttribute("data-orig-r") || c.getAttribute("r"));
              if (!c.getAttribute("data-orig-r")) c.setAttribute("data-orig-r", origR);
              d3.select(c).attr("r", origR * scale);
            }
          });
          bhEllipses.forEach(e => {
            const origRx = parseFloat(e.getAttribute("data-orig-rx") || e.getAttribute("rx"));
            const origRy = parseFloat(e.getAttribute("data-orig-ry") || e.getAttribute("ry"));
            if (!e.getAttribute("data-orig-rx")) { e.setAttribute("data-orig-rx", origRx); e.setAttribute("data-orig-ry", origRy); }
            d3.select(e).attr("rx", origRx * scale).attr("ry", origRy * scale);
          });
        }

        // Auto-camera: directly set g transform (bypasses zoom handler = no stutter)
        const targetScale = Math.min(1.2, Math.max(0.15, (vh * 0.15) / cellR));
        camScale += (targetScale - camScale) * 0.03;
        const targetCamX = vw / 2 - cellX * camScale;
        const targetCamY = vh / 2 - cellY * camScale;
        camX += (targetCamX - camX) * 0.05;
        camY += (targetCamY - camY) * 0.05;
        g.attr("transform", `translate(${camX},${camY}) scale(${camScale})`);

        // Update minimap with game camera
        agarCellPosRef.current = { x: cellX, y: cellY };
        if (frame % 3 === 0 && drawMinimapRef.current) {
          drawMinimapRef.current({ k: camScale, x: camX, y: camY });
        }

        // Keep simulation alive
        if (sim && sim.alpha() < 0.03) sim.alpha(0.08).restart();

        // Pulsing membrane
        const pulse = 1 + Math.sin(frame * 0.08) * 0.03;
        const membraneR = cellR * (1.05 + Math.sin(frame * 0.06) * 0.02);

        // Update cell visuals
        cell.attr("cx", cellX).attr("cy", cellY).attr("r", cellR * pulse);
        cellGlow.attr("cx", cellX).attr("cy", cellY).attr("r", cellR * 1.3);
        membrane.attr("cx", cellX).attr("cy", cellY).attr("r", membraneR)
          .attr("stroke-dashoffset", frame * 0.5);
        innerGlow.attr("cx", cellX).attr("cy", cellY).attr("r", cellR * 0.6);
        const fontSize = Math.min(16, Math.max(9, cellR / 3.5));
        cellLabel.attr("x", cellX).attr("y", cellY).attr("font-size", fontSize);

        // Black hole collision (survival mode)
        if (bhNode) {
          const bhR = cellR; // synced with player size
          const bx = bhNode.x - cellX;
          const by = bhNode.y - cellY;
          const bDist = Math.sqrt(bx * bx + by * by);
          if (bDist < bhR + cellR * 0.3) {
            endGame(null, true);
            return;
          }
        }

        // Check collision
        for (let i = 0; i < others.length; i++) {
          const other = others[i];
          if (eaten.has(other.id)) continue;
          if (isSurvival && other.name === "Unbekannt") continue; // can't eat the black hole
          const otherR = origRadii[other.id] || 10;
          const dx = other.x - cellX;
          const dy = other.y - cellY;
          const distSq = dx * dx + dy * dy;
          const threshold = cellR - otherR * 0.3;

          if (threshold > 0 && distSq < threshold * threshold) {
            eaten.add(other.id);
            score++;
            scoreEl.textContent = `Score: ${score}`;
            progressEl.textContent = `${score} / ${eatableCount}`;

            // Grow
            cellArea += Math.PI * otherR * otherR;
            targetR = Math.sqrt(cellArea / Math.PI);

            // Particle burst
            const otherColor = companyColors[other.id] || cc;
            spawnParticles(other.x, other.y, otherColor, 8);

            // Shrink all elements of eaten company into the cell
            const eatenG = cG.filter(d => d.id === other.id);
            eatenG.classed("agar-eaten", true); // flag so tick handler skips it
            eatenG
              .transition().duration(350).ease(d3.easeCubicIn)
              .attr("transform", `translate(${cellX},${cellY}) scale(0)`)
              .attr("opacity", 0)
              .on("end", function() { d3.select(this).style("display", "none"); });

            const companyName = other.id.replace("company_", "");
            if (cN) cN.filter(d => d.company === companyName)
              .transition().duration(300).attr("r", 0).attr("opacity", 0);

            if (link) link.filter(d => {
              const sId = typeof d.source === "object" ? d.source.id : d.source;
              const tId = typeof d.target === "object" ? d.target.id : d.target;
              return sId === other.id || tId === other.id;
            }).transition().duration(300).attr("opacity", 0);

            if (companyLink) companyLink.filter(d => {
              const sId = typeof d.source === "object" ? d.source.id : d.source;
              const tId = typeof d.target === "object" ? d.target.id : d.target;
              return sId === other.id || tId === other.id;
            }).transition().duration(300).attr("opacity", 0);

            // "+name" floating text
            agarGroup.append("text")
              .attr("x", other.x).attr("y", other.y)
              .attr("text-anchor", "middle")
              .attr("fill", otherColor)
              .attr("font-size", 12)
              .attr("font-weight", 700)
              .style("font-family", "'JetBrains Mono', monospace")
              .style("text-shadow", `0 0 6px ${otherColor}`)
              .text(`+${other.name}`)
              .transition().duration(1000).ease(d3.easeCubicOut)
              .attr("y", other.y - 40)
              .attr("opacity", 0)
              .remove();
          }
        }

        // Win condition
        if (eaten.size >= eatableCount) {
          endGame("NETZWERK DOMINIERT!", false);
          return;
        }
        gameLoopId = requestAnimationFrame(gameStep);
      };

      const countdownTimer = setTimeout(() => {
        gameRunning = true;
        gameLoopId = requestAnimationFrame(gameStep);
      }, 2400);

      let endGameCalled = false;
      const endGame = (msg, isGameOver) => {
        if (endGameCalled) return;
        endGameCalled = true;
        gameRunning = false;
        clearTimeout(countdownTimer);
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        window.removeEventListener("mousemove", onMouseMove);

        // Remove flee force and restore original center gravity
        if (sim) {
          sim.force("agar-flee", null);
          sim.force("x", d3.forceX(svgRect.width / 2).strength(0.03));
          sim.force("y", d3.forceY(svgRect.height / 2).strength(0.03));
        }

        // Sync D3 zoom internal state to match current camera, then re-enable
        const zoom = zoomRef.current;
        if (zoom) {
          svgEl.__zoom = d3.zoomIdentity.translate(camX, camY).scale(camScale);
          svgSel.call(zoom);
        }

        // Clean up agar-specific defs and HUD
        defs.select("#agar-cell-grad").remove();
        defs.select("#agar-glow").remove();
        document.querySelector(".agar-countdown-overlay")?.remove();
        hudContainer.style.transition = "opacity 0.4s ease";
        hudContainer.style.opacity = "0";
        setTimeout(() => hudContainer.remove(), 400);

        const endScreenDelay = (msg || isGameOver) ? 4000 : 500;
        const pct = eatableCount > 0 ? Math.round((score / eatableCount) * 100) : 0;
        const elapsed = isSurvival ? Math.round(timeLeft) : Math.round(totalTime - Math.max(0, timeLeft));

        const buildEndScreen = (isVictory) => {
          // Fullscreen DOM overlay
          const overlay = document.createElement("div");
          overlay.className = "agar-end-overlay";
          Object.assign(overlay.style, {
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0)", zIndex: 9999, pointerEvents: "none",
            fontFamily: "'JetBrains Mono', monospace", transition: "background 0.5s ease",
          });
          document.body.appendChild(overlay);
          requestAnimationFrame(() => { overlay.style.background = "rgba(0,0,0,0.7)"; });

          // Title
          const title = document.createElement("div");
          Object.assign(title.style, {
            fontSize: isVictory ? "56px" : "52px", fontWeight: 700, letterSpacing: "2px",
            color: isVictory ? "#FFD700" : "#EF4444",
            textShadow: isVictory ? "0 0 40px #FFD700, 0 0 80px #FFD70060" : "0 0 30px #EF4444, 0 0 60px #EF444440",
            opacity: 0, transform: "scale(0.8) translateY(20px)",
            transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          });
          title.textContent = isVictory ? "NETZWERK DOMINIERT!" : "GAME OVER";
          overlay.appendChild(title);
          setTimeout(() => { title.style.opacity = "1"; title.style.transform = "scale(1) translateY(0)"; }, 100);

          // Subtitle
          const subtitle = document.createElement("div");
          Object.assign(subtitle.style, {
            fontSize: "14px", fontWeight: 400, color: isVictory ? "#FFD700" : "#F59E0B",
            opacity: 0, marginTop: "8px", letterSpacing: "4px", textTransform: "uppercase",
            transition: "opacity 0.4s ease",
          });
          subtitle.textContent = isVictory ? "Alle Firmen absorbiert" : (isSurvival ? "Vom Schwarzen Loch verschlungen" : "Zeit abgelaufen");
          overlay.appendChild(subtitle);
          setTimeout(() => { subtitle.style.opacity = "0.7"; }, 400);

          // Divider
          const divider = document.createElement("div");
          Object.assign(divider.style, {
            width: "0px", height: "1px", marginTop: "28px", marginBottom: "24px",
            background: `linear-gradient(90deg, transparent, ${isVictory ? "#FFD700" : "#ffffff"}40, transparent)`,
            transition: "width 0.6s ease",
          });
          overlay.appendChild(divider);
          setTimeout(() => { divider.style.width = "240px"; }, 300);

          // Stats grid
          const stats = document.createElement("div");
          Object.assign(stats.style, {
            display: "flex", gap: "40px", opacity: 0, transform: "translateY(10px)",
            transition: "all 0.4s ease",
          });

          const addStat = (value, label) => {
            const col = document.createElement("div");
            Object.assign(col.style, { textAlign: "center" });
            const val = document.createElement("div");
            Object.assign(val.style, {
              fontSize: "36px", fontWeight: 700,
              color: isVictory ? "#FFD700" : "#fff",
            });
            val.textContent = value;
            const lbl = document.createElement("div");
            Object.assign(lbl.style, { fontSize: "10px", color: "#ffffff80", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" });
            lbl.textContent = label;
            col.appendChild(val);
            col.appendChild(lbl);
            stats.appendChild(col);
          };

          addStat(`${score}/${eatableCount}`, "Firmen");
          addStat(`${pct}%`, "Absorbiert");
          addStat(`${elapsed}s`, "Zeit");

          overlay.appendChild(stats);
          setTimeout(() => { stats.style.opacity = "1"; stats.style.transform = "translateY(0)"; }, 600);

          // Rating
          const rating = document.createElement("div");
          Object.assign(rating.style, {
            marginTop: "24px", fontSize: "13px", color: "#ffffff60",
            opacity: 0, transition: "opacity 0.4s ease",
          });
          const ratingText = pct === 100 ? "Perfekt!" : pct >= 75 ? "Beeindruckend!" : pct >= 50 ? "Nicht schlecht!" : pct >= 25 ? "Mehr Hunger?" : "Nochmal versuchen!";
          rating.textContent = ratingText;
          overlay.appendChild(rating);
          setTimeout(() => { rating.style.opacity = "1"; }, 800);

          // Clean up later
          setTimeout(() => {
            overlay.style.transition = "opacity 0.6s ease";
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 600);
          }, endScreenDelay - 600);
        };

        if (msg) {
          // Victory — particle explosion in SVG
          spawnParticles(cellX, cellY, "#FFD700", 20);
          buildEndScreen(true);
        }

        if (isGameOver) {
          // Cell shrink animation
          cell.transition().duration(600)
            .attr("r", 0).attr("opacity", 0);
          membrane.transition().duration(600)
            .attr("r", 0).attr("opacity", 0);
          cellGlow.transition().duration(600)
            .attr("r", 0).attr("opacity", 0);
          cellLabel.transition().duration(400).attr("opacity", 0);

          buildEndScreen(false);
        }

        // After delay, restore everything
        setTimeout(() => {
          agarGroup.transition().duration(500).attr("opacity", 0).remove();
          document.querySelector(".agar-end-overlay")?.remove();

          // Restore all company groups (bubbles + labels + corona + pointer events)
          if (cG) {
            cG.classed("agar-eaten", false).style("pointer-events", null).style("display", null);
            cG.attr("transform", d => `translate(${d.x},${d.y}) scale(1)`);
            cG.transition().duration(400).delay(() => Math.random() * 300)
              .attr("opacity", 1);
            // Restore original bubble radii
            cG.each(function(d) {
              const orig = origRadii[d.id];
              if (orig) d3.select(this).select(".company-bubble").attr("r", orig);
            });
            // Restore black hole effect sizes
            if (bhNode) {
              const bhG = cG.filter(d => d.id === bhNode.id);
              bhG.selectAll("circle:not(.company-bubble)").each(function() {
                const origR = this.getAttribute("data-orig-r");
                if (origR) { this.setAttribute("r", origR); this.removeAttribute("data-orig-r"); }
              });
              bhG.selectAll("ellipse").each(function() {
                const origRx = this.getAttribute("data-orig-rx");
                const origRy = this.getAttribute("data-orig-ry");
                if (origRx) { this.setAttribute("rx", origRx); this.removeAttribute("data-orig-rx"); }
                if (origRy) { this.setAttribute("ry", origRy); this.removeAttribute("data-orig-ry"); }
              });
            }
          }

          // Mark game as inactive
          agarActiveRef.current = false;
          agarCellPosRef.current = null;
          agarEatenRef.current = null;
          // ── Restore game initial state: bring everything back ──
          // Contact dots — reset radius and opacity
          if (cN) {
            const isLargeNet = (nodesRef.current?.length || 0) > 200;
            const contactRadius = (d) => isLargeNet ? 1.5 + (d.normalizedInfluence || 0) * 4 : 2.5 + (d.normalizedInfluence || 0) * 7;
            cN.attr("r", contactRadius)
              .transition().duration(400).delay(() => Math.random() * 200)
              .attr("opacity", 0.85);
          }
          // Contact-to-company links
          if (link) link.transition().duration(300).attr("opacity", 1);
          // Company-to-company arrows
          if (companyLink) companyLink.transition().duration(300).attr("opacity", d => d.type === "inferred" ? 0.45 : 0.65);
          // Labels + hit areas
          const clLabel2 = companyLinkLabelRef.current;
          const clLabelBg2 = companyLinkLabelBgRef.current;
          if (clLabel2) clLabel2.attr("display", showRelationshipLabelsRef.current ? null : "none");
          if (clLabelBg2) clLabelBg2.attr("display", showRelationshipLabelsRef.current ? null : "none");
          g.selectAll(".company-link-hit").attr("display", null);
          // Contact groups — restore toggle state
          const contactGrp2 = contactGroupRef.current;
          if (contactGrp2) contactGrp2.attr("display", showContactDotsRef.current ? null : "none");
          const linkGrp2 = contactLinkGroupRef.current;
          if (linkGrp2) linkGrp2.attr("display", showContactLinesRef.current ? null : "none");
          // Company text — restore toggle state
          g.selectAll(".company-text").attr("display", showCompanyTextRef.current ? null : "none");
          // Sun corona/orbit rings
          g.selectAll(".sun-corona, .sun-corona-outer, .sun-scalable").attr("display", null);
          // Black hole effects
          g.selectAll(".bh-ring").attr("display", null);
          g.selectAll("[filter='url(#bh-glow)']").attr("display", null);

          // Restore user "ICH" bubble
          if (uG) uG.transition().duration(400).attr("opacity", 1);

          const rect = containerRef.current?.getBoundingClientRect();
          if (rect && userNode) {
            userNode.fx = rect.width / 2;
            userNode.fy = rect.height / 2;
          }

          if (sim) sim.alpha(0.3).restart();

          // Re-apply selection state if a company was selected before the game
          // Use setTimeout so the restore transitions finish first
          setTimeout(() => {
            const sel = selectedCompanyRef.current;
            if (sel && onCompanyClick) {
              // Force re-trigger by deselecting then reselecting
              onCompanyClick(null);
              requestAnimationFrame(() => onCompanyClick(sel));
            }
            // Redraw minimap
            if (drawMinimapRef.current && svgRef.current) {
              const svgNode = svgRef.current.node ? svgRef.current.node() : svgRef.current;
              drawMinimapRef.current(d3.zoomTransform(svgNode));
            }
          }, 500);

          // Restore minimap position
          const mmCanvas2 = minimapRef.current;
          if (mmCanvas2) {
            mmCanvas2.style.bottom = "85px";
            mmCanvas2.style.right = "65px";
          }

          // Restore sidebar, top bar, and overlays
          window.dispatchEvent(new CustomEvent("agar-fullscreen", { detail: { active: false } }));

          active = false;
          cleanup = null;
        }, endScreenDelay);
      };

      return () => endGame(null, false);
    };

    const svgEl = svgRef.current;
    if (svgEl) {
      svgEl.addEventListener("agar-start", agarStartHandler);
    }
    window.addEventListener("keydown", escHandler);
    return () => {
      if (svgEl) {
        svgEl.removeEventListener("agar-start", agarStartHandler);
      }
      window.removeEventListener("keydown", escHandler);
      if (cleanup) cleanup();
    };
  }, [userCompanyColor]);

  const onMinimapMouseDown = (e) => {
    e.preventDefault();
    const canvas = minimapRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const nav = (clientX, clientY) => {
      const info = minimapInfoRef.current;
      const zoomB = zoomRef.current;
      const svgEl = svgRef.current;
      if (!info || !zoomB || !svgEl || !containerRef.current) return;
      const mx = clientX - canvasRect.left;
      const my = clientY - canvasRect.top;
      const worldX = (mx - info.offsetX) / info.scale + info.x0;
      const worldY = (my - info.offsetY) / info.scale + info.y0;
      const cr = containerRef.current.getBoundingClientRect();
      const k = d3.zoomTransform(svgEl).k;
      const t = d3.zoomIdentity
        .translate(cr.width / 2 - worldX * k, cr.height / 2 - worldY * k)
        .scale(k);
      d3.select(svgEl).call(zoomB.transform, t);
    };

    nav(e.clientX, e.clientY);

    const onMove = (e2) => nav(e2.clientX, e2.clientY);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={containerRef} style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      {network.companyNodes.length > 0 && (
        <canvas
          ref={minimapRef}
          width={260}
          height={180}
          onMouseDown={onMinimapMouseDown}
          style={{
            position: "absolute",
            bottom: 85,
            right: 65,
            width: 260,
            height: 180,
            borderRadius: 6,
            border: `1px solid ${P.border}`,
            background: "rgba(10, 14, 20, 0.85)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
          }}
        />
      )}
    </div>
  );
});

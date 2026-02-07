import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { P } from '../styles/theme';
import { RELATIONSHIP_TYPES } from '../data/constants';

export function NetworkGraph({
  network,
  companyColors,
  showCompanyLinks,
  allCompanyLinks,
  linkingMode,
  onCompanyClick,
  setSelectedContact,
  userCompanyColor,
  focusNode,
  selectedCompany,
}) {
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
  const userBubbleRef = useRef(null);
  const selectedCompanyRef = useRef(null);
  selectedCompanyRef.current = selectedCompany;

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
      .attr("x", "-200%").attr("y", "-200%").attr("width", "500%").attr("height", "500%");
    sunGlow.append("feGaussianBlur").attr("stdDeviation", "18").attr("result", "b1");
    sunGlow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "6").attr("result", "b2");
    const sfm = sunGlow.append("feMerge");
    sfm.append("feMergeNode").attr("in", "b1");
    sfm.append("feMergeNode").attr("in", "b2");
    sfm.append("feMergeNode").attr("in", "SourceGraphic");

    // Radial gradient for sun core
    const sunGrad = defs.append("radialGradient").attr("id", "sun-gradient");
    sunGrad.append("stop").attr("offset", "0%").attr("stop-color", ucColor).attr("stop-opacity", 0.35);
    sunGrad.append("stop").attr("offset", "30%").attr("stop-color", ucColor).attr("stop-opacity", 0.18);
    sunGrad.append("stop").attr("offset", "60%").attr("stop-color", ucColor).attr("stop-opacity", 0.07);
    sunGrad.append("stop").attr("offset", "100%").attr("stop-color", ucColor).attr("stop-opacity", 0);

    // Corona classes (used for zoom-based opacity control, no CSS animation)
    svg.append("style").text(`
      .sun-corona, .sun-corona-outer { transition: opacity 0.3s ease; }
    `);

    // Arrow markers for company-to-company links
    const arrowTypes = {
      lead: { color: "#F59E0B", bidir: false },
      customer: { color: "#00E5A0", bidir: false },
      partner: { color: "#8B5CF6", bidir: true },
      investor: { color: "#3B82F6", bidir: false },
      competitor: { color: "#EF4444", bidir: true },
      inferred: { color: P.purple, bidir: false },
    };
    Object.entries(arrowTypes).forEach(([type, { color }]) => {
      defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10).attr("refY", 0)
        .attr("markerWidth", 5).attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L10,0L0,4")
        .attr("fill", color);
      // Reverse arrow for bidirectional
      defs.append("marker")
        .attr("id", `arrow-${type}-rev`)
        .attr("viewBox", "-10 -5 10 10")
        .attr("refX", -10).attr("refY", 0)
        .attr("markerWidth", 5).attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L-10,0L0,4")
        .attr("fill", color);
    });

    const g = svg.append("g");
    gRef.current = g;
    let currentZoomScale = 1;
    let _linkGroup = null, _link = null;
    let _contactGroup = null, _cN = null;
    let linkThreshold = 1.0;
    let contactThreshold = 0.6;
    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", e => {
      g.attr("transform", e.transform);
      const prevScale = currentZoomScale;
      currentZoomScale = e.transform.k;
      // Only update effects when scale actually changes
      if (prevScale !== currentZoomScale) {
        // Toggle contact dots based on zoom level
        if (_contactGroup) {
          if (currentZoomScale >= contactThreshold && prevScale < contactThreshold) {
            // Sync positions before showing (they may have drifted while hidden)
            _cN.attr("cx", d => d.x).attr("cy", d => d.y);
            _contactGroup.attr("display", null);
          } else if (currentZoomScale < contactThreshold && prevScale >= contactThreshold) {
            _contactGroup.attr("display", "none");
          }
        }
        // Toggle contact-to-company links based on zoom level
        if (_linkGroup) {
          if (currentZoomScale >= linkThreshold && prevScale < linkThreshold) {
            _linkGroup.attr("display", null);
            _link.attr("display", null);
          } else if (currentZoomScale < linkThreshold && prevScale >= linkThreshold) {
            _linkGroup.attr("display", "none");
          }
        }
        // Scale corona/glow intensity with zoom — bigger glow when zoomed out, subtle when zoomed in
        const glowOpacity = Math.max(0.1, Math.min(1, (1.8 - currentZoomScale) / 1.2));
        g.selectAll(".sun-corona, .sun-corona-outer").style("opacity", glowOpacity);
        g.selectAll(".sun-glow-bubble").attr("filter", currentZoomScale < 2.5 ? "url(#sun-glow)" : "none");
      }
    });
    svg.call(zoom);
    zoomRef.current = zoom;

    const allNodes = [
      ...network.companyNodes.filter(n => n.name !== "Unknown"),
      ...network.contactNodes.filter(n => n.company !== "Unknown")
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
    linkThreshold = isLargeNetwork ? 1.2 : 0.6;
    contactThreshold = isLargeNetwork ? 0.45 : 0.25;

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

    const companyLink = companyLinksRef.current = g.append("g").selectAll("path").data(companyLinkData).join("path")
      .attr("stroke", d => {
        if (d.type && RELATIONSHIP_TYPES[d.type]) {
          return RELATIONSHIP_TYPES[d.type].color;
        }
        return P.purple;
      })
      .attr("stroke-width", d => 1.5 + (d.strength || 0.5) * 2)
      .attr("stroke-opacity", d => d.type === "inferred" ? 0.3 : 0.6)
      .attr("stroke-dasharray", d => d.type === "inferred" ? "4,4" : "none")
      .attr("fill", "none")
      .attr("marker-end", d => `url(#arrow-${getArrowType(d)})`)
      .attr("marker-start", d => {
        const type = getArrowType(d);
        return arrowTypes[type]?.bidir ? `url(#arrow-${type}-rev)` : null;
      });

    // Contact-to-company links — hidden when zoomed out, visible when zoomed in
    const linkGroup = g.append("g");
    const link = contactLinksRef.current = linkGroup.selectAll("line").data(links).join("line")
      .attr("stroke", d => {
        const tid = typeof d.target === "object" ? d.target.id : d.target;
        return (companyColors[tid] || P.border) + "20";
      })
      .attr("stroke-width", isLargeNetwork ? 0.3 : 0.6);
    linkGroup.attr("display", "none");
    _linkGroup = linkGroup;
    _link = link;

    // Company bubbles
    const hoveredCompanyId = { current: null };
    const cG = companyGroupsRef.current = g.append("g").selectAll("g").data(nodes.filter(n => n.type === "company")).join("g")
      .attr("cursor", linkingMode ? "crosshair" : "pointer")
      .on("click", (_, d) => onCompanyClick(d))
      .on("mouseover", function(_, d) {
        hoveredCompanyId.current = d.id;
        const group = d3.select(this);
        const color = companyColors[d.id] || P.accent;
        if (d.isUserCompany) {
          group.select(".sun-glow-bubble")
            .transition().duration(200)
            .attr("stroke-width", 3.5)
            .attr("fill", `${ucColor}40`);
        } else {
          group.select(".company-bubble")
            .transition().duration(200)
            .attr("stroke-width", 2.5)
            .attr("stroke", color + "90")
            .attr("fill", color + "20");
        }
      })
      .on("mouseout", function(_, d) {
        hoveredCompanyId.current = null;
        const group = d3.select(this);
        const color = companyColors[d.id] || P.accent;
        if (d.isUserCompany) {
          group.select(".sun-glow-bubble")
            .transition().duration(300)
            .attr("stroke-width", 2.5)
            .attr("fill", `${ucColor}30`);
        } else {
          group.select(".company-bubble")
            .transition().duration(300)
            .attr("stroke-width", 1.5)
            .attr("stroke", color + "40")
            .attr("fill", color + "10");
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

    // Outer corona for user's company (rendered behind everything in the group)
    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 6)
      .attr("fill", "url(#sun-gradient)")
      .attr("class", "sun-corona-outer")
      .attr("pointer-events", "none");

    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 4)
      .attr("fill", "url(#sun-gradient)")
      .attr("class", "sun-corona")
      .attr("pointer-events", "none");

    // Ring accents
    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 5)
      .attr("fill", "none")
      .attr("stroke", ucColor + "15")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,6")
      .attr("class", "sun-corona")
      .attr("pointer-events", "none");

    cG.filter(d => d.isUserCompany).append("circle")
      .attr("r", d => getCompanyRadius(d) * 3)
      .attr("fill", "none")
      .attr("stroke", ucColor + "20")
      .attr("stroke-width", 0.8)
      .attr("class", "sun-corona")
      .attr("pointer-events", "none");

    // Main bubble
    cG.append("circle")
      .attr("r", getCompanyRadius)
      .attr("fill", d => d.isUserCompany
        ? `${ucColor}30`
        : (companyColors[d.id] || P.accent) + "10")
      .attr("stroke", d => d.isUserCompany
        ? ucColor
        : (companyColors[d.id] || P.accent) + "40")
      .attr("stroke-width", d => d.isUserCompany ? 2.5 : 1.5)
      .attr("filter", d => d.isUserCompany ? "url(#sun-glow)" : "none")
      .attr("class", d => d.isUserCompany ? "sun-glow-bubble" : "company-bubble");

    const formatSize = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
      return n.toString();
    };

    cG.append("text")
      .text(d => {
        const radius = getCompanyRadius(d);
        const maxLen = d.isUserCompany ? 25 : Math.max(8, Math.min(18, Math.floor(radius / 4)));
        return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + "…" : d.name;
      })
      .attr("text-anchor", "middle").attr("dy", "-0.3em")
      .attr("fill", d => d.isUserCompany ? ucColor : (companyColors[d.id] || P.accent))
      .attr("font-size", d => {
        if (d.isUserCompany) return 14;
        const sizeScale = Math.log10(Math.max(d.estimatedSize || 100, 10));
        return Math.min(7 + sizeScale * 1.2, 13);
      })
      .attr("font-weight", d => d.isUserCompany ? 700 : 600)
      .style("font-family", "'JetBrains Mono', monospace").attr("pointer-events", "none");

    cG.append("text").text(d => formatSize(d.estimatedSize || 0))
      .attr("text-anchor", "middle").attr("dy", "1em")
      .attr("fill", P.textMuted)
      .attr("font-size", d => {
        const sizeScale = Math.log10(Math.max(d.estimatedSize || 100, 10));
        return Math.min(7 + sizeScale * 0.8, 12);
      })
      .attr("font-weight", 700)
      .style("font-family", "'JetBrains Mono', monospace").attr("pointer-events", "none");

    cG.append("text").text(d => d.isUserCompany ? "MEINE FIRMA" : `${d.memberCount} conn.`)
      .attr("text-anchor", "middle").attr("dy", "2.2em")
      .attr("fill", d => d.isUserCompany ? ucColor + "80" : P.textDim)
      .attr("font-size", d => d.isUserCompany ? 8 : 6)
      .attr("font-weight", d => d.isUserCompany ? 600 : 500)
      .attr("letter-spacing", d => d.isUserCompany ? "1px" : "0")
      .style("font-family", "'JetBrains Mono', monospace").attr("pointer-events", "none");

    // User bubble (rendered separately, larger and labeled)
    const userNode = nodes.find(n => n.type === "contact" && n.isUser);
    if (userNode) {
      const uG = userBubbleRef.current = g.append("g").selectAll("g")
        .data([userNode]).join("g")
        .attr("cursor", "pointer")
        .on("click", (_, d) => { setSelectedContact(d); })
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

    const contactGroup = g.append("g");
    _contactGroup = contactGroup;

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
        // Always show this contact's links on hover
        linkGroup.attr("display", null);
        link.attr("display", l => (l.source.id === d.id || l.target.id === d.id) ? null : "none");
        setSelectedContact(d);
      })
      .on("mouseout", function(_, d) {
        const sc = selectedCompanyRef.current;
        if (sc && d.company !== sc.name) return;
        d3.select(this)
          .attr("r", contactRadius(d))
          .attr("opacity", sc ? 1 : 0.85);
        // Restore zoom-based visibility
        if (currentZoomScale >= linkThreshold) {
          link.attr("display", null);
        } else {
          linkGroup.attr("display", "none");
        }
      })
      .on("click", (_, d) => { setSelectedContact(d); })
      .call(drag);
    contactDotsRef.current = cN;
    _cN = cN;

    // Node lookup for company links
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let tickCount = 0;

    sim.on("tick", () => {
      tickCount++;
      // Update contact-to-company links every 3rd tick when visible
      if (currentZoomScale >= linkThreshold && tickCount % 3 === 0) {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      }

      companyLink.each(function(d) {
        const sourceNode = nodeMap.get(typeof d.source === "object" ? d.source.id : d.source);
        const targetNode = nodeMap.get(typeof d.target === "object" ? d.target.id : d.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / dist, uy = dy / dist;
          const sr = getCompanyRadius(sourceNode) + 4;
          const tr = getCompanyRadius(targetNode) + 4;
          const x1 = sourceNode.x + ux * sr;
          const y1 = sourceNode.y + uy * sr;
          const x2 = targetNode.x - ux * tr;
          const y2 = targetNode.y - uy * tr;
          const curve = linkCurve.get(d) || 0;
          if (curve === 0) {
            d3.select(this).attr("d", `M${x1},${y1}L${x2},${y2}`);
          } else {
            // Use canonical direction so curves bow consistently regardless of link direction
            const sId = typeof d.source === "object" ? d.source.id : d.source;
            const tId = typeof d.target === "object" ? d.target.id : d.target;
            const flip = sId > tId ? -1 : 1;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const cpx = mx + (-uy) * dist * curve * flip;
            const cpy = my + ux * dist * curve * flip;
            d3.select(this).attr("d", `M${x1},${y1}Q${cpx},${cpy} ${x2},${y2}`);
          }
        }
      });

      cG.attr("transform", d => {
        const s = hoveredCompanyId.current === d.id ? 1.06 : 1;
        return `translate(${d.x},${d.y}) scale(${s})`;
      });
      // Only update contact dot positions when they're visible
      if (currentZoomScale >= contactThreshold) {
        cN.attr("cx", d => d.x).attr("cy", d => d.y);
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

    return () => sim.stop();
  }, [network, companyColors, showCompanyLinks, allCompanyLinks, linkingMode, onCompanyClick, setSelectedContact, userCompanyColor]);

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

  // Highlight big players when a company is selected
  useEffect(() => {
    if (!gRef.current || !contactDotsRef.current || !nodesRef.current) return;
    const g = gRef.current;
    const cN = contactDotsRef.current;

    // Remove any previous highlight labels
    g.selectAll(".big-player-label").remove();
    g.selectAll(".big-player-ring").remove();

    if (!selectedCompany) {
      // Reset all contact dots to normal
      cN.attr("opacity", 0.85);
      return;
    }

    const companyName = selectedCompany.name;

    // Dim contacts from other companies, highlight selected company's contacts
    cN.attr("opacity", d => d.company === companyName ? 1 : 0.15);

    // Find big players: top contacts by seniority/influence in this company
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
  }, [selectedCompany, companyColors]);

  // Easter egg: double-click your company → agar.io mode
  useEffect(() => {
    let active = false;
    let cleanup = null;

    const escHandler = (e) => {
      if (active && e.key === "Escape" && cleanup) cleanup();
    };

    const agarStartHandler = () => {
      if (active) return;
      active = true;
      cleanup = runAgar();
    };

    const formatTimer = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const runAgar = () => {
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

      // Disable hover/click on company bubbles during game
      if (cG) cG.style("pointer-events", "none");

      // Hide sidebar, top bar, and overlays
      window.dispatchEvent(new CustomEvent("agar-fullscreen", { detail: { active: true } }));

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
      if (sim) {
        sim.force("agar-flee", () => {
          others.forEach(other => {
            if (eaten.has(other.id)) return;
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

      const totalTime = 30;
      let timeLeft = totalTime;

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
      progressEl.textContent = `0 / ${others.length}`;
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
      timerEl.textContent = formatTimer(totalTime);
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

        // Timer countdown
        timeLeft -= 1 / 60;
        if (frame % 3 === 0) {
          timerEl.textContent = formatTimer(Math.max(0, timeLeft));
          if (timeLeft <= 10) timerEl.style.color = timeLeft <= 5 ? "#EF4444" : "#F59E0B";
        }
        if (timeLeft <= 0) { endGame(null, true); return; }

        // Follow mouse with gravity
        cellX += (mouseX - cellX) * 0.15;
        cellY += (mouseY - cellY) * 0.15;

        // Smooth growth towards target radius
        cellR += (targetR - cellR) * 0.12;

        // Auto-camera: directly set g transform (bypasses zoom handler = no stutter)
        const targetScale = Math.min(1.2, Math.max(0.15, (vh * 0.15) / cellR));
        camScale += (targetScale - camScale) * 0.03;
        const targetCamX = vw / 2 - cellX * camScale;
        const targetCamY = vh / 2 - cellY * camScale;
        camX += (targetCamX - camX) * 0.05;
        camY += (targetCamY - camY) * 0.05;
        g.attr("transform", `translate(${camX},${camY}) scale(${camScale})`);

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

        // Check collision
        for (let i = 0; i < others.length; i++) {
          const other = others[i];
          if (eaten.has(other.id)) continue;
          const otherR = origRadii[other.id] || 10;
          const dx = other.x - cellX;
          const dy = other.y - cellY;
          const distSq = dx * dx + dy * dy;
          const threshold = cellR - otherR * 0.3;

          if (threshold > 0 && distSq < threshold * threshold) {
            eaten.add(other.id);
            score++;
            scoreEl.textContent = `Score: ${score}`;
            progressEl.textContent = `${score} / ${others.length}`;

            // Grow
            cellArea += Math.PI * otherR * otherR;
            targetR = Math.sqrt(cellArea / Math.PI);

            // Particle burst
            const otherColor = companyColors[other.id] || cc;
            spawnParticles(other.x, other.y, otherColor, 8);

            // Shrink eaten company into the cell
            const eatenG = cG.filter(d => d.id === other.id);
            eatenG
              .transition().duration(350).ease(d3.easeCubicIn)
              .attr("transform", `translate(${cellX},${cellY}) scale(0)`)
              .attr("opacity", 0);

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
        if (eaten.size >= others.length) {
          endGame("NETZWERK DOMINIERT!", false);
          return;
        }
        gameLoopId = requestAnimationFrame(gameStep);
      };

      const countdownTimer = setTimeout(() => {
        gameRunning = true;
        gameLoopId = requestAnimationFrame(gameStep);
      }, 2400);

      const endGame = (msg, isGameOver) => {
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
        const pct = others.length > 0 ? Math.round((score / others.length) * 100) : 0;
        const elapsed = Math.round(totalTime - Math.max(0, timeLeft));

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
          subtitle.textContent = isVictory ? "Alle Firmen absorbiert" : "Zeit abgelaufen";
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

          addStat(`${score}/${others.length}`, "Firmen");
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
            cG.style("pointer-events", null);
            cG.attr("transform", d => `translate(${d.x},${d.y}) scale(1)`);
            cG.transition().duration(400).delay(() => Math.random() * 300)
              .attr("opacity", 1);
          }

          // Restore contact dots
          if (cN) cN.transition().duration(400).delay(() => Math.random() * 200)
            .attr("opacity", 0.85);

          // Restore contact-to-company links
          if (link) link.transition().duration(300).attr("opacity", 1);

          // Restore company-to-company arrows
          if (companyLink) companyLink.transition().duration(300).attr("opacity", 1);

          // Restore user "ICH" bubble
          if (uG) uG.transition().duration(400).attr("opacity", 1);

          const rect = containerRef.current?.getBoundingClientRect();
          if (rect && userNode) {
            userNode.fx = rect.width / 2;
            userNode.fy = rect.height / 2;
          }

          if (sim) sim.alpha(0.3).restart();

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

  return (
    <div ref={containerRef} style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

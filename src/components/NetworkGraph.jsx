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
      customer: { color: "#00E5A0", bidir: false },
      supplier: { color: "#F59E0B", bidir: false },
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
        .attr("markerWidth", 3).attr("markerHeight", 5)
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
    let linkThreshold = 1.0;
    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", e => {
      g.attr("transform", e.transform);
      const prevScale = currentZoomScale;
      currentZoomScale = e.transform.k;
      // Only update effects when scale actually changes
      if (prevScale !== currentZoomScale) {
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

    const drag = d3.drag()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });

    // Company-to-company links
    const companyLinkData = showCompanyLinks ? allCompanyLinks.filter(l => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      return idSet.has(sourceId) && idSet.has(targetId);
    }) : [];

    const getArrowType = (d) => d.type && arrowTypes[d.type] ? d.type : "inferred";

    const companyLink = g.append("g").selectAll("path").data(companyLinkData).join("path")
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
    const link = linkGroup.selectAll("line").data(links).join("line")
      .attr("stroke", d => {
        const tid = typeof d.target === "object" ? d.target.id : d.target;
        return (companyColors[tid] || P.border) + "20";
      })
      .attr("stroke-width", isLargeNetwork ? 0.3 : 0.6);
    linkGroup.attr("display", "none");
    _linkGroup = linkGroup;
    _link = link;

    // Company bubbles
    const cG = g.append("g").selectAll("g").data(nodes.filter(n => n.type === "company")).join("g")
      .attr("cursor", linkingMode ? "crosshair" : "pointer")
      .on("click", (_, d) => onCompanyClick(d))
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
      .attr("class", d => d.isUserCompany ? "sun-glow-bubble" : null);

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
      const uG = g.append("g").selectAll("g")
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

    const cN = g.append("g").selectAll("circle").data(nodes.filter(n => n.type === "contact" && !n.isUser)).join("circle")
      .attr("r", contactRadius)
      .attr("fill", d => (companyColors[`company_${d.company}`] || P.textMuted) + "CC")
      .attr("stroke", d => d.seniority >= 8 ? P.gold + "BB" : "transparent")
      .attr("stroke-width", d => d.seniority >= 8 ? 1.5 : 0)
      .attr("cursor", "pointer").attr("opacity", 0.85)
      .on("mouseover", function(_, d) {
        d3.select(this)
          .attr("r", contactRadius(d) * 1.8)
          .attr("opacity", 1);
        // Always show this contact's links on hover
        linkGroup.attr("display", null);
        link.attr("display", l => (l.source.id === d.id || l.target.id === d.id) ? null : "none");
        setSelectedContact(d);
      })
      .on("mouseout", function(_, d) {
        d3.select(this)
          .attr("r", contactRadius(d))
          .attr("opacity", 0.85);
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
          // Offset by company bubble radius so arrows sit at the edge
          const sr = getCompanyRadius(sourceNode) + 4;
          const tr = getCompanyRadius(targetNode) + 4;
          const x1 = sourceNode.x + ux * sr;
          const y1 = sourceNode.y + uy * sr;
          const x2 = targetNode.x - ux * tr;
          const y2 = targetNode.y - uy * tr;
          d3.select(this).attr("d", `M${x1},${y1}L${x2},${y2}`);
        }
      });

      cG.attr("transform", d => `translate(${d.x},${d.y})`);
      cN.attr("cx", d => d.x).attr("cy", d => d.y);
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

// src\components\Gantt\logic\drawingLogic.js

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

// ---- BFS & Constraint logic ----
import {
    buildDownstreamMap,
    buildUpstreamMap,
    collectDownstream,
    collectUpstream,
    doTwoWayBFS
} from "./BFS.js";

import {
    clampTaskToConstraints,
    maybeSnap,
    mergeEphemeral
} from "./constraints.js";

// -------------------------------------------------------------------
// 1) Draw tasks + dependencies
// -------------------------------------------------------------------

export function renderTasksAndDependencies(svg, scale, tasks, cfg) {
    drawTasks(svg, scale, tasks, cfg);
    drawDependencies(svg, tasks, scale, tasks, cfg);
}

/**
 * Clamp a date's ms within [minMs, maxMs].
 */
function clampMs(ms, minMs, maxMs) {
    if (ms < minMs) return minMs;
    if (ms > maxMs) return maxMs;
    return ms;
}

/**
 * Draw the task bars and any text or handles within them, **clipping** bars if
 * they fall partly outside the domain. If clipped, show an arrow shape at the edge.
 */
export function drawTasks(svg, scale, tasks, cfg) {
    svg.selectAll(".task-group").remove();

    const domain = scale.domain();
    const domainMin = domain[0].getTime();
    const domainMax = domain[1].getTime();

    const gap = 0.2 * cfg.rowHeight;

    const gTask = svg.selectAll(".task-group")
        .data(tasks, d => d.id)
        .join("g")
        .attr("class","task-group");

    gTask.each(function(d, i) {
        const group = d3.select(this);

        // Original times
        const startMs = d.start.getTime();
        const endMs   = d.end.getTime();

        // If completely out of the visible domain, skip drawing
        if (endMs < domainMin || startMs > domainMax) {
            return;
        }

        // Calculate clamped boundaries
        const barStartMs = clampMs(startMs, domainMin, domainMax);
        const barEndMs   = clampMs(endMs, domainMin, domainMax);

        // Convert to X coords
        const x = scale(barStartMs);
        const w = scale(barEndMs) - x;
        const y = i * cfg.rowHeight + gap;
        const h = cfg.rowHeight - gap*2;

        // Draw the main bar (only the visible portion)
        group.append("rect")
            .attr("class","task-bar")
            .attr("x", x)
            .attr("y", y)
            .attr("width", w)
            .attr("height", h)
            .attr("rx",2)
            .attr("fill","#3497d9")
            .attr("stroke", "#256999")
            .attr("stroke-width",1)
            .style("filter","drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");

        // Draw label if there's enough room
        const labelX = x + 10;
        const labelY = i * cfg.rowHeight + (cfg.rowHeight / 2) + 5;
        const minWidthForText = 30;
        if (w > minWidthForText) {
            group.append("text")
                .attr("class", `task-label task-label-${d.id}`)
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("fill","white")
                .attr("font-size","15px")
                .attr("font-family","Roboto")
                .attr("font-weight",500)
                .attr("pointer-events","none")
                .attr("filter","drop-shadow(0px 1px 1px rgba(0,0,0,0.3))")
                .text(d.name);
        }

        // If truncated on the left side
        if (startMs < domainMin) {
            const yMid = y + h/2;
            // triangle pointing left
            group.append("path")
                .attr("class", "truncated-arrow-left")
                .attr("d", `M${x},${yMid} 
                            L${x-6},${yMid-6} 
                            L${x-6},${yMid+6} Z`)
                .attr("fill", "#cc0000");
        }

        // If truncated on the right side
        if (endMs > domainMax) {
            const barRightX = x + w;
            const yMid = y + h/2;
            // triangle pointing right
            group.append("path")
                .attr("class", "truncated-arrow-right")
                .attr("d", `M${barRightX},${yMid}
                            L${barRightX+6},${yMid-6}
                            L${barRightX+6},${yMid+6} Z`)
                .attr("fill", "#cc0000");
        }

        // Invisible handles for resizing
        const handleW = 8;
        // left handle
        group.append("rect")
            .attr("class","task-handle-left")
            .attr("x", x - handleW/2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", h)
            .attr("fill","transparent")
            .style("cursor","ew-resize");
        // right handle
        group.append("rect")
            .attr("class","task-handle-right")
            .attr("x", x + w - handleW/2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", h)
            .attr("fill","transparent")
            .style("cursor","ew-resize");
    });
}

/**
 * Draw dependencies (arrows) between tasks. (We’re still not clipping lines, but you can.)
 */
export function drawDependencies(svg, tasks, scale, allTasks, cfg) {
    svg.selectAll(".dependency-layer").remove();

    let defs = svg.select("defs");
    if (!defs.size()) defs = svg.append("defs");
    defs.selectAll("#arrowhead").remove();
    defs.append("marker")
        .attr("id","arrowhead")
        .attr("viewBox","0 -5 10 10")
        .attr("refX",8).attr("refY",0)
        .attr("markerWidth",6).attr("markerHeight",6)
        .attr("orient","auto")
        .append("path")
        .attr("d","M0,-5L10,0L0,5")
        .attr("fill","#555");

    const depLayer = svg.append("g").attr("class","dependency-layer");
    const tasksById = new Map(allTasks.map(t => [t.id, t]));
    const offset = 20;

    function pathData(px, py, cx, cy) {
        const inPx = px + offset;
        const inCx = cx - offset;
        const midX = inPx + (inCx - inPx)/2;
        return `M${px},${py}H${inPx}C${midX},${py} ${midX},${cy} ${inCx},${cy}H${cx}`;
    }

    tasks.forEach((child, i) => {
        if (!Array.isArray(child.dependencies)) return;
        const childY = i * cfg.rowHeight + cfg.rowHeight * 0.5;
        child.dependencies.forEach(dep => {
            const parent = tasksById.get(dep.id);
            if (!parent) return;
            const pi = allTasks.findIndex(t => t.id === dep.id);
            if (pi < 0) return;
            const parentY = pi * cfg.rowHeight + cfg.rowHeight * 0.5;
            const px = scale(parent.end);
            const cx = scale(child.start);

            depLayer.append("path")
                .attr("d", pathData(px, parentY, cx, childY))
                .attr("fill","none")
                .attr("stroke","#555")
                .attr("stroke-width",1.5)
                .attr("stroke-dasharray","4 2")
                .attr("marker-end","url(#arrowhead)");
        });
    });
}

// -------------------------------------------------------------------
// 2) Draw the "grid" lines behind tasks
// -------------------------------------------------------------------

export function drawGrid(scale, svg, range, cfg, tasks, mode="day") {
    svg.selectAll("*").remove();
    const marks = getTimeMarks(range, mode);
    const w = cfg.columnWidth * marks.length;
    const h = cfg.rowHeight * tasks.length;

    svg.attr("width", w).attr("height", h);

    const grid = svg.selectAll(".canvas-grid")
        .data(marks)
        .join("g")
        .attr("class","canvas-grid");

    // vertical lines
    grid.append("line")
        .attr("x1", d => scale(d))
        .attr("y1", 0)
        .attr("x2", d => scale(d))
        .attr("y2", h)
        .attr("stroke","#ccc")
        .attr("stroke-width",1);

    // horizontal lines (for each row)
    // We do tasks.length+1 lines, but for simplicity:
    for (let i = 0; i <= tasks.length; i++) {
        svg.append("line")
            .attr("x1", 0)
            .attr("y1", i * cfg.rowHeight)
            .attr("x2", w)
            .attr("y2", i * cfg.rowHeight)
            .attr("stroke","#ccc")
            .attr("stroke-width",1);
    }
}

// -------------------------------------------------------------------
// 3) Draw the "ruler" (time axis) across the top
// -------------------------------------------------------------------

export function drawRuler(scale, svg, range, cfg, mode="day") {
    svg.selectAll("*").remove();
    if (!scale || !svg || !range?.start || !range?.end) return;

    const marks = getTimeMarks(range, mode);
    const halfCol = cfg.columnWidth * 0.5;

    const groups = svg.selectAll(".large-mark")
        .data(marks)
        .join("g")
        .attr("class","large-mark");

    // optional line at each mark
    groups.append("line")
        .attr("class","ruler-line large-mark-line")
        .attr("x1", d => scale(d))
        .attr("y1", cfg.rulerHeight)
        .attr("x2", d => scale(d))
        .attr("y2", cfg.rulerHeight)
        .attr("stroke","black")
        .attr("stroke-width",1);

    // big text labels
    groups.append("text")
        .attr("class","ruler-text large-mark-text")
        .attr("x", d => scale(d) + halfCol)
        .attr("y", cfg.rulerHeight * 0.5)
        .attr("dominant-baseline","middle")
        .attr("text-anchor","middle")
        .attr("font-size","14px")
        .attr("font-family","Roboto")
        .text(d => ganttHelpers.timeHelper.formatDate(d, "d ddd").toUpperCase());
}

// -------------------------------------------------------------------
// 4) Utility for "day" increments
// -------------------------------------------------------------------

export function getTimeMarks({ start, end }, mode="day") {
    const s = ganttHelpers.timeHelper.getStartOfDay(start);
    const e = ganttHelpers.timeHelper.getEndOfDay(end);
    if (!s || !e || s > e) return [];

    // We'll do day increments no matter 7/14/30 days
    const marks = [];
    const cur = new Date(s);
    while (cur <= e) {
        marks.push(new Date(cur));
        cur.setDate(cur.getDate() + 1); // increment 1 day
    }
    return marks;
}

// -------------------------------------------------------------------
// 5) Setup Dragging
// -------------------------------------------------------------------

/**
 * We'll keep the BFS + constraint logic here and just call it after drawing tasks.
 */
export function setupDragging({
                                  svg,
                                  scale,
                                  tasks,
                                  defaults,
                                  snapEnabled,
                                  snapIncrement,
                                  setTasks,
                                  enforceConstraints
                              }) {
    const downstreamMap = buildDownstreamMap(tasks);
    const upstreamMap   = buildUpstreamMap(tasks);
    const byId = new Map(tasks.map(t => [t.id, t]));

    function commitChanges(ephemeralMap) {
        setTasks(mergeEphemeral(tasks, ephemeralMap));
    }

    function getLocalMouseX(event) {
        const [mx] = d3.pointer(event, svg.node());
        return mx;
    }

    const MIN_MS = 4 * 60 * 60 * 1000; // 4 hours

    // ---------- DRAG ENTIRE BAR -----------
    const dragBar = d3.drag()
        .on("start", function (event, d) {
            d3.select(this).attr("stroke", "black");

            d.__ephemeralMap = buildEphemeralMap(d, tasks, downstreamMap, upstreamMap, byId);

            // pinned domain offset
            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.start.getTime();
        })
        .on("drag", function (event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // shift entire bar
            const shiftMs = newStart.getTime() - me.start.getTime();
            me.start = new Date(me.start.getTime() + shiftMs);
            me.end   = new Date(me.end.getTime() + shiftMs);

            // Constraints
            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "move");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // Min 4 hours
            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                const diff = MIN_MS - dur;
                me.end = new Date(me.end.getTime() + diff);
            }

            // Re-draw ephemeral
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this).attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ---------- LEFT HANDLE -----------
    const dragLeft = d3.drag()
        .on("start", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", "black");
            d.__ephemeralMap = buildEphemeralMap(d, tasks, downstreamMap, upstreamMap, byId);

            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.start.getTime();
        })
        .on("drag", function (event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // keep newStart <= me.end
            if (newStart > me.end) return;
            me.start = newStart;

            // Constraints
            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "left");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // Min 4 hours
            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.start = new Date(me.end.getTime() - MIN_MS);
            }

            // Re-draw ephemeral
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ---------- RIGHT HANDLE -----------
    const dragRight = d3.drag()
        .on("start", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", "black");
            d.__ephemeralMap = buildEphemeralMap(d, tasks, downstreamMap, upstreamMap, byId);

            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.end.getTime();
        })
        .on("drag", function (event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newEnd = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // keep newEnd >= me.start
            if (newEnd < me.start) return;
            me.end = newEnd;

            // Constraints
            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "right");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // Min 4 hours
            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.end = new Date(me.start.getTime() + MIN_MS);
            }

            // Re-draw ephemeral
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // Attach the drags
    svg.selectAll(".task-bar").call(dragBar);
    svg.selectAll(".task-handle-left").call(dragLeft);
    svg.selectAll(".task-handle-right").call(dragRight);
}

/**
 * Build ephemeral copies for BFS constraints.
 */
function buildEphemeralMap(d, tasks, downstreamMap, upstreamMap, byId) {
    const ds = collectDownstream(d.id, downstreamMap);
    const us = collectUpstream(d.id, upstreamMap);
    const all = new Set([...ds, ...us, d.id]);

    const ephemeralMap = new Map();
    for (const tid of all) {
        const orig = byId.get(tid);
        if (!orig) continue;
        ephemeralMap.set(tid, {
            ...orig,
            start: new Date(orig.start),
            end: new Date(orig.end),
            dependencies: orig.dependencies
        });
    }
    return ephemeralMap;
}

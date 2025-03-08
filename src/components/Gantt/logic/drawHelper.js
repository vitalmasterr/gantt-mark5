// src\components\Gantt\logic\drawHelper.js

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

// If you already have BFS & constraints in separate files, keep these imports.
// Otherwise, you can inline them here.
import {
    buildDownstreamMap,
    buildUpstreamMap,
    collectDownstream,
    collectUpstream,
    doTwoWayBFS,
} from "./BFS.js";

import {
    clampTaskToConstraints,
    maybeSnap,
    mergeEphemeral
} from "./constraints.js";

/**
 * ------------------------------------------------------------------------
 * 1) "drawGrid" – draws background vertical/horizontal lines for each day/row
 * ------------------------------------------------------------------------
 */
function drawGrid(scale, svg, range, cfg, tasks, mode="day") {
    // Clear anything that may exist
    svg.selectAll("*").remove();

    // Build an array of daily "marks" from range.start to range.end
    const marks = getTimeMarks(range, mode);

    // Calculate total width = number of days * columnWidth
    const w = cfg.columnWidth * marks.length;
    const h = cfg.rowHeight * tasks.length;

    // Set the <svg> size
    svg.attr("width", w).attr("height", h);

    // Prepare a group for each day's vertical line
    const grid = svg.selectAll(".canvas-grid")
        .data(marks)
        .join("g")
        .attr("class", "canvas-grid");

    // Vertical line for each day
    grid.append("line")
        .attr("x1", d => scale(d))
        .attr("y1", 0)
        .attr("x2", d => scale(d))
        .attr("y2", h)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);

    // Horizontal lines for each row of tasks
    for (let i = 0; i <= tasks.length; i++) {
        svg.append("line")
            .attr("x1", 0)
            .attr("y1", i * cfg.rowHeight)
            .attr("x2", w)
            .attr("y2", i * cfg.rowHeight)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);
    }
}


/**
 * ------------------------------------------------------------------------
 * 2) "drawRuler" – a top axis labeling each day
 * ------------------------------------------------------------------------
 */
function drawRuler(scale, svg, range, cfg, mode="day") {
    // Clear everything
    svg.selectAll("*").remove();

    if (!scale || !svg || !range?.start || !range?.end) {
        return;
    }

    const marks = getTimeMarks(range, mode);
    const halfCol = cfg.columnWidth * 0.5;

    // We won't worry about major lines; just place text
    const groups = svg.selectAll(".large-mark")
        .data(marks)
        .join("g")
        .attr("class", "large-mark");

    // Optionally draw a vertical tick line at each day
    groups.append("line")
        .attr("class", "ruler-line large-mark-line")
        .attr("x1", d => scale(d))
        .attr("y1", cfg.rulerHeight)
        .attr("x2", d => scale(d))
        .attr("y2", cfg.rulerHeight)
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    // The actual day label, e.g. "1 MON"
    groups.append("text")
        .attr("class", "ruler-text large-mark-text")
        .attr("x", d => scale(d) + halfCol)
        .attr("y", cfg.rulerHeight * 0.5)
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-family", "Roboto")
        .text(d => ganttHelpers.timeHelper.formatDate(d, "d ddd").toUpperCase());
}


/**
 * ------------------------------------------------------------------------
 * 3) "renderTasksAndDependencies" – draws tasks (bars) + dependency lines
 * ------------------------------------------------------------------------
 */
function renderTasksAndDependencies(svg, scale, tasks, cfg) {
    drawTasks(svg, scale, tasks, cfg);
    drawDependencies(svg, tasks, scale, tasks, cfg);
}


// -- Helper to clamp a Date's ms to domain boundaries
function clampMs(ms, minMs, maxMs) {
    if (ms < minMs) return minMs;
    if (ms > maxMs) return maxMs;
    return ms;
}


/**
 * Actually draw the bars, with clipping if they partially lie outside the domain.
 * Also draws the invisible resize handles (left/right).
 */
function drawTasks(svg, scale, tasks, cfg) {
    // Remove any old task groups
    svg.selectAll(".task-group").remove();

    // Domain boundaries for potential clipping
    const domain = scale.domain();
    const domainMin = domain[0].getTime();
    const domainMax = domain[1].getTime();

    const gap = 0.2 * cfg.rowHeight;

    // Attach a "group" for each visible task
    const gTask = svg.selectAll(".task-group")
        .data(tasks, d => d.id)
        .join("g")
        .attr("class", "task-group");

    gTask.each(function(d, i) {
        const group = d3.select(this);

        // Original times
        const startMs = d.start.getTime();
        const endMs   = d.end.getTime();

        // If the entire bar is to the left or right of the domain, skip drawing
        if (endMs < domainMin || startMs > domainMax) {
            return;
        }

        // Clip the start/end to the domain
        const barStartMs = clampMs(startMs, domainMin, domainMax);
        const barEndMs   = clampMs(endMs, domainMin, domainMax);

        // Convert to X coords
        const x = scale(barStartMs);
        const w = scale(barEndMs) - x;
        const y = i * cfg.rowHeight + gap;
        const h = cfg.rowHeight - gap*2;

        // Main visible rectangle
        group.append("rect")
            .attr("class", "task-bar")
            .attr("x", x)
            .attr("y", y)
            .attr("width", w)
            .attr("height", h)
            .attr("rx", 2)
            .attr("fill", "#3497d9")
            .attr("stroke", "#256999")
            .attr("stroke-width", 1)
            .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");

        // Show the task name if there's enough horizontal space
        const labelX = x + 10;
        const labelY = y + h * 0.5 + 5; // visually centered
        const minWidthForText = 30;
        if (w > minWidthForText) {
            group.append("text")
                .attr("class", `task-label task-label-${d.id}`)
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("fill", "white")
                .attr("font-size", "15px")
                .attr("font-family", "Roboto")
                .attr("font-weight", 500)
                .attr("pointer-events", "none")
                .attr("filter", "drop-shadow(0px 1px 1px rgba(0,0,0,0.3))")
                .text(d.name);
        }

        // If truncated on the left side
        if (startMs < domainMin) {
            const yMid = y + h / 2;
            // A small triangle pointing left
            group.append("path")
                .attr("class", "truncated-arrow-left")
                .attr("d", `M${x},${yMid}
                    L${x - 6},${yMid - 6}
                    L${x - 6},${yMid + 6}Z`)
                .attr("fill", "#cc0000");
        }

        // If truncated on the right side
        if (endMs > domainMax) {
            const barRightX = x + w;
            const yMid = y + h / 2;
            // A small triangle pointing right
            group.append("path")
                .attr("class", "truncated-arrow-right")
                .attr("d", `M${barRightX},${yMid}
                    L${barRightX + 6},${yMid - 6}
                    L${barRightX + 6},${yMid + 6}Z`)
                .attr("fill", "#cc0000");
        }

        // Invisible left handle
        const handleW = 8;
        group.append("rect")
            .attr("class", "task-handle-left")
            .attr("x", x - handleW / 2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", h)
            .attr("fill", "transparent")
            .style("cursor", "ew-resize");

        // Invisible right handle
        group.append("rect")
            .attr("class", "task-handle-right")
            .attr("x", x + w - handleW / 2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", h)
            .attr("fill", "transparent")
            .style("cursor", "ew-resize");
    });
}


/**
 * Draw the arrow lines for dependencies (e.g., FS, SS).
 * This example does *not* clip them if they’re out-of-range, but you can do so if desired.
 */
function drawDependencies(svg, tasks, scale, allTasks, cfg) {
    svg.selectAll(".dependency-layer").remove();

    let defs = svg.select("defs");
    if (!defs.size()) defs = svg.append("defs");
    defs.selectAll("#arrowhead").remove();

    defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#555");

    const depLayer = svg.append("g").attr("class", "dependency-layer");
    const tasksById = new Map(allTasks.map(t => [t.id, t]));
    const offset = 20;

    function pathData(px, py, cx, cy) {
        const inPx = px + offset;
        const inCx = cx - offset;
        const midX = inPx + (inCx - inPx) / 2;
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
                .attr("fill", "none")
                .attr("stroke", "#555")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "4 2")
                .attr("marker-end", "url(#arrowhead)");
        });
    });
}


/**
 * ------------------------------------------------------------------------
 * 4) "setupDragging" – attaches the D3 drag logic to the bars/handles
 * ------------------------------------------------------------------------
 */
function setupDragging({
                           svg,
                           scale,
                           tasks,
                           defaults,
                           snapEnabled,
                           snapIncrement,
                           setTasks,
                           enforceConstraints
                       }) {
    // Build adjacency (BFS)
    const downstreamMap = buildDownstreamMap(tasks);
    const upstreamMap   = buildUpstreamMap(tasks);

    // Map from id -> original task
    const byId = new Map(tasks.map(t => [t.id, t]));

    const MIN_MS = 4 * 60 * 60 * 1000; // min 4 hours

    function commitChanges(ephemeralMap) {
        setTasks(mergeEphemeral(tasks, ephemeralMap));
    }

    function getLocalMouseX(event) {
        const [mx] = d3.pointer(event, svg.node());
        return mx;
    }

    // Utility to build ephemeral copies for BFS constraints
    function buildEphemeralMap(d) {
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

    // ---------------- ENTIRE BAR DRAG ----------------
    const dragBar = d3.drag()
        .on("start", function (event, d) {
            d3.select(this).attr("stroke", "black");
            d.__ephemeralMap = buildEphemeralMap(d);

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

            // BFS constraints
            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "move");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // Enforce min 4 hours
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

    // ---------------- LEFT HANDLE DRAG ----------------
    const dragLeft = d3.drag()
        .on("start", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", "black");
            d.__ephemeralMap = buildEphemeralMap(d);

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

            if (newStart > me.end) return; // can't cross
            me.start = newStart;

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "left");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // Enforce min 4 hours
            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.start = new Date(me.end.getTime() - MIN_MS);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ---------------- RIGHT HANDLE DRAG ----------------
    const dragRight = d3.drag()
        .on("start", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", "black");
            d.__ephemeralMap = buildEphemeralMap(d);

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

            if (newEnd < me.start) return; // can't cross
            me.end = newEnd;

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "right");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // Enforce min 4 hours
            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.end = new Date(me.start.getTime() + MIN_MS);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // Attach the drags to the drawn bars/handles
    svg.selectAll(".task-bar").call(dragBar);
    svg.selectAll(".task-handle-left").call(dragLeft);
    svg.selectAll(".task-handle-right").call(dragRight);
}


/**
 * ------------------------------------------------------------------------
 * 5) "getTimeMarks" – produce daily marks for the given range
 * ------------------------------------------------------------------------
 */
function getTimeMarks({ start, end }, mode="day") {
    const s = ganttHelpers.timeHelper.getStartOfDay(start);
    const e = ganttHelpers.timeHelper.getEndOfDay(end);
    if (!s || !e || s > e) return [];

    // We do 1-day increments for "day" mode
    const marks = [];
    const cur = new Date(s);
    while (cur <= e) {
        marks.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return marks;
}


/**
 * ------------------------------------------------------------------------
 * Finally, we gather these functions into a single default export "drawHelper".
 * ------------------------------------------------------------------------
 */
const drawHelper = {
    drawGrid,
    drawRuler,
    renderTasksAndDependencies,
    setupDragging,
};

export default drawHelper;

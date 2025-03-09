// src\components\Gantt\logic\drawHelper.js

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

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

/**
 * Recursively gather earliest and latest from *all* descendants (children, grandchildren, etc.).
 * We do *not* stop at summary children: we recurse into them too, so deeper tasks count.
 */
function getMinMaxFromChildren(summary) {
    let earliest = null, latest = null;

    function visit(node) {
        // For each child:
        for (const c of (node.children ?? [])) {
            if (c.start && c.end) {
                const s = c.start.getTime();
                const e = c.end.getTime();
                if (earliest === null || s < earliest) earliest = s;
                if (latest === null || e > latest) latest = e;
            }
            // Always recurse further, so grandchildren count too
            visit(c);
        }
    }

    visit(summary);

    return {
        earliest: earliest !== null ? new Date(earliest) : null,
        latest:   latest   !== null ? new Date(latest)   : null
    };
}

/**
 * Gather *all tasks in* the subtree under a given summary (including summary itself).
 * This ensures ephemeral BFS can see *all siblings/cousins* under that summary.
 */
function collectSubtree(task, outSet) {
    outSet.add(task.id);
    if (!task.children) return;
    for (const c of task.children) {
        collectSubtree(c, outSet);
    }
}

/**
 * 1) Draw a day/row grid
 */
function drawGrid(scale, svg, range, cfg, tasks, mode="day") {
    svg.selectAll("*").remove();
    const marks = getTimeMarks(range, mode);
    const w = cfg.columnWidth * marks.length;
    const h = cfg.rowHeight * tasks.length;

    svg.attr("width", w).attr("height", h);

    // vertical lines
    const grid = svg.selectAll(".canvas-grid")
        .data(marks)
        .join("g")
        .attr("class", "canvas-grid");

    grid.append("line")
        .attr("x1", d => scale(d))
        .attr("y1", 0)
        .attr("x2", d => scale(d))
        .attr("y2", h)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);

    // horizontal lines per row
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
 * 2) Draw top day-label axis
 */
function drawRuler(scale, svg, range, cfg, mode="day") {
    svg.selectAll("*").remove();
    if (!range?.start || !range?.end || !scale) return;

    const marks = getTimeMarks(range, mode);
    const halfCol = cfg.columnWidth * 0.5;

    const groups = svg.selectAll(".large-mark")
        .data(marks)
        .join("g")
        .attr("class", "large-mark");

    groups.append("line")
        .attr("class", "ruler-line large-mark-line")
        .attr("x1", d => scale(d))
        .attr("y1", cfg.rulerHeight)
        .attr("x2", d => scale(d))
        .attr("y2", cfg.rulerHeight)
        .attr("stroke", "black")
        .attr("stroke-width", 1);

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
 * 3) Render tasks + dependencies
 */
function renderTasksAndDependencies(svg, scale, tasks, cfg) {
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
 * 3a) Draw tasks: normal or summary
 *   - Summary tasks compute any unpinned side from their entire descendant range.
 */
/**
 * REPLACE your existing "function drawTasks" in drawHelper.js with this entire block.
 */
/**
 * REPLACE your existing "function drawTasks" in drawHelper.js with this entire block.
 */
/**
 * REPLACE your existing "function drawTasks" in drawHelper.js with this entire block.
 *
 * Key change: if the bar's left X is negative, we clamp the triangle apex at x=6,
 * ensuring at least part of the triangle is always visible within the SVG.
 */
function drawTasks(svg, scale, tasks, cfg) {
    // 1) Remove old groups
    svg.selectAll(".task-group").remove();
    svg.selectAll(".summary-group").remove();

    // --- Helpers for summary coverage ---
    function buildTaskIndexMap(visibleTasks) {
        const map = new Map();
        visibleTasks.forEach((t, i) => {
            map.set(t.id, i);
        });
        return map;
    }
    function collectAllDescendantIds(task, outSet) {
        if (!task.children) return;
        for (const c of task.children) {
            outSet.add(c.id);
            collectAllDescendantIds(c, outSet);
        }
    }

    // --- Build row index map, handle summary child coverage ---
    const taskIndexMap = buildTaskIndexMap(tasks);
    for (const t of tasks) {
        if (!t.isSummary) continue;
        const descIds = new Set();
        collectAllDescendantIds(t, descIds);

        let minRow = Infinity, maxRow = -Infinity;
        for (const childId of descIds) {
            if (taskIndexMap.has(childId)) {
                const r = taskIndexMap.get(childId);
                if (r < minRow) minRow = r;
                if (r > maxRow) maxRow = r;
            }
        }
        // If no visible children => fallback to the summary’s own row
        if (minRow === Infinity || maxRow === -Infinity) {
            const myRow = taskIndexMap.get(t.id) ?? 0;
            t._summaryTopRow = myRow;
            t._summaryBottomRow = myRow;
        } else {
            t._summaryTopRow = minRow;
            t._summaryBottomRow = maxRow;
        }
    }

    // --- Domain & geometry ---
    const [domainStart, domainEnd] = scale.domain();
    const domainMin = domainStart.getTime();
    const domainMax = domainEnd.getTime();
    const gap = 0.2 * cfg.rowHeight;

    // Separate normal vs summary
    const summaryTasks = tasks.filter(t => t.isSummary);
    const normalTasks  = tasks.filter(t => !t.isSummary);

    // =================================================================
    //  Draw Summaries
    // =================================================================
    const gSummaries = svg.selectAll(".summary-group")
        .data(summaryTasks, d => d.id)
        .join("g")
        .attr("class", "summary-group");

    gSummaries.each(function(d) {
        // pinned start/end?
        const pinnedStart = d.start instanceof Date ? d.start.getTime() : null;
        const pinnedEnd   = d.end   instanceof Date ? d.end.getTime()   : null;

        // child earliest/latest
        let childEarliest = Infinity, childLatest = -Infinity;
        if (d.children) {
            for (const c of d.children) {
                if (c.start && c.end) {
                    const cs = c.start.getTime();
                    const ce = c.end.getTime();
                    if (cs < childEarliest) childEarliest = cs;
                    if (ce > childLatest)   childLatest   = ce;
                }
            }
        }

        let sumStartMs = pinnedStart ?? childEarliest;
        let sumEndMs   = pinnedEnd   ?? childLatest;
        if (!Number.isFinite(sumStartMs) || !Number.isFinite(sumEndMs)) {
            sumStartMs = domainMin;
            sumEndMs   = domainMin + (24*60*60*1000);
        }

        if (sumEndMs < domainMin || sumStartMs > domainMax) {
            return; // fully out of domain
        }
        // clamp partial
        const barStartMs = Math.max(sumStartMs, domainMin);
        const barEndMs   = Math.min(sumEndMs, domainMax);
        const x = scale(barStartMs);
        const w = scale(barEndMs) - x;

        // summary's child coverage
        const summaryRowIndex = taskIndexMap.get(d.id) ?? 0;
        const topRow    = Math.min(summaryRowIndex, d._summaryTopRow);
        const bottomRow = Math.max(summaryRowIndex, d._summaryBottomRow);

        const barTopY    = topRow * cfg.rowHeight + gap;
        const barBottomY = (bottomRow + 1) * cfg.rowHeight - gap;
        const barHeight  = barBottomY - barTopY;

        // main rectangle
        const g = d3.select(this);
        g.append("rect")
            .attr("class", "summary-bar")
            .attr("x", x)
            .attr("y", barTopY)
            .attr("width", w)
            .attr("height", barHeight)
            .attr("fill", "rgba(51,149,214,0.1)")
            .attr("stroke", "none")
            .attr("stroke-width", 2);

        // label
        if (w > 40) {
            g.append("text")
                .attr("x", x + 10)
                .attr("y", barTopY + 20)
                .attr("fill", "#000")
                .style("font-weight", 600)
                .text(d.name);
        }

        // summary row center for triangles
        const summaryMidY = summaryRowIndex * cfg.rowHeight + (cfg.rowHeight / 2);

        // --- left triangle clamp ---
        if (sumStartMs < domainMin) {
            let apexX = x;
            // if apex would be negative, clamp to 6
            if (apexX < 6) apexX = 6;

            g.append("path")
                .attr("class", "summary-left-triangle")
                .attr("d", `M${apexX},${summaryMidY}
                            L${apexX-6},${summaryMidY-6}
                            L${apexX-6},${summaryMidY+6}Z`)
                .attr("fill", "#cc0000");
        }

        // --- right triangle (no clamp needed if domain's max is large enough) ---
        if (sumEndMs > domainMax) {
            const barRightX = x + w;
            g.append("path")
                .attr("class", "summary-right-triangle")
                .attr("d", `M${barRightX},${summaryMidY}
                            L${barRightX+6},${summaryMidY-6}
                            L${barRightX+6},${summaryMidY+6}Z`)
                .attr("fill", "#cc0000");
        }
    });

    // =================================================================
    //  Draw Normal Tasks
    // =================================================================
    const gTask = svg.selectAll(".task-group")
        .data(normalTasks, d => d.id)
        .join("g")
        .attr("class", "task-group");

    gTask.each(function(d) {
        if (!d.start || !d.end) return;
        const startMs = d.start.getTime();
        const endMs   = d.end.getTime();
        if (endMs < domainMin || startMs > domainMax) return; // fully out of domain

        // clamp portion
        const barStartMs = Math.max(startMs, domainMin);
        const barEndMs   = Math.min(endMs, domainMax);
        const x = scale(barStartMs);
        const w = scale(barEndMs) - x;

        const rowIndex = taskIndexMap.get(d.id) || 0;
        const rowY = rowIndex * cfg.rowHeight;
        const barHeight = cfg.rowHeight - gap * 2;
        const y = rowY + (cfg.rowHeight - barHeight) / 2;

        // main rectangle
        const gRow = d3.select(this);
        gRow.append("rect")
            .attr("class", "task-bar")
            .attr("x", x)
            .attr("y", y)
            .attr("width", w)
            .attr("height", barHeight)
            .attr("rx", 2)
            .attr("fill", "#3497d9")
            .attr("stroke", "#256999")
            .attr("stroke-width", 1)
            .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");

        // label if there's enough room
        if (w > 30) {
            gRow.append("text")
                .attr("x", x + 10)
                .attr("y", y + barHeight / 2 + 5)
                .attr("fill", "#fff")
                .attr("font-size", "15px")
                .attr("font-family", "Roboto")
                .attr("font-weight", 500)
                .attr("pointer-events", "none")
                .attr("filter","drop-shadow(0px 1px 1px rgba(0,0,0,0.3))")
                .text(d.name);
        }

        // --- Triangles last => on top
        const midY = y + barHeight / 2;

        // LEFT TRIANGLE CLAMP
        if (startMs < domainMin) {
            let apexX = x;
            // if apexX is negative, clamp to 6 so it's visible in the svg
            if (apexX < 6) apexX = 6;

            gRow.append("path")
                .attr("class", "task-left-triangle")
                .attr("d", `M${apexX},${midY} 
                            L${apexX-6},${midY-6} 
                            L${apexX-6},${midY+6}Z`)
                .attr("fill", "#cc0000");
        }

        // RIGHT TRIANGLE (no clamp needed)
        if (endMs > domainMax) {
            const barRightX = x + w;
            gRow.append("path")
                .attr("class", "task-right-triangle")
                .attr("d", `M${barRightX},${midY} 
                            L${barRightX+6},${midY-6} 
                            L${barRightX+6},${midY+6}Z`)
                .attr("fill", "#cc0000");
        }

        // invisible drag handles
        const handleW = 8;
        gRow.append("rect")
            .attr("class", "task-handle-left")
            .attr("x", x - handleW/2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", barHeight)
            .attr("fill", "transparent")
            .style("cursor", "ew-resize");

        gRow.append("rect")
            .attr("class", "task-handle-right")
            .attr("x", x + w - handleW/2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", barHeight)
            .attr("fill", "transparent")
            .style("cursor", "ew-resize");
    });
}



/**
 * 3b) Dependencies (arrows)
 */
function drawDependencies(svg, tasks, scale, allTasks, cfg) {
    svg.selectAll(".dependency-layer").remove();
    let defs = svg.select("defs");
    if (!defs.size()) defs = svg.append("defs");
    defs.selectAll("#arrowhead").remove();

    defs.append("marker")
        .attr("id","arrowhead")
        .attr("viewBox","0 -5 10 10")
        .attr("refX",8)
        .attr("refY",0)
        .attr("markerWidth",6)
        .attr("markerHeight",6)
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

/**
 * 4) Setup Dragging for normal tasks
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
    // adjacency
    const downstreamMap = buildDownstreamMap(tasks);
    const upstreamMap   = buildUpstreamMap(tasks);
    const byId = new Map(tasks.map(t => [t.id, t]));

    const MIN_MS = 4 * 60 * 60 * 1000; // 4h min

    // Called at drag end: merges ephemeral changes into final tasks
    function commitChanges(ephemeralMap) {
        const finalArr = tasks.map(original => {
            const e = ephemeralMap.get(original.id);
            if (!e) return original;

            // Normal tasks: always store ephemeral
            if (!e.isSummary) {
                return { ...original, start: e.start, end: e.end };
            } else {
                // Summaries: only store pinned sides
                const out = { ...original };
                if (e._pinnedStart) out.start = e.start;
                else delete out.start;
                if (e._pinnedEnd)   out.end   = e.end;
                else delete out.end;
                return out;
            }
        });
        setTasks(finalArr);
    }

    function getLocalMouseX(event) {
        const [mx] = d3.pointer(event, svg.node());
        return mx;
    }

    /**
     * Build ephemeral copies for BFS constraints & summary updates,
     * ensuring the summary ancestor *and all its subtree* are included.
     */
    function buildEphemeralMap(d) {
        // BFS sets of tasks that can shift
        const ds = collectDownstream(d.id, downstreamMap);
        const us = collectUpstream(d.id, upstreamMap);

        // Summaries can be ancestors, so let's find them
        const summaryAncestors = collectSummaryAncestors(d, byId);

        // Combine them all
        const allIds = new Set([...ds, ...us, d.id]);

        // For each summary ancestor, we also want the entire subtree under that ancestor,
        // so the ephemeral summary can see all siblings/cousins for min/max range.
        for (const sumId of summaryAncestors) {
            allIds.add(sumId);
            const sumObj = byId.get(sumId);
            if (sumObj) {
                collectSubtree(sumObj, allIds);
            }
        }

        // Also collect the subtree of the changed task if it's a summary,
        // or any other summary in us/ds. That ensures we include grandchildren.
        // (Not strictly needed if constraints are unidirectional, but it's safe.)
        // We'll just do for each ID we know, if it's summary, collectSubtree:
        Array.from(allIds).forEach(id => {
            const maybeSummary = byId.get(id);
            if (maybeSummary?.isSummary) {
                collectSubtree(maybeSummary, allIds);
            }
        });

        // Now create ephemeral tasks
        const ephemeralMap = new Map();
        for (const tid of allIds) {
            const orig = byId.get(tid);
            if (!orig) continue;
            ephemeralMap.set(tid, {
                ...orig,
                start: orig.start ? new Date(orig.start) : undefined,
                end:   orig.end   ? new Date(orig.end)   : undefined,
                isSummary: !!orig.isSummary,
                _pinnedStart: Object.prototype.hasOwnProperty.call(orig, "start"),
                _pinnedEnd:   Object.prototype.hasOwnProperty.call(orig, "end"),
                children: [],
                dependencies: orig.dependencies
            });
        }

        // Link ephemeral children
        ephemeralMap.forEach(e => {
            const real = byId.get(e.id);
            if (real?.children) {
                e.children = real.children
                    .map(ch => ephemeralMap.get(ch.id))
                    .filter(Boolean);
            }
        });

        return ephemeralMap;
    }

    /**
     * Summaries can recalc ephemeral start/end from all children if not pinned.
     */
    function recalcEphemeralSummaries(ephemeralMap) {
        let changed = true;
        let passCount = 0;

        while (changed && passCount < 10) {
            changed = false;
            passCount++;

            ephemeralMap.forEach(eTask => {
                if (!eTask.isSummary) return;

                // gather min/max among *all* descendants
                const { minS, maxE } = getDescendantsRange(eTask);
                if (minS == null || maxE == null) return;

                const oldS = eTask.start ? eTask.start.getTime() : null;
                const oldE = eTask.end   ? eTask.end.getTime()   : null;

                let newS = oldS, newE = oldE;

                if (!eTask._pinnedStart) newS = minS;
                if (!eTask._pinnedEnd)   newE = maxE;

                if (newS !== oldS || newE !== oldE) {
                    eTask.start = new Date(newS);
                    eTask.end   = new Date(newE);
                    changed = true;
                }
            });
        }
    }

    /**
     * Return minS, maxE among *all* descendants in ephemeral
     */
    function getDescendantsRange(summaryTask) {
        let minS = null, maxE = null;

        function dfs(node) {
            for (const c of (node.children ?? [])) {
                if (c.start && c.end) {
                    const sMs = c.start.getTime();
                    const eMs = c.end.getTime();
                    if (minS === null || sMs < minS) minS = sMs;
                    if (maxE === null || eMs > maxE) maxE = eMs;
                }
                dfs(c);
            }
        }
        dfs(summaryTask);
        return { minS, maxE };
    }

    /**
     * Summaries can be ancestors. We'll climb up parentId to find them.
     */
    function collectSummaryAncestors(task, byIdMap) {
        const results = [];
        let cur = task;
        while (true) {
            if (!cur.parentId) break;
            const par = byIdMap.get(cur.parentId);
            if (!par) break;
            if (par.isSummary) {
                results.push(par.id);
            }
            cur = par;
        }
        return results;
    }

    // ---------- DRAG ENTIRE BAR -----------
    const dragBar = d3.drag()
        .on("start", function(event, d) {
            if (d.isSummary) return; // skip summary drag
            d3.select(this).attr("stroke","black");

            d.__ephemeralMap = buildEphemeralMap(d);
            const me = d.__ephemeralMap.get(d.id);

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.start.getTime();
        })
        .on("drag", function(event, d) {
            if (d.isSummary) return;

            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap?.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // shift entire bar
            const shiftMs = newStart - me.start;
            me.start = new Date(me.start.getTime() + shiftMs);
            me.end   = new Date(me.end.getTime() + shiftMs);

            // BFS constraints
            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "move");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            // recalc ephemeral summaries
            recalcEphemeralSummaries(ephemeralMap);

            // min length
            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.end = new Date(me.start.getTime() + MIN_MS);
            }

            // re-draw ephemeral
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);

            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke","black");
        })
        .on("end", function(event, d) {
            if (d.isSummary) return;
            d3.select(this).attr("stroke",null);

            commitChanges(d.__ephemeralMap);
        });

    // ---------- LEFT HANDLE -----------
    const dragLeft = d3.drag()
        .on("start", function(event, d) {
            if (d.isSummary) return;
            d3.select(this.parentNode).select(".task-bar").attr("stroke","black");

            d.__ephemeralMap = buildEphemeralMap(d);
            const me = d.__ephemeralMap.get(d.id);

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.start.getTime();
        })
        .on("drag", function(event, d) {
            if (d.isSummary) return;

            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap?.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            if (newStart > me.end) return;
            me.start = newStart;

            // BFS
            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "left");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            recalcEphemeralSummaries(ephemeralMap);

            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.start = new Date(me.end.getTime() - MIN_MS);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);

            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke","black");
        })
        .on("end", function(event, d) {
            if (d.isSummary) return;
            d3.select(this.parentNode).select(".task-bar").attr("stroke",null);

            commitChanges(d.__ephemeralMap);
        });

    // ---------- RIGHT HANDLE -----------
    const dragRight = d3.drag()
        .on("start", function(event, d) {
            if (d.isSummary) return;
            d3.select(this.parentNode).select(".task-bar").attr("stroke","black");

            d.__ephemeralMap = buildEphemeralMap(d);
            const me = d.__ephemeralMap.get(d.id);

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.end.getTime();
        })
        .on("drag", function(event, d) {
            if (d.isSummary) return;

            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap?.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newEnd = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            if (newEnd < me.start) return;
            me.end = newEnd;

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "right");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            recalcEphemeralSummaries(ephemeralMap);

            const dur = me.end - me.start;
            if (dur < MIN_MS) {
                me.end = new Date(me.start.getTime() + MIN_MS);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke","black");
        })
        .on("end", function(event, d) {
            if (d.isSummary) return;
            d3.select(this.parentNode).select(".task-bar").attr("stroke",null);

            commitChanges(d.__ephemeralMap);
        });

    // Attach drag
    svg.selectAll(".task-bar").call(dragBar);
    svg.selectAll(".task-handle-left").call(dragLeft);
    svg.selectAll(".task-handle-right").call(dragRight);
}

/**
 * 5) Utility: produce daily marks
 */
function getTimeMarks({ start, end }, mode="day") {
    const s = ganttHelpers.timeHelper.getStartOfDay(start);
    const e = ganttHelpers.timeHelper.getEndOfDay(end);
    if (!s || !e || s > e) return [];

    const marks = [];
    const cur = new Date(s);
    while (cur <= e) {
        marks.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return marks;
}

/**
 * Final export
 */
const drawHelper = {
    drawGrid,
    drawRuler,
    renderTasksAndDependencies,
    setupDragging
};

export default drawHelper;

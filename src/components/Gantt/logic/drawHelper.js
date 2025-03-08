// src/components/Gantt/drawHelper.js

import * as d3 from "d3";

// ---- Import BFS and Constraint logic (no direct DOM references here) ----
import {buildDownstreamMap, buildUpstreamMap, collectDownstream, collectUpstream, doTwoWayBFS} from "./BFS.js";

import {clampTaskToConstraints, maybeSnap, mergeEphemeral} from "./constraints.js";

// ---- Import the drawing logic for tasks, dependencies, grid, ruler ----
import {drawGrid, drawRuler, renderTasksAndDependencies} from "./drawingLogic.js";

/**
 * The main "drawEverything" function orchestrates:
 *   1) Building adjacency maps (BFS logic).
 *   2) Setting up ephemeral data for dragging (constraint logic).
 *   3) Rendering tasks + dependencies (drawing logic).
 *   4) Handling drag events that mutate ephemeral data + reapply constraints.
 */
function drawEverything({
                            svg,
                            scale,
                            timeRanges,
                            defaults,
                            tasks,
                            width,
                            snapEnabled,
                            snapIncrement,
                            setTasks,
                            enforceConstraints
                        }) {
    // Clear the svg
    svg.selectAll("*").remove();

    // Set size
    const totalH = defaults.rowHeight * tasks.length;
    svg.attr("width", width).attr("height", totalH);

    // Draw grid
    drawGrid(scale, svg, timeRanges, defaults, tasks);

    // Draw tasks + dependencies
    renderTasksAndDependencies(svg, scale, tasks, defaults);

    // Build adjacency
    const downstreamMap = buildDownstreamMap(tasks);
    const upstreamMap = buildUpstreamMap(tasks);
    const byId = new Map(tasks.map(t => [t.id, t]));

    function commitChanges(ephemeralMap) {
        setTasks(mergeEphemeral(tasks, ephemeralMap));
    }

    function getLocalMouseX(event) {
        const [mx] = d3.pointer(event, svg.node());
        return mx;
    }

    // ========== ENTIRE BAR DRAG ==========
    const dragBar = d3.drag()
        .on("start", function (event, d) {
            d3.select(this).attr("stroke", "black");

            d.__ephemeralMap = new Map();
            // gather all upstream + downstream
            const ds = collectDownstream(d.id, downstreamMap);
            const us = collectUpstream(d.id, upstreamMap);
            const all = new Set([...ds, ...us, d.id]);
            for (const tid of all) {
                const orig = byId.get(tid);
                if (orig) {
                    d.__ephemeralMap.set(tid, {
                        ...orig,
                        start: new Date(orig.start),
                        end: new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }

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

            // compute new start
            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // shift entire bar
            const shiftMs = newStart.getTime() - me.start.getTime();
            me.start = new Date(me.start.getTime() + shiftMs);
            me.end = new Date(me.end.getTime() + shiftMs);

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "move");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this).attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ========== LEFT HANDLE DRAG ==========
    const dragLeft = d3.drag()
        .on("start", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", "black");
            d.__ephemeralMap = new Map();
            const ds = collectDownstream(d.id, downstreamMap);
            const us = collectUpstream(d.id, upstreamMap);
            const all = new Set([...ds, ...us, d.id]);
            for (const tid of all) {
                const orig = byId.get(tid);
                if (orig) {
                    d.__ephemeralMap.set(tid, {
                        ...orig,
                        start: new Date(orig.start),
                        end: new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }
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

            // ensure we don't cross the end
            if (newStart.getTime() > me.end.getTime()) {
                return;
            }
            me.start = newStart;

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "left");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke", "black");
        })
        .on("end", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ========== RIGHT HANDLE DRAG ==========
    const dragRight = d3.drag()
        .on("start", function (event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", "black");
            d.__ephemeralMap = new Map();
            const ds = collectDownstream(d.id, downstreamMap);
            const us = collectUpstream(d.id, upstreamMap);
            const all = new Set([...ds, ...us, d.id]);
            for (const tid of all) {
                const orig = byId.get(tid);
                if (orig) {
                    d.__ephemeralMap.set(tid, {
                        ...orig,
                        start: new Date(orig.start),
                        end: new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }
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

            // keep end >= start
            if (newEnd.getTime() < me.start.getTime()) {
                return;
            }
            me.end = newEnd;

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "right");
            } else {
                doTwoWayBFS(d.id, ephemeralMap, downstreamMap, upstreamMap);
            }

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

// Export the same top-level API shape you had before:
const drawHelper = {
    drawRuler,
    drawCanvas: drawGrid,
    drawEverything
};

export default drawHelper;

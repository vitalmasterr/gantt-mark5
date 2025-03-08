// src/components/Gantt/drawHelper.js

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

/**
 * Build a "downstream" adjacency map.
 * For each child T having T.dependencies = [ {id: parentId, type: ...}, ... ],
 * we record parentId => an array of {id: childId, type: depType}.
 * So that child is "downstream" from the parent.
 */
function buildDownstreamMap(tasks) {
    const map = {};
    for (const child of tasks) {
        if (!Array.isArray(child.dependencies)) continue;
        for (const dep of child.dependencies) {
            if (!map[dep.id]) map[dep.id] = [];
            map[dep.id].push({ id: child.id, type: dep.type });
        }
    }
    return map;
}

/**
 * Collect all tasks that are downstream from startId in that adjacency map.
 */
function collectDownstream(startId, downstreamMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (downstreamMap[cur]) {
            for (const child of downstreamMap[cur]) {
                if (!visited.has(child.id)) {
                    queue.push(child.id);
                }
            }
        }
    }
    return visited;
}

/**
 * BFS-based recalc of constraints (FS, SS, FF, SF) for an ephemeral set of tasks.
 */
function recalcDownstreamBFS(changedTaskId, ephemeralMap, downstreamMap) {
    // changedTaskId was just shifted => re-check children
    const queue = [changedTaskId];
    while (queue.length) {
        const parentId = queue.shift();
        const children = downstreamMap[parentId] || [];
        for (const { id: childId } of children) {
            const child = ephemeralMap.get(childId);
            if (!child) continue;
            const shifted = applyAllParentConstraints(child, ephemeralMap);
            if (shifted) {
                queue.push(childId);
            }
        }
    }
}

/**
 * If a child has multiple parents, we apply constraints from each parent's start/end
 * according to FS, SS, FF, SF. Return true if the child's dates changed.
 */
function applyAllParentConstraints(child, ephemeralMap) {
    let changed = false;
    if (!Array.isArray(child.dependencies)) return false;

    let s = child.start.getTime();
    let e = child.end.getTime();

    for (const dep of child.dependencies) {
        const parent = ephemeralMap.get(dep.id);
        if (!parent) continue;

        const ps = parent.start.getTime();
        const pe = parent.end.getTime();

        if (dep.type === "FS") {
            // child.start >= parent.end
            if (s < pe) {
                const delta = pe - s;
                s += delta; e += delta;
                changed = true;
            }
        }
        else if (dep.type === "SS") {
            // child.start >= parent.start
            if (s < ps) {
                const delta = ps - s;
                s += delta; e += delta;
                changed = true;
            }
        }
        else if (dep.type === "FF") {
            // child.end >= parent.end
            if (e < pe) {
                const delta = pe - e;
                s += delta; e += delta;
                changed = true;
            }
        }
        else if (dep.type === "SF") {
            // child.end >= parent.start
            if (e < ps) {
                const delta = ps - e;
                s += delta; e += delta;
                changed = true;
            }
        }
    }

    if (changed) {
        child.start = new Date(s);
        child.end   = new Date(e);
    }
    return changed;
}

/**
 * Snap a date to nearest increment if snap is enabled.
 */
function maybeSnap(date, snap, inc) {
    if (!snap) return date;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const off = date.getTime() - dayStart.getTime();
    const rem = off % inc;
    const half = inc / 2;
    const corrected = (rem >= half) ? off + (inc - rem) : off - rem;
    return new Date(dayStart.getTime() + corrected);
}

/**
 * Grid drawing
 */
function drawGrid(scale, svg, range, cfg, tasks, mode="2w") {
    svg.selectAll("*").remove();
    const marks = getTimeMarks(range, mode);
    const w = cfg.columnWidth * marks.length;
    const h = cfg.rowHeight * tasks.length;
    svg.attr("width", w).attr("height", h);

    const grid = svg.selectAll(".canvas-grid")
        .data(marks)
        .join("g")
        .attr("class","canvas-grid");

    grid.append("line")
        .attr("x1", d => scale(d))
        .attr("y1", 0)
        .attr("x2", d => scale(d))
        .attr("y2", h)
        .attr("stroke","#ccc")
        .attr("stroke-width",1);

    grid.append("line")
        .attr("x1", 0)
        .attr("y1",(d,i) => i * cfg.rowHeight)
        .attr("x2", w)
        .attr("y2",(d,i) => i * cfg.rowHeight)
        .attr("stroke","#ccc")
        .attr("stroke-width",1);
}

/**
 * Ruler drawing
 */
function drawRuler(scale, svg, range, cfg, mode="2w") {
    svg.selectAll("*").remove();
    if (!scale || !svg || !range?.start || !range?.end) return;

    const marks = getTimeMarks(range, mode);
    const halfCol = cfg.columnWidth * 0.5;

    const groups = svg.selectAll(".large-mark")
        .data(marks)
        .join("g")
        .attr("class","large-mark");

    groups.append("line")
        .attr("class","ruler-line large-mark-line")
        .attr("x1", d => scale(d))
        .attr("y1", cfg.rulerHeight)
        .attr("x2", d => scale(d))
        .attr("y2", cfg.rulerHeight)
        .attr("stroke","black")
        .attr("stroke-width",1);

    groups.append("text")
        .attr("class","ruler-text large-mark-text")
        .attr("x", d => scale(d) + halfCol)
        .attr("y", cfg.rulerHeight * 0.5)
        .attr("dominant-baseline","middle")
        .attr("text-anchor","middle")
        .attr("font-size","18px")
        .attr("font-family","Roboto")
        .text(d => ganttHelpers.timeHelper.formatDate(d, "d ddd").toUpperCase());
}

/**
 * Generate day-based marks from start->end
 */
function getTimeMarks({ start, end }, mode) {
    const s = ganttHelpers.timeHelper.getStartOfDay(start);
    const e = ganttHelpers.timeHelper.getEndOfDay(end);
    const incFn = ganttHelpers.timeHelper.incrementMap[mode];
    if (!s || !e || s > e || typeof incFn !== "function") return [];
    const result = [];
    const cur = new Date(s);
    while (cur <= e) {
        result.push(new Date(cur));
        incFn(cur);
    }
    return result;
}

/**
 * Draw tasks
 */
function drawTasks(svg, scale, tasks, cfg) {
    svg.selectAll(".task-group").remove();
    const gap = 0.2 * cfg.rowHeight;

    const gTask = svg.selectAll(".task-group")
        .data(tasks, d => d.id)
        .join("g")
        .attr("class","task-group");

    gTask.append("rect")
        .attr("class","task-bar")
        .attr("x", d => scale(d.start))
        .attr("y",(d,i) => i * cfg.rowHeight + gap)
        .attr("width", d => scale(d.end) - scale(d.start))
        .attr("height", cfg.rowHeight - gap*2)
        .attr("rx",2)
        .attr("fill","#3497d9")
        .attr("stroke", "#256999")
        .attr("stroke-width",1)
        .style("filter","drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2))");

    gTask.append("text")
        .attr("class", d => `task-label task-label-${d.id}`)
        .attr("x", d => scale(d.start) + 10)
        .attr("y",(d,i) => i * cfg.rowHeight + (cfg.rowHeight / 2) + 5)
        .attr("fill","white")
        .attr("font-size","15px")
        .attr("font-family","Roboto")
        .attr("font-weight",500)
        .attr("pointer-events","none")
        .attr("filter","drop-shadow(0px 1px 1px rgba(0,0,0,0.3))")
        .text(d => d.name);

    // invisible handles for resizing
    const handleW = 8;
    gTask.each(function(d) {
        const bar = d3.select(this).select("rect.task-bar");
        const x = +bar.attr("x");
        const w = +bar.attr("width");
        const y = +bar.attr("y");
        const h = +bar.attr("height");

        d3.select(this)
            .append("rect")
            .attr("class","task-handle-left")
            .attr("x", x - handleW/2)
            .attr("y", y)
            .attr("width", handleW)
            .attr("height", h)
            .attr("fill","transparent")
            .style("cursor","ew-resize");

        d3.select(this)
            .append("rect")
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
 * Draw dependencies (arrows)
 */
function drawDependencies(svg, tasks, scale, cfg) {
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
    const tasksById = new Map(tasks.map(t => [t.id, t]));
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
            const pi = tasks.findIndex(t => t.id === dep.id);
            if (pi < 0) return;
            const parentY = pi * cfg.rowHeight + cfg.rowHeight * 0.5;

            // typical FS arrow from parent's end to child's start
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
 * Merge ephemeral changes into the original tasks array
 */
function mergeEphemeral(tasks, ephemeralMap) {
    return tasks.map(t => ephemeralMap.get(t.id) || t);
}

/**
 * Re-render tasks + dependencies
 */
function renderTasksAndDependencies(svg, scale, tasks, cfg) {
    drawTasks(svg, scale, tasks, cfg);
    drawDependencies(svg, tasks, scale, cfg);
}

/**
 * Main entry: draw everything, attach drags, do BFS recalc in real time.
 */
function drawEverything({
                            svg, scale, timeRanges, defaults,
                            tasks, width, snapEnabled, snapIncrement, setTasks
                        }) {
    // clear the svg
    svg.selectAll("*").remove();

    // size
    const totalH = defaults.rowHeight * tasks.length;
    svg.attr("width", width).attr("height", totalH);

    // 1) Grid
    drawGrid(scale, svg, timeRanges, defaults, tasks);

    // 2) Tasks + dependencies
    renderTasksAndDependencies(svg, scale, tasks, defaults);

    // 3) adjacency for BFS recalc
    const downstreamMap = buildDownstreamMap(tasks);
    const byId = new Map(tasks.map(t => [t.id, t]));

    /**
     * commit ephemeral changes
     */
    function commitChanges(ephemeralMap) {
        const newTasks = mergeEphemeral(tasks, ephemeralMap);
        setTasks(newTasks);
    }

    function doBFSRecalc(changedId, ephemeralMap) {
        recalcDownstreamBFS(changedId, ephemeralMap, downstreamMap);
    }

    /**
     * We'll do pinned domain offset, but using local pointer
     * so we don't get an immediate jump from page offsets.
     */
    function getLocalMouseX(event) {
        // Use d3.pointer to get local x
        const [mx] = d3.pointer(event, svg.node());
        return mx;
    }

    // ========== DRAG ENTIRE BAR ==========
    const dragBar = d3.drag()
        .on("start", function(event, d) {
            d3.select(this).attr("stroke","black");

            // ephemeralMap with d + all downstream
            d.__ephemeralMap = new Map();
            const down = collectDownstream(d.id, downstreamMap);
            down.add(d.id);

            for (const tid of down) {
                const orig = byId.get(tid);
                if (orig) {
                    d.__ephemeralMap.set(tid, {
                        ...orig,
                        start: new Date(orig.start),
                        end:   new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }
            // pinned domain offset:
            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const mouseDomain = scale.invert(localX).getTime();
            d.__grabOffset = mouseDomain - me.start.getTime();
        })
        .on("drag", function(event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const mouseDomain = scale.invert(localX).getTime();
            const desired = mouseDomain - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            const shiftMs = newStart.getTime() - me.start.getTime();
            me.start = new Date(me.start.getTime() + shiftMs);
            me.end   = new Date(me.end.getTime()   + shiftMs);

            // BFS recalc
            doBFSRecalc(d.id, ephemeralMap);

            // re-draw
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);

            // highlight
            svg.selectAll(".task-bar")
                .filter(x => x.id === d.id)
                .attr("stroke","black");
        })
        .on("end", function(event, d) {
            d3.select(this).attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ========== DRAG LEFT HANDLE ==========
    const dragLeft = d3.drag()
        .on("start", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke","black");

            d.__ephemeralMap = new Map();
            const down = collectDownstream(d.id, downstreamMap);
            down.add(d.id);

            for (const tid of down) {
                const orig = byId.get(tid);
                if (orig) {
                    d.__ephemeralMap.set(tid, {
                        ...orig,
                        start: new Date(orig.start),
                        end:   new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }

            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const mouseDomain = scale.invert(localX).getTime();
            d.__grabOffset = mouseDomain - me.start.getTime();
        })
        .on("drag", function(event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const mouseDomain = scale.invert(localX).getTime();
            const desired = mouseDomain - d.__grabOffset;
            const newDate = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // clamp so start <= end
            if (newDate.getTime() > me.end.getTime()) return;

            me.start = newDate;

            doBFSRecalc(d.id, ephemeralMap);
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);

            svg.selectAll(".task-bar")
                .filter(x => x.id === d.id)
                .attr("stroke","black");
        })
        .on("end", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ========== DRAG RIGHT HANDLE ==========
    const dragRight = d3.drag()
        .on("start", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke","black");

            d.__ephemeralMap = new Map();
            const down = collectDownstream(d.id, downstreamMap);
            down.add(d.id);

            for (const tid of down) {
                const orig = byId.get(tid);
                if (orig) {
                    d.__ephemeralMap.set(tid, {
                        ...orig,
                        start: new Date(orig.start),
                        end:   new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }

            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const mouseDomain = scale.invert(localX).getTime();
            d.__grabOffset = mouseDomain - me.end.getTime();
        })
        .on("drag", function(event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const mouseDomain = scale.invert(localX).getTime();
            const desired = mouseDomain - d.__grabOffset;
            const newDate = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // clamp so end >= start
            if (newDate.getTime() < me.start.getTime()) return;

            me.end = newDate;

            doBFSRecalc(d.id, ephemeralMap);
            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);

            svg.selectAll(".task-bar")
                .filter(x => x.id === d.id)
                .attr("stroke","black");
        })
        .on("end", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // attach drags
    svg.selectAll(".task-bar").call(dragBar);
    svg.selectAll(".task-handle-left").call(dragLeft);
    svg.selectAll(".task-handle-right").call(dragRight);
}

// Export
const drawHelper = {
    drawRuler,
    drawCanvas: drawGrid,
    drawEverything
};

export default drawHelper;

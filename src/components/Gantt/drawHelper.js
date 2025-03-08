// src/components/Gantt/drawHelper.js

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

/**
 * Build adjacency maps for BFS:
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
function buildUpstreamMap(tasks) {
    const map = {};
    for (const child of tasks) {
        if (!Array.isArray(child.dependencies)) continue;
        for (const dep of child.dependencies) {
            if (!map[child.id]) map[child.id] = [];
            map[child.id].push({ id: dep.id, type: dep.type });
        }
    }
    return map;
}

/**
 * BFS collection
 */
function collectDownstream(startId, downstreamMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (downstreamMap[cur]) {
            for (const c of downstreamMap[cur]) {
                if (!visited.has(c.id)) {
                    queue.push(c.id);
                }
            }
        }
    }
    return visited;
}
function collectUpstream(startId, upstreamMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (upstreamMap[cur]) {
            for (const p of upstreamMap[cur]) {
                if (!visited.has(p.id)) {
                    queue.push(p.id);
                }
            }
        }
    }
    return visited;
}

/**
 * Standard BFS recalc: shift children downstream if needed
 */
function recalcDownstreamBFS(changedId, ephemeralMap, downstreamMap) {
    const queue = [changedId];
    while (queue.length) {
        const parentId = queue.shift();
        const children = downstreamMap[parentId] || [];
        for (const { id: childId } of children) {
            const child = ephemeralMap.get(childId);
            if (!child) continue;
            const changed = applyAllParentConstraints(child, ephemeralMap);
            if (changed) {
                queue.push(childId);
            }
        }
    }
}
/**
 * BFS recalc upstream: shift parents if the child is forcing constraints in reverse
 */
function recalcUpstreamBFS(changedId, ephemeralMap, upstreamMap) {
    const queue = [changedId];
    while (queue.length) {
        const childId = queue.shift();
        const parents = upstreamMap[childId] || [];
        for (const { id: parentId } of parents) {
            const parent = ephemeralMap.get(parentId);
            if (!parent) continue;
            const changed = applyChildConstraintsToParent(parent, ephemeralMap);
            if (changed) {
                queue.push(parentId);
            }
        }
    }
}

/**
 * Child constraints => parent can be forced left
 */
function applyChildConstraintsToParent(parent, ephemeralMap) {
    // gather all children that rely on this parent
    const children = [];
    ephemeralMap.forEach(t => {
        if (!Array.isArray(t.dependencies)) return;
        if (t.dependencies.some(dep => dep.id === parent.id)) {
            children.push(t);
        }
    });

    let changed = false;
    let ps = parent.start.getTime();
    let pe = parent.end.getTime();

    for (const c of children) {
        const cs = c.start.getTime();
        const ce = c.end.getTime();
        for (const dep of c.dependencies || []) {
            if (dep.id !== parent.id) continue;

            // normal FS => c.start >= p.end => reversed => p.end <= c.start
            if (dep.type === "FS") {
                if (pe > cs) {
                    const delta = pe - cs;
                    pe -= delta;
                    ps -= delta;
                    changed = true;
                }
            }
            else if (dep.type === "SS") {
                // c.start >= p.start => p.start <= c.start
                if (ps > cs) {
                    const delta = ps - cs;
                    ps -= delta;
                    pe -= delta;
                    changed = true;
                }
            }
            else if (dep.type === "FF") {
                // c.end >= p.end => p.end <= c.end
                if (pe > ce) {
                    const delta = pe - ce;
                    pe -= delta;
                    ps -= delta;
                    changed = true;
                }
            }
            else if (dep.type === "SF") {
                // c.end >= p.start => p.start <= c.end
                if (ps > ce) {
                    const delta = ps - ce;
                    ps -= delta;
                    pe -= delta;
                    changed = true;
                }
            }
        }
    }

    if (changed) {
        parent.start = new Date(ps);
        parent.end   = new Date(pe);
    }
    return changed;
}

/**
 * For a child with multiple parents, shift it if needed
 */
function applyAllParentConstraints(child, ephemeralMap) {
    if (!child.dependencies) return false;
    let changed = false;
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
                s += delta;
                e += delta;
                changed = true;
            }
        }
        else if (dep.type === "SS") {
            // child.start >= parent.start
            if (s < ps) {
                const delta = ps - s;
                s += delta;
                e += delta;
                changed = true;
            }
        }
        else if (dep.type === "FF") {
            // child.end >= parent.end
            if (e < pe) {
                const delta = pe - e;
                s += delta;
                e += delta;
                changed = true;
            }
        }
        else if (dep.type === "SF") {
            // child.end >= parent.start
            if (e < ps) {
                const delta = ps - e;
                s += delta;
                e += delta;
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
 * Snap a date to the nearest increment (if snap is on)
 */
function maybeSnap(date, snap, inc) {
    if (!snap) return date;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offsetMs = date.getTime() - dayStart.getTime();
    const remainder = offsetMs % inc;
    const half = inc / 2;
    const corrected = (remainder >= half)
        ? offsetMs + (inc - remainder)
        : offsetMs - remainder;
    return new Date(dayStart.getTime() + corrected);
}

/**
 * The core "clamp" logic used in "Enforce Constraints" mode.
 * We differentiate:
 *   - mode="move": If you violate constraints, shift the entire bar.
 *   - mode="left": If you violate constraints, clamp only the start edge.
 *   - mode="right": If you violate constraints, clamp only the end edge.
 */
function clampTaskToConstraints(task, ephemeralMap, downstreamMap, upstreamMap, mode) {
    // We'll do repeated passes until stable so we handle multiple constraints
    let stable = false;
    while (!stable) {
        stable = true;
        const oldS = task.start.getTime();
        const oldE = task.end.getTime();

        // 1) clamp against parents
        if (Array.isArray(task.dependencies)) {
            for (const dep of task.dependencies) {
                const parent = ephemeralMap.get(dep.id);
                if (!parent) continue;

                const ps = parent.start.getTime();
                const pe = parent.end.getTime();

                if (dep.type === "FS") {
                    // child.start >= parent.end
                    if (task.start < pe) {
                        // how we fix it depends on mode
                        if (mode === "move") {
                            const shift = pe - task.start.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "left") {
                            // clamp only the left side to pe
                            task.start = new Date(pe);
                            // do NOT shift the end
                        }
                        else if (mode === "right") {
                            // resizing right doesn't affect .start
                            // so no action here if the violation is on start
                        }
                    }
                }
                else if (dep.type === "SS") {
                    // child.start >= parent.start
                    if (task.start < ps) {
                        if (mode === "move") {
                            const shift = ps - task.start.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "left") {
                            task.start = new Date(ps);
                        }
                        // (mode==="right") => no clamp if violation is about start
                    }
                }
                else if (dep.type === "FF") {
                    // child.end >= parent.end
                    if (task.end < pe) {
                        if (mode === "move") {
                            const shift = pe - task.end.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "right") {
                            // clamp only the end
                            task.end = new Date(pe);
                        }
                        // (mode==="left") => no clamp if violation is about end
                    }
                }
                else if (dep.type === "SF") {
                    // child.end >= parent.start
                    if (task.end < ps) {
                        if (mode === "move") {
                            const shift = ps - task.end.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "right") {
                            task.end = new Date(ps);
                        }
                        // (mode==="left") => no clamp
                    }
                }
            }
        }

        // 2) clamp against children (inverse constraints)
        // if child's FS => parent's end <= child.start
        const children = downstreamMap[task.id] || [];
        for (const cinfo of children) {
            const child = ephemeralMap.get(cinfo.id);
            if (!child) continue;
            const cs = child.start.getTime();
            const ce = child.end.getTime();

            if (cinfo.type === "FS") {
                // parent's end <= child's start => if (task.end > cs) => clamp
                if (task.end.getTime() > cs) {
                    if (mode === "move") {
                        const delta = task.end.getTime() - cs;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "right") {
                        task.end = new Date(cs);
                    }
                }
            }
            else if (cinfo.type === "SS") {
                // parent's start <= child's start => if (task.start > cs) => clamp
                if (task.start.getTime() > cs) {
                    if (mode === "move") {
                        const delta = task.start.getTime() - cs;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "left") {
                        task.start = new Date(cs);
                    }
                }
            }
            else if (cinfo.type === "FF") {
                // parent's end <= child's end => if (task.end > ce) => clamp
                if (task.end.getTime() > ce) {
                    if (mode === "move") {
                        const delta = task.end.getTime() - ce;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "right") {
                        task.end = new Date(ce);
                    }
                }
            }
            else if (cinfo.type === "SF") {
                // parent's start <= child's end => if (task.start > ce) => clamp
                if (task.start.getTime() > ce) {
                    if (mode === "move") {
                        const delta = task.start.getTime() - ce;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "left") {
                        task.start = new Date(ce);
                    }
                }
            }
        }

        const newS = task.start.getTime();
        const newE = task.end.getTime();
        if (newS !== oldS || newE !== oldE) {
            stable = false;
        }
    }
}

/**
 * Merge ephemeral changes back into the original tasks array
 */
function mergeEphemeral(tasks, ephemeralMap) {
    return tasks.map(t => ephemeralMap.get(t.id) || t);
}

/**
 * Draw tasks (bars) plus dependencies
 */
function renderTasksAndDependencies(svg, scale, tasks, cfg) {
    drawTasks(svg, scale, tasks, cfg);
    drawDependencies(svg, tasks, scale, tasks, cfg);
}
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
        .style("filter","drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");

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
function drawDependencies(svg, tasks, scale, allTasks, cfg) {
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

/**
 * Grid
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
 * Ruler
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
 * Return day-based marks for the given range
 */
function getTimeMarks({ start, end }, mode="2w") {
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
 * Master function
 */
function drawEverything({
                            svg, scale, timeRanges, defaults,
                            tasks, width,
                            snapEnabled, snapIncrement,
                            setTasks,
                            enforceConstraints
                        }) {
    svg.selectAll("*").remove();

    // set size
    const totalH = defaults.rowHeight * tasks.length;
    svg.attr("width", width).attr("height", totalH);

    // draw grid
    drawGrid(scale, svg, timeRanges, defaults, tasks);

    // draw tasks + dependencies
    renderTasksAndDependencies(svg, scale, tasks, defaults);

    // adjacency
    const downstreamMap = buildDownstreamMap(tasks);
    const upstreamMap   = buildUpstreamMap(tasks);
    const byId = new Map(tasks.map(t => [t.id, t]));

    function commitChanges(ephemeralMap) {
        setTasks( mergeEphemeral(tasks, ephemeralMap) );
    }
    function doTwoWayBFS(changedId, ephemeralMap) {
        recalcDownstreamBFS(changedId, ephemeralMap, downstreamMap);
        recalcUpstreamBFS(changedId, ephemeralMap, upstreamMap);
    }
    function getLocalMouseX(event) {
        const [mx] = d3.pointer(event, svg.node());
        return mx;
    }

    // ========== ENTIRE BAR DRAG ==========
    const dragBar = d3.drag()
        .on("start", function(event, d) {
            d3.select(this).attr("stroke","black");

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
                        end:   new Date(orig.end),
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
        .on("drag", function(event, d) {
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
            me.end   = new Date(me.end.getTime()   + shiftMs);

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "move");
            } else {
                doTwoWayBFS(d.id, ephemeralMap);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke","black");
        })
        .on("end", function(event, d) {
            d3.select(this).attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ========== LEFT HANDLE DRAG ==========
    const dragLeft = d3.drag()
        .on("start", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke","black");
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
                        end:   new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }
            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.start.getTime();
        })
        .on("drag", function(event, d) {
            const ephemeralMap = d.__ephemeralMap;
            const me = ephemeralMap.get(d.id);
            if (!me) return;

            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            const desired = domainX - d.__grabOffset;
            const newStart = maybeSnap(new Date(desired), snapEnabled, snapIncrement);

            // ensure we don't cross the end
            if (newStart.getTime() > me.end.getTime()) {
                // ignore or clamp, but let's just ignore
                return;
            }
            me.start = newStart;

            if (enforceConstraints) {
                clampTaskToConstraints(me, ephemeralMap, downstreamMap, upstreamMap, "left");
            } else {
                doTwoWayBFS(d.id, ephemeralMap);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke","black");
        })
        .on("end", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // ========== RIGHT HANDLE DRAG ==========
    const dragRight = d3.drag()
        .on("start", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke","black");
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
                        end:   new Date(orig.end),
                        dependencies: orig.dependencies
                    });
                }
            }
            const me = d.__ephemeralMap.get(d.id);
            const localX = getLocalMouseX(event);
            const domainX = scale.invert(localX).getTime();
            d.__grabOffset = domainX - me.end.getTime();
        })
        .on("drag", function(event, d) {
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
                doTwoWayBFS(d.id, ephemeralMap);
            }

            const merged = mergeEphemeral(tasks, ephemeralMap);
            renderTasksAndDependencies(svg, scale, merged, defaults);
            svg.selectAll(".task-bar").filter(x => x.id === d.id).attr("stroke","black");
        })
        .on("end", function(event, d) {
            d3.select(this.parentNode).select(".task-bar").attr("stroke", null);
            commitChanges(d.__ephemeralMap);
        });

    // attach the drags
    svg.selectAll(".task-bar").call(dragBar);
    svg.selectAll(".task-handle-left").call(dragLeft);
    svg.selectAll(".task-handle-right").call(dragRight);
}

// Exports
const drawHelper = {
    drawRuler,
    drawCanvas: drawGrid,
    drawEverything
};

export default drawHelper;

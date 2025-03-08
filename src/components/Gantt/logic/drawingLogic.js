// src/components/Gantt/drawingLogic.js

/**
 * This module handles all the rendering logic using D3 and the DOM.
 * It knows nothing about BFS or constraint logic—just how to draw tasks/dependencies/rulers/grids.
 */

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

/**
 * Draw tasks (bars) + dependencies in one go.
 */
export function renderTasksAndDependencies(svg, scale, tasks, cfg) {
    drawTasks(svg, scale, tasks, cfg);
    drawDependencies(svg, tasks, scale, tasks, cfg);
}

/**
 * Draw the task bars and any text or handles within them.
 */
export function drawTasks(svg, scale, tasks, cfg) {
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

    // Invisible handles for resizing
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
 * Draw dependencies (arrows) between tasks based on their relationships.
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

    // Cubic-like path with horizontal "handles".
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
 * Draw grid lines for the Gantt chart.
 */
export function drawGrid(scale, svg, range, cfg, tasks, mode="2w") {
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
 * Draw the top "ruler" that labels time increments (e.g., days).
 */
export function drawRuler(scale, svg, range, cfg, mode="2w") {
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
 * Return a list of Date marks between `range.start` and `range.end`.
 */
export function getTimeMarks({ start, end }, mode="2w") {
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

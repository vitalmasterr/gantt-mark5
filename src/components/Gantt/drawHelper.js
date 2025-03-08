// src/components/Gantt/drawHelper.js

import * as d3 from "d3";
import ganttHelpers from "./ganttHelpers.js";

const drawHelper = (() => {
    // Marks calculation
    function getTimeMarks({ start, end }, mode) {
        const s = ganttHelpers.timeHelper.getStartOfDay(start),
            e = ganttHelpers.timeHelper.getEndOfDay(end),
            incFn = ganttHelpers.timeHelper.incrementMap[mode];
        if (!s || !e || s > e || typeof incFn !== "function") return [];
        const result = [], cur = new Date(s);
        while (cur <= e) { result.push(new Date(cur)); incFn(cur); }
        return result;
    }

    // Ruler lines & labels
    function drawRuler(scale, svg, range, cfg, mode="1w") {
        if (!scale || !svg || !range?.start || !range?.end) return;
        const marks = getTimeMarks(range, mode),
            halfCol = cfg.columnWidth * 0.5;

        const groups = svg.selectAll(".large-mark").data(marks).join("g").attr("class","large-mark");
        groups.append("line")
            .attr("class","ruler-line large-mark-line")
            .attr("x1", d => scale(d)).attr("y1", cfg.rulerHeight)
            .attr("x2", d => scale(d)).attr("y2", cfg.rulerHeight)
            .attr("stroke","black").attr("stroke-width",1);

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

    // Main canvas grid & tasks
    function drawCanvas(scale, svg, range, cfg, tasks, mode="1w") {
        if (!svg || !range || !cfg) return;
        const marks = getTimeMarks(range, mode),
            w = cfg.columnWidth * marks.length,
            h = cfg.rowHeight * tasks.length;
        svg.attr("width", w).attr("height", h);

        // Grid lines
        const grid = svg.selectAll(".canvas-grid").data(marks).join("g").attr("class","canvas-grid");
        // Vertical
        grid.append("line")
            .attr("x1", d => scale(d)).attr("y1", 0)
            .attr("x2", d => scale(d)).attr("y2", h)
            .attr("stroke","#ccc").attr("stroke-width",1);
        // Horizontal
        grid.append("line")
            .attr("x1", 0).attr("y1",(d,i) => i * cfg.rowHeight)
            .attr("x2", w).attr("y2",(d,i) => i * cfg.rowHeight)
            .attr("stroke","#ccc").attr("stroke-width",1);

        // Task bars
        const gap = 0.2 * cfg.rowHeight;
        const gTask = svg.selectAll(".task-group").data(tasks).join("g").attr("class","task-group");

        gTask.append("rect")
            .attr("class","task-bar")
            .attr("x", d => scale(d.start))
            .attr("y",(d,i) => i * cfg.rowHeight + gap)
            .attr("width", d => scale(d.end) - scale(d.start))
            .attr("height", cfg.rowHeight - gap*2)
            .attr("rx",2)
            .attr("fill","#3497d9")
            .attr("stroke", d => d3.color("#3497d9").darker(0.5))
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
    }

    // Optional snapping
    function maybeSnap(date, snap, inc) {
        if (!snap) return date;
        const ms = inc, mid = new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            off = date.getTime() - mid.getTime(),
            rem = off % ms,
            half = ms / 2;
        return new Date(mid.getTime() + (rem >= half ? off + (ms - rem) : off - rem));
    }

    // Draw entire Gantt (grid, tasks, drag/resize, dependencies)
    function drawEverything({ svg, scale, timeRanges, defaults, tasks, width, snapEnabled, snapIncrement, setTasks }) {
        svg.selectAll("*").remove();
        const totalH = defaults.rowHeight * tasks.length;
        svg.attr("width", width).attr("height", totalH);

        // 1) Grid + tasks
        drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

        // 2) Drag/resize logic
        function commitChanges(d, sel) {
            const x = parseFloat(sel.attr("x")),
                w = parseFloat(sel.attr("width"));
            let newStart = scale.invert(x),
                newEnd   = scale.invert(x + w);
            newStart = maybeSnap(newStart, snapEnabled, snapIncrement);
            newEnd   = maybeSnap(newEnd, snapEnabled, snapIncrement);
            setTasks(tasks.map(t => t.id === d.id ? { ...t, start: newStart, end: newEnd } : t));
        }

        // Drag entire bar
        const dragBar = d3.drag()
            .on("start", function(e, d) {
                d3.select(this).attr("stroke","black");
                d.__offsetX = e.x - parseFloat(d3.select(this).attr("x"));
            })
            .on("drag", function(e, d) {
                const bar = d3.select(this),
                    rawX = e.x - d.__offsetX,
                    snapped = maybeSnap(scale.invert(rawX), snapEnabled, snapIncrement);
                bar.attr("x", scale(snapped));
                d3.select(this.parentNode).select("text.task-label").attr("x", scale(snapped) + 10);
            })
            .on("end", function(e, d) {
                d3.select(this).attr("stroke", null);
                commitChanges(d, d3.select(this));
            });

        // Drag left handle
        const dragLeft = d3.drag()
            .on("start", function() {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke","black");
            })
            .on("drag", function(e, d) {
                const bar = d3.select(this.parentNode).select(".task-bar"),
                    txt = d3.select(this.parentNode).select(".task-label"),
                    rawL = e.x,
                    snapped = maybeSnap(scale.invert(rawL), snapEnabled, snapIncrement),
                    leftX = scale(snapped),
                    rightX = scale(d.end),
                    w = rightX - leftX;
                if (w > 0) {
                    bar.attr("x", leftX).attr("width", w);
                    txt.attr("x", leftX + 10);
                }
            })
            .on("end", function(e, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);
                commitChanges(d, d3.select(this.parentNode).select("rect.task-bar"));
            });

        // Drag right handle
        const dragRight = d3.drag()
            .on("start", function() {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke","black");
            })
            .on("drag", function(e, d) {
                const bar = d3.select(this.parentNode).select(".task-bar"),
                    rawR = e.x,
                    snapped = maybeSnap(scale.invert(rawR), snapEnabled, snapIncrement),
                    rightX = scale(snapped),
                    leftX = scale(d.start),
                    w = rightX - leftX;
                if (w > 0) bar.attr("width", w);
            })
            .on("end", function(e, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);
                commitChanges(d, d3.select(this.parentNode).select("rect.task-bar"));
            });

        // Attach drags
        svg.selectAll(".task-bar").call(dragBar);

        // Invisible handles
        const handleW = 8;
        svg.selectAll(".task-group").each(function(d) {
            const g = d3.select(this),
                bar = g.select("rect.task-bar"),
                x = +bar.attr("x"),
                w = +bar.attr("width"),
                y = +bar.attr("y"),
                h = +bar.attr("height");
            g.append("rect")
                .attr("class","task-handle-left")
                .attr("x", x - handleW/2).attr("y", y)
                .attr("width", handleW).attr("height", h)
                .attr("fill","transparent").style("cursor","ew-resize");
            g.append("rect")
                .attr("class","task-handle-right")
                .attr("x", x + w - handleW/2).attr("y", y)
                .attr("width", handleW).attr("height", h)
                .attr("fill","transparent").style("cursor","ew-resize");
        });
        svg.selectAll(".task-handle-left").call(dragLeft);
        svg.selectAll(".task-handle-right").call(dragRight);

        // 3) Dependencies
        let defs = svg.select("defs");
        if (!defs.size()) defs = svg.append("defs");
        defs.selectAll("#arrowhead").remove();
        defs.append("marker")
            .attr("id","arrowhead").attr("viewBox","0 -5 10 10")
            .attr("refX",8).attr("refY",0)
            .attr("markerWidth",6).attr("markerHeight",6)
            .attr("orient","auto")
            .append("path").attr("d","M0,-5L10,0L0,5").attr("fill","#555");

        const depLayer = svg.append("g").attr("class","dependency-layer");
        const tasksById = new Map(tasks.map(t => [t.id, t]));
        const offset = 20;
        function pathData(sx, sy, tx, ty) {
            const inSx = sx + offset, inTx = tx - offset, midX = inSx + (inTx - inSx)/2;
            return `M${sx},${sy}H${inSx}C${midX},${sy} ${midX},${ty} ${inTx},${ty}H${tx}`;
        }

        tasks.forEach((src, i) => {
            if (!Array.isArray(src.dependencies)) return;
            const sx = scale(src.end), sy = i * defaults.rowHeight + defaults.rowHeight*0.5;
            src.dependencies.forEach(dep => {
                const targ = tasksById.get(dep.id);
                if (!targ) return;
                const ti = tasks.findIndex(t => t.id === dep.id);
                if (ti < 0) return;
                const tx = scale(targ.start), ty = ti * defaults.rowHeight + defaults.rowHeight*0.5;
                depLayer.append("path")
                    .attr("d", pathData(sx, sy, tx, ty))
                    .attr("fill","none").attr("stroke","#555").attr("stroke-width",1.5)
                    .attr("stroke-dasharray","4 2").attr("marker-end","url(#arrowhead)");
            });
        });
    }

    return { drawRuler, drawCanvas, drawEverything };
})();

export default drawHelper;
// src\components\Gantt\GanttCanvas\GanttCanvas.jsx
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import { drawHelper } from "../ganttHelpers.js";
import * as d3 from "d3";

/**
 * If snapping is enabled, rounds a Date to the nearest increment.
 */
function maybeSnap(date) {
    const { snapEnabled, snapIncrement } = useGanttStore.getState();
    if (!snapEnabled) return date;

    const incrementMs = snapIncrement;
    const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offsetFromMidnight = date.getTime() - localMidnight.getTime();
    const remainder = offsetFromMidnight % incrementMs;
    const half = incrementMs / 2;

    let snappedOffset;
    if (remainder >= half) {
        snappedOffset = offsetFromMidnight + (incrementMs - remainder);
    } else {
        snappedOffset = offsetFromMidnight - remainder;
    }
    return new Date(localMidnight.getTime() + snappedOffset);
}

function GanttCanvas() {
    const timeRanges = useGanttStore(state => state.timeRanges);
    const defaults   = useGanttStore(state => state.defaults);
    const tasks      = useGanttStore(state => state.tasks);
    const scale      = useGanttStore(state => state.scale);
    const width      = useGanttStore(state => state.width);
    const setTasks   = useGanttStore(state => state.setTasks);

    const svgRef = React.useRef(null);

    React.useEffect(() => {
        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start > timeRanges.end) {
            return;
        }

        // Clear the SVG and set size
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const totalHeight = defaults.rowHeight * tasks.length;
        svg.attr("width", width).attr("height", totalHeight);

        // ------------------------------------------------------
        // 1) Draw background grid + tasks
        // ------------------------------------------------------
        drawHelper.drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

        // ------------------------------------------------------
        // 2) Drag/Resize logic for each task bar
        // ------------------------------------------------------
        function commitChanges(d, barSelection) {
            const finalX = parseFloat(barSelection.attr("x"));
            const finalW = parseFloat(barSelection.attr("width"));

            let newStart = scale.invert(finalX);
            let newEnd   = scale.invert(finalX + finalW);

            newStart = maybeSnap(newStart);
            newEnd   = maybeSnap(newEnd);

            const updatedTasks = tasks.map(t =>
                t.id === d.id ? { ...t, start: newStart, end: newEnd } : t
            );
            setTasks(updatedTasks);
        }

        const dragBar = d3.drag()
            .on("start", function(event, d) {
                d3.select(this).attr("stroke", "black");
                d.__offsetX = event.x - parseFloat(d3.select(this).attr("x"));
            })
            .on("drag", function(event, d) {
                const bar = d3.select(this);
                const rawX = event.x - d.__offsetX;

                let proposedDate = scale.invert(rawX);
                proposedDate = maybeSnap(proposedDate);
                const snappedX = scale(proposedDate);

                bar.attr("x", snappedX);
                d3.select(this.parentNode).select("text.task-label").attr("x", snappedX + 10);
            })
            .on("end", function(event, d) {
                d3.select(this).attr("stroke", null);
                commitChanges(d, d3.select(this));
            });

        const dragLeftHandle = d3.drag()
            .on("start", function(event, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", "black");
                d.__rightX = scale(d.end);
            })
            .on("drag", function(event, d) {
                const bar  = d3.select(this.parentNode).select("rect.task-bar");
                const text = d3.select(this.parentNode).select("text.task-label");

                let rawLeftX = event.x;
                let proposedDate = scale.invert(rawLeftX);
                proposedDate = maybeSnap(proposedDate);
                const snappedX = scale(proposedDate);

                const w = d.__rightX - snappedX;
                if (w < 0) return;

                bar.attr("x", snappedX).attr("width", w);
                text.attr("x", snappedX + 10);
            })
            .on("end", function(event, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                commitChanges(d, bar);
            });

        const dragRightHandle = d3.drag()
            .on("start", function(event, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", "black");
                d.__leftX = scale(d.start);
            })
            .on("drag", function(event, d) {
                const bar = d3.select(this.parentNode).select("rect.task-bar");

                let rawRightX = event.x;
                let proposedDate = scale.invert(rawRightX);
                proposedDate = maybeSnap(proposedDate);
                const snappedRightX = scale(proposedDate);

                const newW = snappedRightX - d.__leftX;
                if (newW < 0) return;

                bar.attr("width", newW);
            })
            .on("end", function(event, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                commitChanges(d, bar);
            });

        // Attach the main bar drag
        svg.selectAll(".task-bar").call(dragBar);

        // Create invisible left/right handles
        const handleWidth = 8;
        svg.selectAll(".task-group").each(function(d) {
            const group = d3.select(this);
            const bar = group.select("rect.task-bar");
            const x = parseFloat(bar.attr("x"));
            const w = parseFloat(bar.attr("width"));
            const y = parseFloat(bar.attr("y"));
            const h = parseFloat(bar.attr("height"));

            // Left handle
            group.append("rect")
                .attr("class", "task-handle-left")
                .attr("x", x - handleWidth / 2)
                .attr("y", y)
                .attr("width", handleWidth)
                .attr("height", h)
                .attr("fill", "transparent")
                .style("cursor", "ew-resize");

            // Right handle
            group.append("rect")
                .attr("class", "task-handle-right")
                .attr("x", x + w - handleWidth / 2)
                .attr("y", y)
                .attr("width", handleWidth)
                .attr("height", h)
                .attr("fill", "transparent")
                .style("cursor", "ew-resize");
        });

        svg.selectAll(".task-handle-left").call(dragLeftHandle);
        svg.selectAll(".task-handle-right").call(dragRightHandle);

        // ------------------------------------------------------
        // 3) DRAW DEPENDENCIES:
        //    If a "sourceTask" has dependencies: [{id: X}, ...],
        //    we draw a line from sourceTask (right edge) to that
        //    "X" task's left edge.
        // ------------------------------------------------------
        // a) Define arrow marker in <defs>
        let defs = svg.select("defs");
        if (!defs.size()) defs = svg.append("defs");
        defs.selectAll("#arrowhead").remove();
        defs
            .append("marker")
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

        // b) A separate layer for lines
        svg.selectAll("g.dependency-layer").remove();
        const depLayer = svg.append("g").attr("class", "dependency-layer");

        // c) For quick lookups
        const tasksById = new Map(tasks.map(t => [t.id, t]));

        // d) Build a path with a short horizontal offset from each edge + a smooth curve
        const offset = 20; // horizontal offset at each end
        function getDependencyPath(sx, sy, tx, ty) {
            // We'll do:
            //   M(sx, sy)         (start at source edge)
            //   H(sx + offset)    short horizontal segment
            //   C(...)            smooth S-curve
            //   H(tx)             final horizontal into target
            const innerStartX = sx + offset;
            const innerEndX   = tx - offset;
            // midpoint for control points
            const midX        = innerStartX + (innerEndX - innerStartX) / 2;

            return `
                M${sx},${sy}
                H${innerStartX}
                C${midX},${sy}
                 ${midX},${ty}
                 ${innerEndX},${ty}
                H${tx}
            `;
        }

        // e) For each task that has dependencies, draw line from the "task" → each "dep.id"
        tasks.forEach((sourceTask, i) => {
            if (!Array.isArray(sourceTask.dependencies)) return;

            const sourceX = scale(sourceTask.end); // right edge
            const sourceY = i * defaults.rowHeight + defaults.rowHeight * 0.5;

            sourceTask.dependencies.forEach(dep => {
                const targetTask = tasksById.get(dep.id);
                if (!targetTask) return;

                const targetIndex = tasks.findIndex(t => t.id === dep.id);
                if (targetIndex < 0) return;

                // left edge
                const targetX = scale(targetTask.start);
                const targetY = targetIndex * defaults.rowHeight + defaults.rowHeight * 0.5;

                // Build the path
                const pathData = getDependencyPath(sourceX, sourceY, targetX, targetY);

                depLayer
                    .append("path")
                    .attr("d", pathData)
                    .attr("fill", "none")
                    .attr("stroke", "#555")
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", "4 2")
                    .attr("marker-end", "url(#arrowhead)");
            });
        });

    }, [timeRanges, tasks, scale, width, defaults, setTasks]);

    return (
        <div className="gantt-canvas">
            <svg ref={svgRef} />
        </div>
    );
}

export default GanttCanvas;

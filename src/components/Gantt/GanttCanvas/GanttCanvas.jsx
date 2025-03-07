// src\components\Gantt\GanttCanvas\GanttCanvas.jsx
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import { drawHelper } from "../ganttHelpers.js";
import * as d3 from "d3";

/**
 * Rounds (snaps) a Date to the nearest increment in local time,
 * but only if snapping is enabled.
 */
function maybeSnap(date) {
    const { snapEnabled, snapIncrement } = useGanttStore.getState();
    if (!snapEnabled) {
        // If snap is disabled, just return the date as-is
        return date;
    }

    // Otherwise, do the actual rounding:
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

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();  // clear existing

        const height = defaults.rowHeight * tasks.length;
        svg.attr("width", width).attr("height", height);

        // (1) Draw background grid + tasks
        drawHelper.drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

        // Helper to commit changes to store after a drag
        function commitChanges(d, barSelection) {
            const finalX = parseFloat(barSelection.attr("x"));
            const finalW = parseFloat(barSelection.attr("width"));

            // Convert to Date
            let newStart = scale.invert(finalX);
            let newEnd   = scale.invert(finalX + finalW);

            // Snap or not, depending on store:
            newStart = maybeSnap(newStart);
            newEnd   = maybeSnap(newEnd);

            // Build updated tasks
            const updatedTasks = tasks.map(t =>
                t.id === d.id ? { ...t, start: newStart, end: newEnd } : t
            );
            setTasks(updatedTasks);
        }

        // DRAG ENTIRE BAR
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

        // DRAG LEFT HANDLE
        const dragLeftHandle = d3.drag()
            .on("start", function(event, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", "black");
                d.__rightX = scale(d.end);
            })
            .on("drag", function(event, d) {
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                const text = d3.select(this.parentNode).select("text.task-label");

                let rawLeftX = event.x;
                let proposedDate = scale.invert(rawLeftX);
                proposedDate = maybeSnap(proposedDate);
                const snappedX = scale(proposedDate);

                const w = d.__rightX - snappedX;
                if (w < 0) return; // avoid negative widths

                bar.attr("x", snappedX).attr("width", w);
                text.attr("x", snappedX + 10);
            })
            .on("end", function(event, d) {
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                commitChanges(d, bar);
            });

        // DRAG RIGHT HANDLE
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

        // Attach the drags
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

        // Attach handle drags
        svg.selectAll(".task-handle-left").call(dragLeftHandle);
        svg.selectAll(".task-handle-right").call(dragRightHandle);

    }, [timeRanges, tasks, scale, width, defaults, setTasks]);

    return (
        <div className="gantt-canvas">
            <svg ref={svgRef} />
        </div>
    );
}

export default GanttCanvas;

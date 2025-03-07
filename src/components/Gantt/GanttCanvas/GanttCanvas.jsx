import React from 'react';
import useGanttStore from "../useGanttStore.js";
import { drawHelper } from "../ganttHelpers.js";
import * as d3 from "d3";

function GanttCanvas(props) {
    const timeRanges = useGanttStore(state => state.timeRanges);
    const defaults = useGanttStore(state => state.defaults);
    const tasks = useGanttStore(state => state.tasks);
    const scale = useGanttStore(state => state.scale);
    const width = useGanttStore(state => state.width);
    const setTasks = useGanttStore(state => state.setTasks);

    const svgRef = React.useRef(null);

    React.useEffect(() => {
        // Guard against invalid date range
        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start > timeRanges.end) {
            return;
        }

        const svg = d3.select(svgRef.current);
        // Clear previous
        svg.selectAll("*").remove();

        const height = defaults.rowHeight * tasks.length;
        svg.attr("width", width);
        svg.attr("height", height);

        // 1) Draw grid + tasks
        drawHelper.drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

        // ----- DRAG BEHAVIOR FOR ENTIRE BAR (move bar left/right) -----
        const dragBar = d3.drag()
            .on("start", function(event, d) {
                // highlight the bar
                d3.select(this).attr("stroke", "black");
                // store offset for the bar drag
                d.__offsetX = event.x - parseFloat(d3.select(this).attr("x"));
            })
            .on("drag", function(event, d) {
                const newX = event.x - d.__offsetX;

                // move the bar
                d3.select(this).attr("x", newX);

                // move the text as well
                d3.select(this.parentNode).select("text.task-label").attr("x", newX + 10);
            })
            .on("end", function(event, d) {
                // remove highlight
                d3.select(this).attr("stroke", null);

                // final position
                const finalX = parseFloat(d3.select(this).attr("x"));
                const barWidth = parseFloat(d3.select(this).attr("width"));

                // convert back to dates
                const newStart = scale.invert(finalX);
                const newEnd   = scale.invert(finalX + barWidth);

                // build updated tasks array
                const updatedTasks = tasks.map(t =>
                    t.id === d.id ? { ...t, start: newStart, end: newEnd } : t
                );
                setTasks(updatedTasks);
            });

        // ----- DRAG BEHAVIOR FOR LEFT HANDLE -----
        const dragLeftHandle = d3.drag()
            .on("start", function(event, d) {
                // highlight bar
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", "black");
                // store the original end so we keep it fixed
                d.__initialEnd = d.end;
            })
            .on("drag", function(event, d) {
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                const text = d3.select(this.parentNode).select("text.task-label");

                // new X for left edge
                const newX = event.x;

                // keep the bar's right side at scale(d.__initialEnd)
                const rightX = scale(d.__initialEnd);
                const newWidth = rightX - newX;

                // move bar left edge
                bar.attr("x", newX);
                bar.attr("width", newWidth);

                // move text near left edge
                text.attr("x", newX + 10);
            })
            .on("end", function(event, d) {
                // remove highlight
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);

                const bar = d3.select(this.parentNode).select("rect.task-bar");
                const finalX = parseFloat(bar.attr("x"));
                const finalW = parseFloat(bar.attr("width"));

                const newStart = scale.invert(finalX);
                const newEnd   = scale.invert(finalX + finalW);

                // build updated tasks
                const updatedTasks = tasks.map(t =>
                    t.id === d.id ? { ...t, start: newStart, end: newEnd } : t
                );
                setTasks(updatedTasks);
            });

        // ----- DRAG BEHAVIOR FOR RIGHT HANDLE -----
        const dragRightHandle = d3.drag()
            .on("start", function(event, d) {
                // highlight bar
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", "black");
                // store original start so we keep it fixed
                d.__initialStart = d.start;
            })
            .on("drag", function(event, d) {
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                const text = d3.select(this.parentNode).select("text.task-label");

                // new X for right edge
                const newRightX = event.x;

                // keep bar's left side at scale(d.__initialStart)
                const leftX = scale(d.__initialStart);
                const newW = newRightX - leftX;

                bar.attr("width", newW);

                // text can remain closer to left unless bar is very small
                // or simply do nothing. If you'd like it to track the right edge, adjust as needed.
                // For now, let's not move the text for right-handle drag.
            })
            .on("end", function(event, d) {
                // remove highlight
                d3.select(this.parentNode).select("rect.task-bar").attr("stroke", null);

                const bar = d3.select(this.parentNode).select("rect.task-bar");
                const finalX = parseFloat(bar.attr("x"));
                const finalW = parseFloat(bar.attr("width"));

                const newStart = scale.invert(finalX);
                const newEnd   = scale.invert(finalX + finalW);

                // build updated tasks
                const updatedTasks = tasks.map(t =>
                    t.id === d.id ? { ...t, start: newStart, end: newEnd } : t
                );
                setTasks(updatedTasks);
            });

        // Attach the bar-drag to the main rect
        svg.selectAll(".task-bar").call(dragBar);

        // Add invisible handles for left & right edges
        // (so they can be grabbed even without a visible knob)
        const handleWidth = 8; // or 6, etc.
        svg.selectAll(".task-group").each(function(d, i) {
            const group = d3.select(this);
            const bar   = group.select("rect.task-bar");
            const x     = parseFloat(bar.attr("x"));
            const w     = parseFloat(bar.attr("width"));
            const y     = parseFloat(bar.attr("y"));
            const h     = parseFloat(bar.attr("height"));

            // Left handle:
            group.append("rect")
                .attr("class", "task-handle-left")
                .attr("x", x - handleWidth / 2)
                .attr("y", y)
                .attr("width", handleWidth)
                .attr("height", h)
                .attr("fill", "transparent")
                .style("cursor", "ew-resize");

            // Right handle:
            group.append("rect")
                .attr("class", "task-handle-right")
                .attr("x", x + w - handleWidth / 2)
                .attr("y", y)
                .attr("width", handleWidth)
                .attr("height", h)
                .attr("fill", "transparent")
                .style("cursor", "ew-resize");
        });

        // Attach the handle-drags
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

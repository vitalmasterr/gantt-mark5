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
        // Guard
        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start > timeRanges.end) return;

        const svg = d3.select(svgRef.current);
        // Clear previous
        svg.selectAll("*").remove();

        const height = defaults.rowHeight * tasks.length;
        svg.attr("width", width);
        svg.attr("height", height);

        // 1) Draw grid + tasks
        drawHelper.drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

        // 2) Drag Behavior
        const dragBehavior = d3.drag()
            .on("start", function(event, d) {
                // Highlight bar
                d3.select(this).select("rect").attr("stroke", "black");
                // Store difference between mouse X and the bar's left edge
                d.__offsetX = event.x - scale(d.start);
            })
            .on("drag", function(event, d) {
                const newX = event.x - d.__offsetX;

                // Move the bar
                d3.select(this).select("rect").attr("x", newX);
                // Move the text (with small left padding)
                d3.select(this).select("text").attr("x", newX + 10);
            })
            .on("end", function(event, d) {
                // Remove highlight
                d3.select(this).select("rect").attr("stroke", null);

                // Final bar X
                const finalX = parseFloat(d3.select(this).select("rect").attr("x"));
                // Convert back to Date
                const newStart = scale.invert(finalX);

                // Keep duration
                const duration = d.end - d.start;
                const newEnd = new Date(newStart.getTime() + duration);

                // Build new tasks array
                const updatedTasks = tasks.map(t =>
                    t.id === d.id
                        ? { ...t, start: newStart, end: newEnd }
                        : t
                );
                // Single store update
                setTasks(updatedTasks);
            });

        // Attach drag to each .task-group
        svg.selectAll(".task-group").call(dragBehavior);

    }, [timeRanges, tasks, scale, width, defaults, setTasks]);

    return (
        <div className="gantt-canvas">
            <svg ref={svgRef} />
        </div>
    );
}

export default GanttCanvas;

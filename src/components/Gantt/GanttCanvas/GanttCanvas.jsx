// src\components\Gantt\GanttCanvas\GanttCanvas.jsx
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import * as d3 from "d3";
import drawHelper from "../logic/drawHelper.js";

function GanttCanvas() {
    // Pull everything from the store
    const tasks       = useGanttStore(state => state.visibleTasks);
    const defaults    = useGanttStore(state => state.defaults);
    const scale       = useGanttStore(state => state.scale);
    const width       = useGanttStore(state => state.width);
    const snapEnabled = useGanttStore(state => state.snapEnabled);
    const snapIncrement = useGanttStore(state => state.snapIncrement);
    const setTasks    = useGanttStore(state => state.setTasks);

    // Pagination domain (either entire range or the clipped/paged domain)
    const domainArray = useGanttStore(state => state.domain); // [start, end]
    const enforceConstraints = useGanttStore(state => state.enforceConstraints);

    const svgRef = React.useRef(null);

    React.useEffect(() => {
        // If we have no valid domain, do nothing
        if (!domainArray || domainArray.length < 2) return;
        const [start, end] = domainArray;
        if (!start || !end || start >= end) return;

        // Select or create the <svg> using d3
        const svg = d3.select(svgRef.current);

        // Clear the SVG each render, so we can attach new drag handlers
        svg.selectAll("*").remove();

        // Draw the grid for just our domain
        drawHelper.drawGrid(
            scale,
            svg,
            { start, end },   // pass only the current domain as the "range"
            defaults,
            tasks,
            "day"             // we’ll label days
        );

        // Then draw tasks + dependencies
        drawHelper.renderTasksAndDependencies(svg, scale, tasks, defaults);

        // Finally set up dragging
        drawHelper.setupDragging({
            svg,
            scale,
            tasks,
            defaults,
            snapEnabled,
            snapIncrement,
            setTasks,
            enforceConstraints,
        });

    }, [
        domainArray,
        tasks,
        scale,
        width,
        defaults,
        snapEnabled,
        snapIncrement,
        setTasks,
        enforceConstraints
    ]);

    return (
        <div className="gantt-canvas">
            {/* The width is set by the chart logic to match the domain range */}
            <svg ref={svgRef} />
        </div>
    );
}

export default GanttCanvas;

// src\components\Gantt\GanttCanvas\GanttCanvas.jsx
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import * as d3 from "d3";
import drawHelper from "../drawHelper.js";

function GanttCanvas() {
    // Pull everything from the store
    const tasks = useGanttStore(state => state.visibleTasks);
    const timeRanges = useGanttStore(state => state.timeRanges);
    const defaults = useGanttStore(state => state.defaults);
    const scale = useGanttStore(state => state.scale);
    const width = useGanttStore(state => state.width);
    const snapEnabled = useGanttStore(state => state.snapEnabled);
    const snapIncrement = useGanttStore(state => state.snapIncrement);
    const setTasks = useGanttStore(state => state.setTasks);

    // NEW: read enforceConstraints from the store
    const enforceConstraints = useGanttStore(state => state.enforceConstraints);

    const svgRef = React.useRef(null);

    React.useEffect(() => {
        // If we have no valid time range, do nothing
        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start >= timeRanges.end) {
            return;
        }

        // Select or create the <svg> using d3
        const svg = d3.select(svgRef.current);

        // Clear the SVG each render, so we can attach new drag handlers
        svg.selectAll("*").remove();

        // Draw everything
        drawHelper.drawEverything({
            svg,
            scale,
            timeRanges,
            defaults,
            tasks,
            width,
            snapEnabled,
            snapIncrement,
            setTasks,
            // Pass enforceConstraints into drawEverything:
            enforceConstraints,
        });

    }, [
        timeRanges,
        tasks,
        scale,
        width,
        defaults,
        snapEnabled,
        snapIncrement,
        setTasks,
        // IMPORTANT: add enforceConstraints to dependencies
        enforceConstraints
    ]);

    return (
        <div className="gantt-canvas">
            <svg ref={svgRef}/>
        </div>
    );
}

export default GanttCanvas;

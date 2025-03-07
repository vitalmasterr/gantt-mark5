// src\components\Gantt\GanttCanvas\GanttCanvas.jsx
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import {drawHelper} from "../ganttHelpers.js";
import * as d3 from "d3";

function GanttCanvas() {
    // IMPORTANT: now we use visibleTasks instead of the old tasks
    const tasks = useGanttStore(state => state.visibleTasks);
    const timeRanges = useGanttStore(state => state.timeRanges);
    const defaults = useGanttStore(state => state.defaults);
    const scale = useGanttStore(state => state.scale);
    const width = useGanttStore(state => state.width);
    const snapEnabled = useGanttStore(state => state.snapEnabled);
    const snapIncrement = useGanttStore(state => state.snapIncrement);
    const setTasks = useGanttStore(state => state.setTasks);

    const svgRef = React.useRef(null);

    React.useEffect(() => {
        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start >= timeRanges.end) {
            return;
        }
        const svg = d3.select(svgRef.current);

        // Clear the SVG each render
        svg.selectAll("*").remove();

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
        });

    }, [
        timeRanges,
        tasks,
        scale,
        width,
        defaults,
        snapEnabled,
        snapIncrement,
        setTasks
    ]);

    return (
        <div className="gantt-canvas">
            <svg ref={svgRef}/>
        </div>
    );
}

export default GanttCanvas;

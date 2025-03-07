import React from 'react';
import useGanttStore from "../useGanttStore.js";
import * as d3 from "d3";
import { drawHelper } from "../ganttHelpers.js";

function GanttRuler(props) {
    const timeRanges = useGanttStore(state => state.timeRanges);
    const width = useGanttStore(state => state.width);
    const defaults = useGanttStore(state => state.defaults);
    const scale = useGanttStore(state => state.scale);
    const tasks = useGanttStore(state => state.tasks);
    const svgRef = React.useRef(null);

    React.useEffect(() => {
        // Guard against invalid ranges
        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start > timeRanges.end) {
            return;
        }

        const svg = d3.select(svgRef.current);
        // Clear any previous drawing on each update.
        svg.selectAll("*").remove();

        svg.attr("width", width);
        svg.attr("height", defaults.rulerHeight);

        // Draw the time scale “ruler” ticks
        drawHelper.drawRuler(scale, svg, timeRanges, defaults, "2w");

    }, [timeRanges, tasks, width, defaults, scale]);

    return (
        <div className="gantt-ruler">
            <svg xmlns="http://www.w3.org/2000/svg" ref={svgRef} />
        </div>
    );
}

export default GanttRuler;

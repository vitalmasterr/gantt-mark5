import React from 'react';
import useGanttStore from "../useGanttStore.js";
import ganttHelpers, {drawHelper} from "../ganttHelpers.js";
import * as d3 from "d3";

function GanttCanvas(props) {
    const timeRanges = useGanttStore(state => state.timeRanges);
    const defaults = useGanttStore(state => state.defaults);
    const tasks = useGanttStore(state => state.tasks);
    const scale = useGanttStore(state => state.scale);
    const width = useGanttStore(state => state.width);

    const svgRef = React.useRef(null);

    React.useEffect(() => {
        console.log("[GanttCanvas] timeRanges changed", timeRanges);

        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start > timeRanges.end) {
            console.error("[GanttCanvas] timeRanges changed to", timeRanges);
            return;
        }

        const svg = d3.select(svgRef.current);

        svg.attr("width", width);
        svg.attr("height", defaults.rulerHeight);

        drawHelper.drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

    }, [timeRanges])

    return (
        <div className="gantt-canvas">
            <svg ref={svgRef}/>
        </div>
    );
}

export default GanttCanvas;
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import * as d3 from "d3";
import {drawHelper} from "../ganttHelpers.js";

function GanttRuler(props) {
    const timeRanges = useGanttStore(state => state.timeRanges);
    const width = useGanttStore(state => state.width);
    const defaults = useGanttStore(state => state.defaults);
    const scale = useGanttStore(state => state.scale);
    const svgRef = React.useRef(null);

    React.useEffect(() => {
        console.log("[GanttRuler] timeRanges changed", timeRanges);

        if (!timeRanges?.start || !timeRanges?.end || timeRanges.start > timeRanges.end) {
            console.error("[GanttRuler] timeRanges changed to", timeRanges);
            return;
        }

        /*        const day = 24 * 60 * 60 * 1000;
                const days = Math.ceil((timeRanges.end - timeRanges.start) / day);
                const width = defaults.columnWidth * days;
        
                const domain = [timeRanges.start, timeRanges.end];
                const range = [0, width];
                const scale = d3.scaleLinear().domain(domain).range(range);*/

        const svg = d3.select(svgRef.current);

        svg.attr("width", width);
        svg.attr("height", defaults.rulerHeight);

        drawHelper.drawRuler(scale, svg, timeRanges, defaults, "2w");

    }, [timeRanges]);

    return (
        <div className="gantt-ruler">
            <svg xmlns="http://www.w3.org/2000/svg" ref={svgRef}/>
        </div>
    );
}

export default GanttRuler;
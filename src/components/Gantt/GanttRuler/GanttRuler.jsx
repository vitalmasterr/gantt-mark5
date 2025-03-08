import React from 'react';
import useGanttStore from "../useGanttStore.js";
import * as d3 from "d3";
import drawHelper from "../drawHelper.js";


function GanttRuler() {
    const timeRanges = useGanttStore(state => state.timeRanges);
    const width = useGanttStore(state => state.width);
    const defaults = useGanttStore(state => state.defaults);
    const scale = useGanttStore(state => state.scale);
    const svgRef = React.useRef(null);

    React.useEffect(() => {
        const {start, end} = timeRanges || {};
        if (!start || !end || start >= end) {
            return;
        }
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        svg.attr("width", width);
        svg.attr("height", defaults.rulerHeight);

        drawHelper.drawRuler(scale, svg, timeRanges, defaults, "2w");

    }, [timeRanges, width, defaults, scale]);

    return (
        <div className="gantt-ruler">
            <svg xmlns="http://www.w3.org/2000/svg" ref={svgRef}/>
        </div>
    );
}

export default GanttRuler;

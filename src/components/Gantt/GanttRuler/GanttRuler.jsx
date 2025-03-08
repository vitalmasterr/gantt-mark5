// src\components\Gantt\GanttRuler\GanttRuler.jsx
import React from 'react';
import useGanttStore from "../useGanttStore.js";
import * as d3 from "d3";
import drawHelper from "../logic/drawHelper.js";

function GanttRuler() {
    const defaults    = useGanttStore(state => state.defaults);
    const scale       = useGanttStore(state => state.scale);
    const domainArray = useGanttStore(state => state.domain); // [start, end]
    const svgRef = React.useRef(null);

    React.useEffect(() => {
        if (!domainArray || domainArray.length < 2) return;
        const [start, end] = domainArray;
        if (!start || !end || start >= end) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Set <svg> dimensions to match the domain width and the ruler’s height
        const width = scale(end); // scale(end) should be the right edge
        svg.attr("width", width);
        svg.attr("height", defaults.rulerHeight);

        // Draw the top time axis (just daily marks)
        drawHelper.drawRuler(
            scale,
            svg,
            { start, end },
            defaults,
            "day" // daily increments
        );

    }, [domainArray, defaults, scale]);

    return (
        <div className="gantt-ruler">
            <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" />
        </div>
    );
}

export default GanttRuler;

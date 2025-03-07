import * as d3 from "d3";

const timeHelper = function () {

    function getStartOfDay(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        const start = new Date(date.getTime());
        start.setHours(0, 0, 0, 0);
        return start;
    }

    function getEndOfDay(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        const end = new Date(date.getTime());
        end.setHours(23, 59, 59, 999);
        return end;
    }

    function formatDate(date, format) {
        if (!(date instanceof Date)) return "";

        const day = date.getDate();
        const dayOfWeek = date.getDay();
        const month = date.getMonth();
        const year = date.getFullYear();
        const hour24 = date.getHours();
        const minute = date.getMinutes();
        const second = date.getSeconds();
        const ms = date.getMilliseconds();
        const hour12 = hour24 % 12 || 12;
        const ampm = hour24 < 12 ? "AM" : "PM";

        const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const longDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const longMonths = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        function pad(num, size) {
            const s = "0000" + num;
            return s.slice(-size);
        }

        return format.replace(
            /(yyyy|yyy|yy|y|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|fff|ff|f|tt|t)/g,
            token => {
                switch (token) {
                    // Year
                    case "yyyy":
                        return String(year);
                    case "yyy":
                        return String(year);
                    case "yy":
                        return String(year).slice(-2);
                    case "y":
                        return String(year).slice(-1);

                    // Month
                    case "MMMM":
                        return longMonths[month];
                    case "MMM":
                        return shortMonths[month];
                    case "MM":
                        return pad(month + 1, 2);
                    case "M":
                        return String(month + 1);

                    // Day
                    case "dddd":
                        return longDays[dayOfWeek];
                    case "ddd":
                        return shortDays[dayOfWeek];
                    case "dd":
                        return pad(day, 2);
                    case "d":
                        return String(day);

                    // 24-hour
                    case "HH":
                        return pad(hour24, 2);
                    case "H":
                        return String(hour24);

                    // 12-hour
                    case "hh":
                        return pad(hour12, 2);
                    case "h":
                        return String(hour12);

                    // Minute
                    case "mm":
                        return pad(minute, 2);
                    case "m":
                        return String(minute);

                    // Second
                    case "ss":
                        return pad(second, 2);
                    case "s":
                        return String(second);

                    // Fractional second
                    case "fff":
                        return pad(ms, 3);
                    case "ff":
                        return pad(Math.floor(ms / 10), 2);
                    case "f":
                        return String(Math.floor(ms / 100));

                    // AM/PM
                    case "tt":
                        return ampm;
                    case "t":
                        return ampm.charAt(0);

                    default:
                        return token;
                }
            }
        );
    }

    // Just a map for incrementing days if needed
    const incrementMap = {
        "1w": (d) => d.setDate(d.getDate() + 1),
        "2w": (d) => d.setDate(d.getDate() + 1),
    };

    return {
        formatDate,
        getStartOfDay,
        getEndOfDay,
        incrementMap,
    };
}();

const ganttHelpers = function () {

    function countTasksTimeRange(tasks) {
        if (!tasks || !tasks.length) return { start: null, end: null };
        let start = tasks[0].start;
        let end = tasks[0].end;
        tasks.forEach(task => {
            if (task.start < start) start = task.start;
            if (task.end > end) end = task.end;
        });
        return { start, end };
    }

    return { timeHelper, countTasksTimeRange };
}();

export const drawHelper = function () {

    function getTimeMarks(timeRange, mode) {
        const { start, end } = timeRange;
        const rangeStart = ganttHelpers.timeHelper.getStartOfDay(start);
        const rangeEnd = ganttHelpers.timeHelper.getEndOfDay(end);

        if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
            console.error("[getTimeMarks] Invalid range");
            return [];
        }
        const incrementFn = ganttHelpers.timeHelper.incrementMap[mode];
        if (typeof incrementFn !== "function") {
            console.error("[getTimeMarks] Unknown mode", mode);
            return [];
        }
        const marks = [];
        const current = new Date(rangeStart);
        while (current <= rangeEnd) {
            marks.push(new Date(current));
            incrementFn(current);
        }
        return marks;
    }

    function drawRuler(scale, svg, timeRanges, defaults, mode = "1w") {
        if (!scale || !svg || !timeRanges?.start || !timeRanges?.end) return;
        const halfColumnWidth = defaults.columnWidth * 0.5;
        const timeMarks = getTimeMarks(timeRanges, mode);

        const largeGroups = svg
            .selectAll(".large-mark")
            .data(timeMarks)
            .join("g")
            .attr("class", "large-mark");

        largeGroups.append("line")
            .attr("class", "ruler-line large-mark-line")
            .attr("x1", d => scale(d))
            .attr("y1", defaults.rulerHeight)
            .attr("x2", d => scale(d))
            .attr("y2", defaults.rulerHeight)
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        largeGroups.append("text")
            .attr("class", "ruler-text large-mark-text")
            .attr("x", d => scale(d) + halfColumnWidth)
            .attr("y", defaults.rulerHeight * 0.5)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-family", "Roboto")
            .text(d => timeHelper.formatDate(d, "d ddd").toUpperCase());
    }

    /**
     * Draws vertical/horizontal grid lines,
     * then for each task draws a <g.task-group> containing:
     *   - a <rect.task-bar>
     *   - a <text.task-label>
     */
    function drawCanvas(scale, svg, timeRanges, defaults, tasks, mode = "1w") {
        if (!svg || !timeRanges || !defaults) return;

        const timeMarks = getTimeMarks(timeRanges, mode);
        const width = defaults.columnWidth * timeMarks.length;
        const height = defaults.rowHeight * tasks.length;

        svg.attr("width", width);
        svg.attr("height", height);

        // GRID LINES
        const group = svg
            .selectAll(".canvas-grid")
            .data(timeMarks)
            .join("g")
            .attr("class", "canvas-grid");

        // Vertical lines
        group.append("line")
            .attr("x1", d => scale(d))
            .attr("y1", 0)
            .attr("x2", d => scale(d))
            .attr("y2", height)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        // Horizontal lines for each row (just reuse i from .data())
        group.append("line")
            .attr("x1", 0)
            .attr("y1", (d, i) => i * defaults.rowHeight)
            .attr("x2", width)
            .attr("y2", (d, i) => i * defaults.rowHeight)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        // TASK BARS + TEXT in single <g>
        const gap = 0.2 * defaults.rowHeight;

        const taskGroup = svg
            .selectAll(".task-group")
            .data(tasks)
            .join("g")
            .attr("class", "task-group");

        // The rectangular bar
        taskGroup.append("rect")
            .attr("class", "task-bar")
            // Use EXACT same scale(d.start) for x
            .attr("x", d => scale(d.start))
            .attr("y", (d, i) => i * defaults.rowHeight + gap)
            .attr("width", d => scale(d.end) - scale(d.start))
            .attr("height", defaults.rowHeight - gap * 2)
            .attr("rx", 2)
            .attr("fill", "#3497d9")
            .attr("stroke", d => d3.color("#3497d9").darker(0.5))
            .attr("stroke-width", 1)
            .style("filter", "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2))");

        // The text label
        taskGroup.append("text")
            .attr("class", d => `task-label task-label-${d.id}`)
            // Also use scale(d.start), but +10 for a left padding
            .attr("x", d => scale(d.start) + 10)
            .attr("y", (d, i) => i * defaults.rowHeight + defaults.rowHeight / 2 + 5)
            .attr("fill", "white")
            .attr("font-size", "15px")
            .attr("font-family", "Roboto")
            .attr("font-weight", 500)
            .attr("pointer-events", "none")
            .attr("filter", "drop-shadow(0px 1px 1px rgba(0,0,0,0.3))")
            .text(d => d.name);
    }

    return { drawRuler, drawCanvas };
}();

export default ganttHelpers;

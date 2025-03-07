import * as d3 from "d3";

const timeHelper = function () {

    function getStartOfDay(date) {
        // First, ensure 'date' is actually a Date object
        // and is not 'Invalid Date'.
        if (!(date instanceof Date) || isNaN(date)) {
            return null;
        }

        // We clone the date to avoid mutating the original.
        const start = new Date(date.getTime());
        start.setHours(0, 0, 0, 0);

        return start;
    }


    function getStartOfDayUTC(date) {
        if (!(date instanceof Date) || isNaN(date)) {
            return null;
        }

        const start = new Date(date.getTime());
        start.setUTCHours(0, 0, 0, 0);
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
                        return String(year); // .NET quirk
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
                        return token; // Fallback if somehow no match
                }
            }
        );
    }


    // Example usage:
    //console.log(formatDate(now, "dddd, MMMM d, yyyy h:mm:ss tt")); // "Thursday, March 6, 2025 3:05:09 PM"

    const incrementMap = {
        "1w": (d) => d.setDate(d.getDate() + 1),
        "2w": (d) => d.setDate(d.getDate() + 1),
    };

    return {
        formatDate,
        getStartOfDay,
        getStartOfDayUTC,
        getEndOfDay,
        incrementMap,
    };
}();

const ganttHelpers = function () {

    function countTasksTimeRange(tasks) {
        if (!tasks) return {start: null, end: null};
        if (!tasks.length) return {start: null, end: null};

        let start = tasks[0].start;
        let end = tasks[0].end;

        tasks.forEach(task => {
            if (task.start < start) start = task.start;
            if (task.end > end) end = task.end;
        });

        return {start, end};
    }


    return {timeHelper, countTasksTimeRange};
}();

export const drawHelper = function () {

    function getTimeMarks(timeRange, mode) {
        const {start, end} = timeRange;

        // Convert to start-of-day / end-of-day
        const rangeStart = ganttHelpers.timeHelper.getStartOfDay(start);
        const rangeEnd = ganttHelpers.timeHelper.getEndOfDay(end);

        // Validate we have a proper range
        if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
            console.error("[getTimeMarks] Invalid time range");
            return [];
        }


        // Retrieve the increment function associated with the mode.
        const incrementFn = ganttHelpers.timeHelper.incrementMap[mode];
        if (typeof incrementFn !== "function") {
            console.error("[getTimeMarks] Unknown mode", mode);
            return [];
        }

        const marks = [];
        // We'll iterate forward from rangeStart until we surpass rangeEnd
        const current = new Date(rangeStart);

        while (current <= rangeEnd) {
            // Push a clone of 'current' into the array
            marks.push(new Date(current));
            // Advance 'current' by the appropriate step
            incrementFn(current);
        }

        return marks;
    }

    function drawRuler(scale, svg, timeRanges, defaults, mode = "1w") {
        // Basic guards
        if (!scale || !svg || !mode || !defaults) return;
        if (!timeRanges?.start || !timeRanges?.end) return;

        const halfColumnWidth = defaults.columnWidth * 0.5;

        // Get arrays of ticks
        const timeMarks = getTimeMarks(timeRanges, mode);

        // Create a selection for the large marks
        // 1) Bind the array (marksLarge) to a group (.large-mark)
        // 2) Append a <line> for each datum
        // 3) Append a <text> for each datum
        const largeGroups = svg
            .selectAll(".large-mark")           // select any existing
            .data(timeMarks)                  // bind data
            .join("g")                         // handle enter/update/exit
            .attr("class", "large-mark");    // set class on the newly added groups

        // Append the “major” tick line
        largeGroups.append("line")
            .attr("class", "ruler-line large-mark-line")
            .attr("x1", d => scale(d))
            .attr("y1", defaults.rulerHeight)
            .attr("x2", d => scale(d))
            .attr("y2", defaults.rulerHeight)
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        // Append the corresponding label text
        largeGroups.append("text")
            .attr("class", "ruler-text large-mark-text")
            .attr("x", d => scale(d) + halfColumnWidth)
            .attr("y", defaults.rulerHeight * 0.5)
            // .attr("dy", "1em")
            .attr("dominant-baseline", "middle") // Add this
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-family", "Roboto")
            .text(d => ganttHelpers.timeHelper.formatDate(d, "d ddd").toUpperCase());
    }

    function utcOffset(date) {
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    }

    function drawCanvas(scale, svg, timeRanges, defaults, tasks, mode = "1w") {
        if (!svg || !timeRanges || !defaults) return;
        const timeMarks = getTimeMarks(timeRanges, mode);
        const width = defaults.columnWidth * timeMarks.length;
        const height = defaults.rowHeight * tasks.length;
        svg.attr("width", width);
        svg.attr("height", height);

        const group = svg
            .selectAll(".canvas-grid")
            .data(timeMarks)
            .join("g")
            .attr("class", "canvas-grid");

        group.append("line")
            .attr("x1", (d, i) => scale(d))
            .attr("y1", 0)
            .attr("x2", (d, i) => scale(d))
            .attr("y2", height)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        group.append("line")
            .attr("x1", 0)
            .attr("y1", (d, i) => i * defaults.rowHeight)
            .attr("x2", width)
            .attr("y2", (d, i) => i * defaults.rowHeight)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        const gap = 0.2 * defaults.rowHeight;

        const taskGroup = svg
            .selectAll(".task-group")
            .data(tasks)
            .join("g")
            .attr("class", "task-group");
        taskGroup.append("rect")
            .attr("class", "task-bar")
            .attr("x", d => scale(utcOffset(d.start)))
            .attr("y", (d, i) => i * defaults.rowHeight + gap)
            .attr("width", d => scale(utcOffset(d.end)) - scale(utcOffset(d.start)))
            .attr("height", defaults.rowHeight - gap * 2)
            .attr("rx", 2)
            // .attr("ry", 2)
            .attr("fill", "#3497d9")
            .attr("stroke", d => d3.color("#3497d9").darker(0.5))
            .attr("stroke-width", 1)
            .style("filter", "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2))");


        const taskTextGroup = svg
            .selectAll(".task-text-group")
            .data(tasks)
            .join("g")
            .attr("class", "task-text-group");

        taskTextGroup.append("text")
            .attr('class', d => `task-label task-label-${d.id}`) // Class with unique ID for updates
            .attr('x', d => scale(d.start) + 10) // 10px padding from left edge
            .attr('y', (_, i) => i * defaults.rowHeight + defaults.rowHeight / 2 + 5) // Vertically centered with slight adjustment
            .attr('fill', 'white') // White text
            .attr('font-size', '15px') // Slightly larger for readability
            .attr("font-family", "Roboto")
            .attr('font-weight', 500) // Semi-bold
            .attr('pointer-events', 'none') // Don't capture mouse events
            .text(d => d.name)
            .attr('filter', 'drop-shadow(0px 1px 1px rgba(0,0,0,0.3))') // Text shadow
    }

    return {drawRuler, drawCanvas,};
}();

export default ganttHelpers;
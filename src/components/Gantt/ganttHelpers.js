// src\components\Gantt\ganttHelpers.js
import * as d3 from "d3";

const timeHelper = (function () {

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
})();

const ganttHelpers = (function () {

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
})();

export const drawHelper = (function () {

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

        // Ruler lines + text
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

        // Horizontal lines
        group.append("line")
            .attr("x1", 0)
            .attr("y1", (d, i) => i * defaults.rowHeight)
            .attr("x2", width)
            .attr("y2", (d, i) => i * defaults.rowHeight)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        // TASK BARS + TEXT
        const gap = 0.2 * defaults.rowHeight;
        const taskGroup = svg
            .selectAll(".task-group")
            .data(tasks)
            .join("g")
            .attr("class", "task-group");

        // Rectangular bar
        taskGroup.append("rect")
            .attr("class", "task-bar")
            .attr("x", d => scale(d.start))
            .attr("y", (d, i) => i * defaults.rowHeight + gap)
            .attr("width", d => scale(d.end) - scale(d.start))
            .attr("height", defaults.rowHeight - gap * 2)
            .attr("rx", 2)
            .attr("fill", "#3497d9")
            .attr("stroke", d => d3.color("#3497d9").darker(0.5))
            .attr("stroke-width", 1)
            .style("filter", "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2))");

        // Text label
        taskGroup.append("text")
            .attr("class", d => `task-label task-label-${d.id}`)
            .attr("x", d => scale(d.start) + 10)
            .attr("y", (d, i) => i * defaults.rowHeight + (defaults.rowHeight / 2) + 5)
            .attr("fill", "white")
            .attr("font-size", "15px")
            .attr("font-family", "Roboto")
            .attr("font-weight", 500)
            .attr("pointer-events", "none")
            .attr("filter", "drop-shadow(0px 1px 1px rgba(0,0,0,0.3))")
            .text(d => d.name);
    }

    // Helper to snap a date if needed
    function maybeSnap(date, snapEnabled, snapIncrement) {
        if (!snapEnabled) return date;

        const incrementMs = snapIncrement;
        const localMidnight = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );
        const offsetFromMidnight = date.getTime() - localMidnight.getTime();
        const remainder = offsetFromMidnight % incrementMs;
        const half = incrementMs / 2;

        let snappedOffset;
        if (remainder >= half) {
            snappedOffset = offsetFromMidnight + (incrementMs - remainder);
        } else {
            snappedOffset = offsetFromMidnight - remainder;
        }
        return new Date(localMidnight.getTime() + snappedOffset);
    }

    /**
     * Draw everything in the main Gantt canvas:
     *   - Grid lines
     *   - Task bars & labels
     *   - Drag/resize behavior
     *   - Dependencies
     */
    function drawEverything({
                                svg,
                                scale,
                                timeRanges,
                                defaults,
                                tasks,
                                width,
                                snapEnabled,
                                snapIncrement,
                                setTasks,
                            }) {
        // Clear the SVG
        svg.selectAll("*").remove();

        // Set size based on tasks
        const totalHeight = defaults.rowHeight * tasks.length;
        svg.attr("width", width).attr("height", totalHeight);

        // 1) Draw the grid + tasks
        drawCanvas(scale, svg, timeRanges, defaults, tasks, "2w");

        // 2) Drag/Resize logic
        function commitChanges(d, barSelection) {
            const finalX = parseFloat(barSelection.attr("x"));
            const finalW = parseFloat(barSelection.attr("width"));

            let newStart = scale.invert(finalX);
            let newEnd = scale.invert(finalX + finalW);

            newStart = maybeSnap(newStart, snapEnabled, snapIncrement);
            newEnd = maybeSnap(newEnd, snapEnabled, snapIncrement);

            const updatedTasks = tasks.map(t =>
                t.id === d.id ? { ...t, start: newStart, end: newEnd } : t
            );
            setTasks(updatedTasks);
        }

        // Main bar drag
        const dragBar = d3.drag()
            .on("start", function (event, d) {
                d3.select(this).attr("stroke", "black");
                d.__offsetX = event.x - parseFloat(d3.select(this).attr("x"));
            })
            .on("drag", function (event, d) {
                const bar = d3.select(this);
                const rawX = event.x - d.__offsetX;

                let proposedDate = scale.invert(rawX);
                proposedDate = maybeSnap(proposedDate, snapEnabled, snapIncrement);
                const snappedX = scale(proposedDate);

                bar.attr("x", snappedX);
                d3.select(this.parentNode)
                    .select("text.task-label")
                    .attr("x", snappedX + 10);
            })
            .on("end", function (event, d) {
                d3.select(this).attr("stroke", null);
                commitChanges(d, d3.select(this));
            });

        const dragLeftHandle = d3.drag()
            .on("start", function (event, d) {
                d3.select(this.parentNode)
                    .select("rect.task-bar")
                    .attr("stroke", "black");
                d.__rightX = scale(d.end);
            })
            .on("drag", function (event, d) {
                const bar = d3.select(this.parentNode).select("rect.task-bar");
                const text = d3.select(this.parentNode).select("text.task-label");

                let rawLeftX = event.x;
                let proposedDate = scale.invert(rawLeftX);
                proposedDate = maybeSnap(proposedDate, snapEnabled, snapIncrement);
                const snappedX = scale(proposedDate);

                const w = d.__rightX - snappedX;
                if (w < 0) return;

                bar.attr("x", snappedX).attr("width", w);
                text.attr("x", snappedX + 10);
            })
            .on("end", function (event, d) {
                d3.select(this.parentNode)
                    .select("rect.task-bar")
                    .attr("stroke", null);

                const bar = d3.select(this.parentNode).select("rect.task-bar");
                commitChanges(d, bar);
            });

        const dragRightHandle = d3.drag()
            .on("start", function (event, d) {
                d3.select(this.parentNode)
                    .select("rect.task-bar")
                    .attr("stroke", "black");
                d.__leftX = scale(d.start);
            })
            .on("drag", function (event, d) {
                const bar = d3.select(this.parentNode).select("rect.task-bar");

                let rawRightX = event.x;
                let proposedDate = scale.invert(rawRightX);
                proposedDate = maybeSnap(proposedDate, snapEnabled, snapIncrement);
                const snappedRightX = scale(proposedDate);

                const newW = snappedRightX - d.__leftX;
                if (newW < 0) return;

                bar.attr("width", newW);
            })
            .on("end", function (event, d) {
                d3.select(this.parentNode)
                    .select("rect.task-bar")
                    .attr("stroke", null);

                const bar = d3.select(this.parentNode).select("rect.task-bar");
                commitChanges(d, bar);
            });

        // Attach drags
        svg.selectAll(".task-bar").call(dragBar);

        // Create invisible handles for resizing
        const handleWidth = 8;
        svg.selectAll(".task-group").each(function (d) {
            const group = d3.select(this);
            const bar = group.select("rect.task-bar");
            const x = parseFloat(bar.attr("x"));
            const w = parseFloat(bar.attr("width"));
            const y = parseFloat(bar.attr("y"));
            const h = parseFloat(bar.attr("height"));

            // Left handle
            group.append("rect")
                .attr("class", "task-handle-left")
                .attr("x", x - handleWidth / 2)
                .attr("y", y)
                .attr("width", handleWidth)
                .attr("height", h)
                .attr("fill", "transparent")
                .style("cursor", "ew-resize");

            // Right handle
            group.append("rect")
                .attr("class", "task-handle-right")
                .attr("x", x + w - handleWidth / 2)
                .attr("y", y)
                .attr("width", handleWidth)
                .attr("height", h)
                .attr("fill", "transparent")
                .style("cursor", "ew-resize");
        });

        svg.selectAll(".task-handle-left").call(dragLeftHandle);
        svg.selectAll(".task-handle-right").call(dragRightHandle);

        // 3) Dependencies
        // Define arrow marker
        let defs = svg.select("defs");
        if (!defs.size()) defs = svg.append("defs");
        defs.selectAll("#arrowhead").remove();
        defs
            .append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#555");

        // A separate layer for lines
        svg.selectAll("g.dependency-layer").remove();
        const depLayer = svg.append("g").attr("class", "dependency-layer");

        // Quick lookups
        const tasksById = new Map(tasks.map(t => [t.id, t]));

        // Build a path with short horizontal offsets + a curve
        const offset = 20;
        function getDependencyPath(sx, sy, tx, ty) {
            // We'll do an 'S'-shaped curve with small horizontal segments
            const innerStartX = sx + offset;
            const innerEndX = tx - offset;
            const midX = innerStartX + (innerEndX - innerStartX) / 2;
            return `
                M${sx},${sy}
                H${innerStartX}
                C${midX},${sy}
                 ${midX},${ty}
                 ${innerEndX},${ty}
                H${tx}
            `;
        }

        // For each task with dependencies, draw lines
        tasks.forEach((sourceTask, i) => {
            if (!Array.isArray(sourceTask.dependencies)) return;

            const sourceX = scale(sourceTask.end); // right edge
            const sourceY = i * defaults.rowHeight + defaults.rowHeight * 0.5;

            sourceTask.dependencies.forEach(dep => {
                const targetTask = tasksById.get(dep.id);
                if (!targetTask) return;

                const targetIndex = tasks.findIndex(t => t.id === dep.id);
                if (targetIndex < 0) return;

                const targetX = scale(targetTask.start); // left edge
                const targetY = targetIndex * defaults.rowHeight + defaults.rowHeight * 0.5;

                const pathData = getDependencyPath(sourceX, sourceY, targetX, targetY);

                depLayer
                    .append("path")
                    .attr("d", pathData)
                    .attr("fill", "none")
                    .attr("stroke", "#555")
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", "4 2")
                    .attr("marker-end", "url(#arrowhead)");
            });
        });
    }

    return {
        drawRuler,
        drawCanvas,
        drawEverything,
    };
})();

export default ganttHelpers;

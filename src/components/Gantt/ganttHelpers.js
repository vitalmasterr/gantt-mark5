// src/components/Gantt/ganttHelpers.js

const timeHelper = (() => {
    // Month/Day names
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const longDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const longMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Start/end of day
    function getStartOfDay(d) {
        if (!(d instanceof Date) || isNaN(d)) return null;
        const r = new Date(d);
        r.setHours(0, 0, 0, 0);
        return r;
    }

    function getEndOfDay(d) {
        if (!(d instanceof Date) || isNaN(d)) return null;
        const r = new Date(d);
        r.setHours(23, 59, 59, 999);
        return r;
    }

    // Utility
    function pad(num, size) {
        return (`0000${num}`).slice(-size);
    }

    // Custom date formatter
    function formatDate(date, format) {
        if (!(date instanceof Date)) return "";
        const y = date.getFullYear(),
            mon = date.getMonth(),
            day = date.getDate(),
            dow = date.getDay(),
            h24 = date.getHours(),
            m = date.getMinutes(),
            s = date.getSeconds(),
            ms = date.getMilliseconds(),
            h12 = h24 % 12 || 12,
            ampm = h24 < 12 ? "AM" : "PM";

        return format.replace(
            /(yyyy|yyy|yy|y|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|fff|ff|f|tt|t)/g,
            token => {
                switch (token) {
                    // Year
                    case "yyyy":
                    case "yyy":
                        return y;
                    case "yy":
                        return String(y).slice(-2);
                    case "y":
                        return String(y).slice(-1);
                    // Month
                    case "MMMM":
                        return longMonths[mon];
                    case "MMM":
                        return shortMonths[mon];
                    case "MM":
                        return pad(mon + 1, 2);
                    case "M":
                        return mon + 1;
                    // Day
                    case "dddd":
                        return longDays[dow];
                    case "ddd":
                        return shortDays[dow];
                    case "dd":
                        return pad(day, 2);
                    case "d":
                        return day;
                    // 24-hour
                    case "HH":
                        return pad(h24, 2);
                    case "H":
                        return h24;
                    // 12-hour
                    case "hh":
                        return pad(h12, 2);
                    case "h":
                        return h12;
                    // Minute
                    case "mm":
                        return pad(m, 2);
                    case "m":
                        return m;
                    // Second
                    case "ss":
                        return pad(s, 2);
                    case "s":
                        return s;
                    // Fractional second
                    case "fff":
                        return pad(ms, 3);
                    case "ff":
                        return pad(Math.floor(ms / 10), 2);
                    case "f":
                        return Math.floor(ms / 100);
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

    // Both keys increment by 1 day (per original code)
    const incrementDay = d => d.setDate(d.getDate() + 1);

    return {
        getStartOfDay,
        getEndOfDay,
        formatDate,
        incrementMap: {"1w": incrementDay, "2w": incrementDay},
    };
})();

const ganttHelpers = (() => {
    function countTasksTimeRange(tasks) {
        if (!Array.isArray(tasks) || !tasks.length) return {start: null, end: null};
        let [start, end] = [tasks[0].start, tasks[0].end];
        tasks.forEach(t => {
            if (t.start < start) start = t.start;
            if (t.end > end) end = t.end;
        });
        return {start, end};
    }

    return {timeHelper, countTasksTimeRange};
})();

export default ganttHelpers;

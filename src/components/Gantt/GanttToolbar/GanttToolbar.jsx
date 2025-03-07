// src\components\Gantt\GanttToolbar\GanttToolbar.jsx
import React from "react";
import useGanttStore from "../useGanttStore.js";

// For short month names
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Return a string like:
 *   "Apr 3 - 16, 2023"
 * or if months differ (but same year):
 *   "Apr 30 - May 2, 2023"
 * or if different years:
 *   "Dec 30, 2023 - Jan 5, 2024"
 */
function formatRangeDisplay(start, end) {
    if (!start || !end) return "";
    const startMon  = MONTHS[start.getMonth()];
    const endMon    = MONTHS[end.getMonth()];
    const startDay  = start.getDate();
    const endDay    = end.getDate();
    const startYear = start.getFullYear();
    const endYear   = end.getFullYear();

    const sameMonth = (startMon === endMon) && (startYear === endYear);
    const sameYear = (startYear === endYear);

    if (sameMonth) {
        return `${startMon} ${startDay} - ${endDay}, ${startYear}`;
    } else if (sameYear) {
        // Different months, same year
        return `${startMon} ${startDay} - ${endMon} ${endDay}, ${startYear}`;
    } else {
        // Different year
        return `${startMon} ${startDay}, ${startYear} - ${endMon} ${endDay}, ${endYear}`;
    }
}

function GanttToolbar() {
    // Read from store
    const snapEnabled = useGanttStore(state => state.snapEnabled);
    const setSnapEnabled = useGanttStore(state => state.setSnapEnabled);

    const snapIncrement = useGanttStore(state => state.snapIncrement);
    const setSnapIncrement = useGanttStore(state => state.setSnapIncrement);

    const timeRanges = useGanttStore(state => state.timeRanges);

    const rangeText = React.useMemo(() => {
        if (!timeRanges.start || !timeRanges.end) return "";
        return formatRangeDisplay(timeRanges.start, timeRanges.end);
    }, [timeRanges]);

    const handleSnapEnabledChange = () => {
        setSnapEnabled(!snapEnabled);
    };

    const handleIntervalChange = (event) => {
        const ms = Number(event.target.value);
        setSnapIncrement(ms);
    };

    return (
        <div className="gantt-upper-toolbar">
            {/* Left side: snapping config */}
            <div className="gantt-upper-toolbar-left">
                <label style={{ marginRight: "8px" }}>
                    <input
                        type="checkbox"
                        checked={snapEnabled}
                        onChange={handleSnapEnabledChange}
                    />
                    {" "}Snap
                </label>

                <select
                    value={snapIncrement}
                    onChange={handleIntervalChange}
                    disabled={!snapEnabled}
                >
                    <option value={86400000}>Day</option>      {/* 24*60*60*1000 */}
                    <option value={28800000}>8 Hours</option>  {/* 8*60*60*1000 */}
                    <option value={3600000}>1 Hour</option>    {/* 60*60*1000 */}
                </select>
            </div>

            {/* Right side: date range display */}
            <div className="gantt-upper-toolbar-right">
                {rangeText}
            </div>
        </div>
    );
}

export default GanttToolbar;

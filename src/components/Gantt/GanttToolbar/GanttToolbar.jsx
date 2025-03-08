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
    // ----- Existing store values -----
    const snapEnabled          = useGanttStore(state => state.snapEnabled);
    const setSnapEnabled       = useGanttStore(state => state.setSnapEnabled);

    const snapIncrement        = useGanttStore(state => state.snapIncrement);
    const setSnapIncrement     = useGanttStore(state => state.setSnapIncrement);

    const enforceConstraints   = useGanttStore(state => state.enforceConstraints);
    const setEnforceConstraints = useGanttStore(state => state.setEnforceConstraints);

    const timeRanges           = useGanttStore(state => state.timeRanges);

    // ----- NEW PAGINATION / TIME-SPAN SWITCH -----
    const pageMode             = useGanttStore(state => state.pageMode);
    const setPageMode          = useGanttStore(state => state.setPageMode);

    // Instead of calling it "weekSpan", now we store the actual "timeSpanDays" (7,14,30).
    const timeSpanDays         = useGanttStore(state => state.timeSpanDays);
    const setTimeSpanDays      = useGanttStore(state => state.setTimeSpanDays);

    const goPrevPage           = useGanttStore(state => state.goPrevPage);
    const goNextPage           = useGanttStore(state => state.goNextPage);

    // The final "domain" used for drawing after pagination/clamping
    const domain = useGanttStore(state => state.domain);

    // Show domain-based range text if available
    const rangeText = React.useMemo(() => {
        if (domain && domain.length === 2 && domain[0] && domain[1]) {
            return formatRangeDisplay(domain[0], domain[1]);
        }
        if (!timeRanges.start || !timeRanges.end) return "";
        return formatRangeDisplay(timeRanges.start, timeRanges.end);
    }, [domain, timeRanges]);

    const handleSnapEnabledChange = () => {
        setSnapEnabled(!snapEnabled);
    };

    const handleIntervalChange = (event) => {
        setSnapIncrement(Number(event.target.value));
    };

    const handleEnforceConstraintsChange = () => {
        setEnforceConstraints(!enforceConstraints);
    };

    const handlePageModeChange = (e) => {
        setPageMode(e.target.checked);
    };

    return (
        <div className="gantt-upper-toolbar">
            {/* Left side: snapping + constraints */}
            <div className="gantt-upper-toolbar-left">

                {/* Snap checkbox */}
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

                {/* Enforce Constraints checkbox */}
                <label style={{ marginLeft: "20px" }}>
                    <input
                        type="checkbox"
                        checked={enforceConstraints}
                        onChange={handleEnforceConstraintsChange}
                    />
                    {" "}Enforce Constraints
                </label>

                {/* ----- NEW: PAGE MODE SWITCH ----- */}
                <label style={{ marginLeft: "20px" }}>
                    <input
                        type="checkbox"
                        checked={pageMode}
                        onChange={handlePageModeChange}
                    />
                    {" "}Page Mode
                </label>

                {/* ----- NEW: TIME-SPAN SWITCH (1w, 2w, 1m) ----- */}
                {pageMode && (
                    <div style={{ marginLeft: "20px", display: "inline-flex", gap: "10px" }}>
                        <label>
                            <input
                                type="radio"
                                name="timeSpan"
                                checked={timeSpanDays === 7}
                                onChange={() => setTimeSpanDays(7)}
                            />
                            {" "}1 Week
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="timeSpan"
                                checked={timeSpanDays === 14}
                                onChange={() => setTimeSpanDays(14)}
                            />
                            {" "}2 Weeks
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="timeSpan"
                                checked={timeSpanDays === 30}
                                onChange={() => setTimeSpanDays(30)}
                            />
                            {" "}1 Month
                        </label>
                    </div>
                )}

            </div>

            {/* Right side: date range display and pagination buttons */}
            <div className="gantt-upper-toolbar-right">
                {/* If pageMode is ON, show Prev/Next buttons */}
                {pageMode && (
                    <button onClick={goPrevPage} style={{ marginRight: "10px" }}>
                        &lt;
                    </button>
                )}

                {rangeText}

                {pageMode && (
                    <button onClick={goNextPage} style={{ marginLeft: "10px" }}>
                        &gt;
                    </button>
                )}
            </div>
        </div>
    );
}

export default GanttToolbar;

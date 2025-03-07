import React from 'react';
import useGanttStore from "../Gantt/useGanttStore.js";

/**
 * parseLocalDate("YYYY-MM-DD") => Date at *local* midnight of that date
 * (ignoring time zones in the string).
 */
function parseLocalDate(ymd) {
    // e.g. "2021-06-01" => local midnight on June 1, 2021
    const [year, month, day] = ymd.split("-");
    return new Date(+year, +month - 1, +day);
}

/**
 * If you have full ISO strings with "T" and "Z" (like "2021-06-01T00:00:00Z"),
 * but want to treat them as local midnight,
 * you can do something similar: just ignore the time/zone part:
 *
 *   function parseLocalIso(iso) {
 *     // e.g. "2021-06-01T00:00:00Z" => "2021-06-01"
 *     const [datePart] = iso.split("T"); // "2021-06-01"
 *     return parseLocalDate(datePart);
 *   }
 */

function useApp() {
    const setTasks = useGanttStore(state => state.setTasks);
    const firstRender = React.useRef(true);

    React.useEffect(() => {
        if (!firstRender.current) return;
        firstRender.current = false;

        setTimeout(() => {
            // Instead of new Date("2021-06-01"), we parse *locally*:
            setTasks([
                {
                    id: 1,
                    name: "Task 1",
                    start: parseLocalDate("2021-06-01"),
                    end: parseLocalDate("2021-06-10"),
                    dependencies: [{id: 2, type: "FS"},{id: 4, type: "FS"}],
                },
                {
                    id: 2,
                    name: "Task 2",
                    start: parseLocalDate("2021-06-05"),
                    end: parseLocalDate("2021-06-15"),
                    dependencies: [{id: 3, type: "FS"}],
                },
                {
                    id: 3,
                    name: "Task 3",
                    start: parseLocalDate("2021-06-10"),
                    end: parseLocalDate("2021-06-20"),
                    dependencies: [{id: 4, type: "SS", lag: 5}],
                },
                {
                    id: 4,
                    name: "Task 4",
                    start: parseLocalDate("2021-06-15"),
                    end: parseLocalDate("2021-06-25"),
                },
            ]);
        }, 450);

    }, []);

    return {};
}

export default useApp;

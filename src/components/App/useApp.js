import React from 'react';
import useGanttStore from "../Gantt/useGanttStore.js";

/**
 * parseLocalDate("YYYY-MM-DD") => Date at local midnight
 */
function parseLocalDate(ymd) {
    const [year, month, day] = ymd.split("-");
    return new Date(+year, +month - 1, +day);
}

function useApp() {
    const setTasks = useGanttStore(state => state.setTasks);
    const firstRender = React.useRef(true);

    React.useEffect(() => {
        if (!firstRender.current) return;
        firstRender.current = false;

        // Now each task has exactly one parentId (or none).
        // Summary #10 has no 'start'/'end' => auto from children.
        // Tasks #2, #3, #5 are direct children of #10,
        // and #6 is a grandchild under #5.

        setTimeout(() => {
            setTasks([
                // A normal top-level task (no parent)
                {
                    id: 1,
                    name: "Parent Task 1",
                    start: parseLocalDate("2021-06-01"),
                    end: parseLocalDate("2021-06-10"),
                    dependencies: [{id: 2, type: "FS"}],
                },
                {
                    id: 2,
                    parentId: 1,
                    name: "Child Task 2",
                    start: parseLocalDate("2021-06-02"),
                    end: parseLocalDate("2021-06-05"),
                },
                {
                    id: 3,
                    parentId: 1,
                    name: "Child Task 3",
                    start: parseLocalDate("2021-06-06"),
                    end: parseLocalDate("2021-06-09"),
                },

                // Another normal top-level task
                {
                    id: 4,
                    name: "Parent Task 4",
                    start: parseLocalDate("2021-06-15"),
                    end: parseLocalDate("2021-06-25"),
                },
                {
                    id: 5,
                    parentId: 4,
                    name: "Child Task 5",
                    start: parseLocalDate("2021-06-15"),
                    end: parseLocalDate("2021-06-18"),
                },
                {
                    id: 6,
                    parentId: 5,
                    name: "Grandchild Task 6",
                    start: parseLocalDate("2021-06-19"),
                    end: parseLocalDate("2021-06-22"),
                },

                // This is our SUMMARY GROUP #10, top-level, no pinned start/end:
                {
                    id: 10,
                    isSummary: true,
                    name: "SUMMARY GROUP #10",
                    // No `start/end` => auto from its children
                },
                // Put #2, #3, #5 under #10 as well?
                // If you truly want them under #10, we must remove them from #1/#4.
                // Instead, let's demonstrate NEW tasks #20, #30, #50, #60 with unique IDs.
                // (If you want to show the "same" tasks, you must duplicate them with new IDs.)

                // Example duplicates with new IDs so the summary #10 has "its own" children
                // that do not conflict with #1 or #4:
                {
                    id: 20,
                    parentId: 10,
                    name: "Child Task 20 (copy of #2)",
                    start: parseLocalDate("2021-06-02"),
                    end: parseLocalDate("2021-06-05"),
                },
                {
                    id: 30,
                    parentId: 10,
                    name: "Child Task 30 (copy of #3)",
                    start: parseLocalDate("2021-06-06"),
                    end: parseLocalDate("2021-06-09"),
                },
                {
                    id: 50,
                    parentId: 10,
                    name: "Child Task 50 (copy of #5)",
                    start: parseLocalDate("2021-06-15"),
                    end: parseLocalDate("2021-06-18"),
                },
                {
                    id: 60,
                    parentId: 50,
                    name: "Grandchild Task 60 (copy of #6)",
                    start: parseLocalDate("2021-06-19"),
                    end: parseLocalDate("2021-06-22"),
                },
            ]);
        }, 450);

    }, []);

    return {};
}

export default useApp;

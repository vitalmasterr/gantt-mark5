import React from 'react';
import useGanttStore from "../Gantt/useGanttStore.js";

/**
 * parseLocalDate("YYYY-MM-DD") => Date at *local* midnight of that date
 * (ignoring time zones in the string).
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

        // Example hierarchy using parentId:
        //    1
        //    ├─ 2
        //    └─ 3
        //    4
        //    └─ 5
        //       └─ 6
        setTimeout(() => {
            setTasks([
                {
                    id: 1,
                    name: "Parent Task 1",
                    start: parseLocalDate("2021-06-01"),
                    end: parseLocalDate("2021-06-10"),
                    dependencies: [{id: 2, type: "FS"}, {id: 2, type: "FS"}],
                },
                {
                    id: 2,
                    parentId: 1,
                    name: "Child Task 2",
                    start: parseLocalDate("2021-06-02"),
                    end: parseLocalDate("2021-06-05"),
                    dependencies: [{id: 5, type: "FS"}],
                },
                {
                    id: 3,
                    parentId: 1,
                    name: "Child Task 3",
                    start: parseLocalDate("2021-06-06"),
                    end: parseLocalDate("2021-06-09"),
                },
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
            ]);
        }, 450);

    }, []);

    return {};
}

export default useApp;

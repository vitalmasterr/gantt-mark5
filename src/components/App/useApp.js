import React from 'react';
import useGanttStore from "../Gantt/useGanttStore.js";

function useApp(props) {


    const setTasks = useGanttStore(state => state.setTasks);
    const firstRender = React.useRef(true);

    React.useEffect(() => {
        if (!firstRender.current) return;
        firstRender.current = false;

        setTimeout(() => {
            setTasks([{
                id: 1,
                name: "Task 1",
                start: new Date("2021-06-01"),
                end: new Date("2021-06-10"),
            },
                {
                    id: 2,
                    name: "Task 2",
                    start: new Date("2021-06-05"),
                    end: new Date("2021-06-15"),
                },
                {
                    id: 3,
                    name: "Task 3",
                    start: new Date("2021-06-10"),
                    end: new Date("2021-06-20"),
                },
                {
                    id: 4,
                    name: "Task 4",
                    start: new Date("2021-06-15"),
                    end: new Date("2021-06-25"),
                }]);
        }, 450);


    }, []);

    return {};
}

export default useApp;
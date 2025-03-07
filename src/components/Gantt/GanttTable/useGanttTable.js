import React, {useEffect} from 'react';
import useGanttStore from "../useGanttStore.js";

function useGanttTable(props) {

    const tasks = useGanttStore(state => state.tasks);

    useEffect(() => {
        console.log("[useGanttTable] tasks changed", tasks);
    }, [tasks]);

    return {tasks};
}

export default useGanttTable;
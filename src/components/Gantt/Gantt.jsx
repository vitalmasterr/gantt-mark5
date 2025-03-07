import React from 'react';
import useGanttStore from "./useGanttStore.js";
import useGantt from "./useGantt.js";
import GanttTable from "./GanttTable/GanttTable.jsx";
import GanttRuler from "./GanttRuler/GanttRuler.jsx";
import GanttCanvas from "./GanttCanvas/GanttCanvas.jsx";
import GanttEmpty from "./GanttDialog/GanttEmpty.jsx";
import GanttToolbar from "./GanttToolbar/GanttToolbar.jsx";

function Gantt() {
    // IMPORTANT: now we read the “visibleTasks” from the store
    const tasks = useGanttStore(state => state.visibleTasks);
    // We still use the `ganttContainerRef` hook to track size
    const { ganttContainerRef } = useGantt();

    if (!(tasks?.length > 0)) {
        return <GanttEmpty />;
    }

    return (
        <>
            <GanttToolbar />
            <div className="gantt-container" ref={ganttContainerRef}>
                <div className="gantt-container-left">
                    <GanttTable />
                </div>
                <div className="gantt-container-right">
                    <div className="gantt-container-right-top">
                        <GanttRuler />
                    </div>
                    <div className="gantt-container-right-bottom">
                        <GanttCanvas />
                    </div>
                </div>
            </div>
        </>
    );
}

export default Gantt;

import React from 'react';
import GanttTable from "./GanttTable/GanttTable.jsx";
import GanttRuler from "./GanttRuler/GanttRuler.jsx";
import GanttCanvas from "./GanttCanvas/GanttCanvas.jsx";
import GanttEmpty from "./GanttDialog/GanttEmpty.jsx";
import useGantt from "./useGantt.js";
import GanttToolbar from "./GanttToolbar/GanttToolbar.jsx";

function Gantt(props) {

    const {tasks, ganttContainerRef} = useGantt(props);

    if (!(tasks?.length > 0)) return <GanttEmpty/>;

    return (
        <>
            <GanttToolbar/>
            <div className="gantt-container" ref={ganttContainerRef}>
                <div className="gantt-container-left">
                    <GanttTable/>
                </div>
                <div className="gantt-container-right">
                    <div className="gantt-container-right-top">
                        <GanttRuler/>
                    </div>
                    <div className="gantt-container-right-bottom">
                        <GanttCanvas/>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Gantt;
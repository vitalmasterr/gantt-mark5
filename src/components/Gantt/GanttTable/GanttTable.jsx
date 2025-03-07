import React from 'react';
import useGanttTable from "./useGanttTable.js";
import ganttHelpers from "../ganttHelpers.js";

function GanttTable(props) {

    const {tasks} = useGanttTable(props);

    console.log({tasks});

    return (
        <div className="gantt-table">
            <table>
                <thead>
                <tr>
                    <th>TASK</th>
                    <th>START</th>
                    <th>END</th>
                </tr>
                </thead>
                <tbody>
                {tasks?.map && tasks.map((task, i) => (
                    <tr key={i}>
                        <td>{task.name}</td>
                        <td>{ganttHelpers.timeHelper.formatDate(task?.start, "dd.MM.yy")}</td>
                        <td>{ganttHelpers.timeHelper.formatDate(task?.end, "dd.MM.yy")}</td>
                    </tr>
                ))}


                </tbody>
            </table>
        </div>
    );
}

export default GanttTable;
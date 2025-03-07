import React from 'react';
import useGanttStore from "../useGanttStore.js";
import ganttHelpers from "../ganttHelpers.js";

function GanttTable() {
    const tasks = useGanttStore(state => state.visibleTasks);
    const toggleCollapse = useGanttStore(state => state.toggleCollapse);
    const collapsed = useGanttStore(state => state.collapsed);

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
                {tasks?.map((task) => {
                    const indentStyle = {paddingLeft: (task.level * 20) + "px"};

                    return (
                        <tr key={task.id}>
                            <td className="gantt-table-tasktd">
                                <div style={indentStyle} className="gantt-table-task">
                                    {/* If task.hasChildren, show a toggle icon */}
                                    {task.hasChildren ? (
                                        <span
                                            className="gantt-table-task-expand"
                                            onClick={() => toggleCollapse(task.id)}
                                            style={{cursor: "pointer", marginRight: "6px"}}>
                                            {collapsed[task.id] ? "▸" : "▾"}
                                        </span>
                                    ) : null}
                                    <div className="gantt-table-task-name">
                                        {task.name}
                                    </div>
                                </div>
                            </td>
                            <td>{ganttHelpers.timeHelper.formatDate(task.start, "dd.MM.yy")}</td>
                            <td>{ganttHelpers.timeHelper.formatDate(task.end, "dd.MM.yy")}</td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
}

export default GanttTable;

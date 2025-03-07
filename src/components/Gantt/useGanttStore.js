import {create} from "zustand";
import ganttHelpers from "./ganttHelpers.js";
import * as d3 from "d3";

const useGanttStore = create((set, get) => ({
    tasks: [],
    timeRanges: {start: null, end: null},
    scale: null,
    width: 0,
    days: 0,
    defaults: {
        rowHeight: 50,
        rulerHeight: 50,
        columnWidth: 100,
    },
    size: {width: 0, height: 0},
    setTasks: (tasks) => {
        const timeRanges = ganttHelpers.countTasksTimeRange(tasks);
        get().updateScale(timeRanges);
        set({tasks, timeRanges});
    },
    setSize: (size) => {
        const currentSize = get().size;
        if (currentSize?.width === size?.width && currentSize?.height === size?.height) return;
        set({size})
    },
    updateScale: (timeRanges) => {
        const defaults = get().defaults;
        const day = 24 * 60 * 60 * 1000;
        const days = Math.ceil((timeRanges.end - timeRanges.start) / day);
        const width = defaults.columnWidth * days;

        const domain = [timeRanges.start, timeRanges.end];
        const range = [0, width];
        const scale = d3.scaleLinear().domain(domain).range(range);
        set({scale, width, days, domain});
    },
}));


export default useGanttStore;
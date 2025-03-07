// src\components\Gantt\useGanttStore.js
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

    // 1) Add snapping configuration:
    snapEnabled: true,
    snapIncrement: 24 * 60 * 60 * 1000, // default: 1 day in ms
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    setSnapIncrement: (ms) => set({ snapIncrement: ms }),

    setTasks: (tasks) => {
        const timeRanges = ganttHelpers.countTasksTimeRange(tasks);
        get().updateScale(timeRanges);
        set({tasks, timeRanges});
    },

    setSize: (size) => {
        const currentSize = get().size;
        if (currentSize?.width === size?.width && currentSize?.height === size?.height) return;
        set({size});
    },

    updateScale: (timeRanges) => {
        const defaults = get().defaults;

        // Calculate total days spanned by tasks
        const day = 24 * 60 * 60 * 1000;
        const days = Math.ceil((timeRanges.end - timeRanges.start) / day);

        // The total pixel width if each day is a column
        const width = defaults.columnWidth * days;

        // Use d3.scaleTime
        const domain = [timeRanges.start, timeRanges.end];
        const range = [0, width];
        const scale = d3.scaleTime().domain(domain).range(range);

        set({scale, width, days, domain});
    },
}));

export default useGanttStore;

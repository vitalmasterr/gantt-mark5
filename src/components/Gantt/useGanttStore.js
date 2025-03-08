// src\components\Gantt\useGanttStore.js
import {create} from "zustand";
import * as d3 from "d3";

/**
 * Build a tree from an array of tasks that may have "parentId".
 * Returns an array of top-level tasks (each might have .children[]).
 */
function buildTree(tasks) {
    const byId = new Map();
    tasks.forEach(t => byId.set(t.id, {...t, children: []}));

    // Link children to parents:
    tasks.forEach(t => {
        if (t.parentId && byId.has(t.parentId)) {
            byId.get(t.parentId).children.push(byId.get(t.id));
        }
    });

    // Return only top-level tasks (those without parentId):
    return Array.from(byId.values()).filter(t => !t.parentId);
}

/**
 * Flatten the tree into an array, skipping children of any collapsed node.
 * Also track nesting level so we can indent in the table.
 */
function buildVisibleTasks(tree, collapsedMap, level = 0) {
    const result = [];
    for (const node of tree) {
        // Add the node itself
        const hasChildren = node.children?.length > 0;
        result.push({
            ...node,
            level,
            hasChildren
        });
        // If it’s collapsed, skip its children
        if (hasChildren && !collapsedMap[node.id]) {
            const sub = buildVisibleTasks(node.children, collapsedMap, level + 1);
            result.push(...sub);
        }
    }
    return result;
}

/**
 * Count time range over all tasks in a list.
 */
function computeTimeRange(tasks) {
    if (!tasks || !tasks.length) return {start: null, end: null};
    let [start, end] = [tasks[0].start, tasks[0].end];
    tasks.forEach(t => {
        if (t.start < start) start = t.start;
        if (t.end > end) end = t.end;
    });
    return {start, end};
}

/**
 * Helper to clamp a date within [min, max].
 */
function clampDate(date, min, max) {
    if (date < min) return new Date(min);
    if (date > max) return new Date(max);
    return date;
}

/**
 * Return a "window start" that includes "today" if it's inside [rangeStart, rangeEnd].
 * Otherwise just return the tasks rangeStart.
 */
function getInitialVisibleStart(rangeStart, rangeEnd) {
    const today = new Date();
    if (today >= rangeStart && today <= rangeEnd) {
        return new Date(today);
    }
    return new Date(rangeStart);
}

/**
 * Add 'days' to a date (positive or negative).
 */
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

const useGanttStore = create((set, get) => ({
    // Raw tasks from setTasks()
    rawTasks: [],
    // Tree form
    treeTasks: [],
    // Flattened (and possibly filtered by collapsed parents)
    visibleTasks: [],
    // For collapsing: { [taskId]: true/false }
    collapsed: {},

    // Current time range for all tasks (full min->max)
    timeRanges: {start: null, end: null},

    // The scale for the *visible domain*
    scale: null,

    // The total width if we used the entire tasks range
    width: 0,

    // The total days in the entire tasks range
    days: 0,

    // The actual domain used for drawing (may be entire or just a slice)
    domain: null,

    // Container size
    size: {width: 0, height: 0},

    // Some defaults
    defaults: {
        rowHeight: 50,
        rulerHeight: 50,
        columnWidth: 100,
    },

    // Snapping config
    snapEnabled: true,
    snapIncrement: 24 * 60 * 60 * 1000, // 1 day in ms
    setSnapEnabled: (enabled) => set({snapEnabled: enabled}),
    setSnapIncrement: (ms) => set({snapIncrement: ms}),

    // Constraints toggle
    enforceConstraints: false,
    setEnforceConstraints: (flag) => set({enforceConstraints: flag}),

    // --- NEW PAGINATION ----
    pageMode: false,         // whether pagination is on/off
    timeSpanDays: 7,         // 7=1w, 14=2w, 30=1m
    visibleStart: null,      // left boundary of the visible window
    visibleEnd: null,        // right boundary of the visible window

    setPageMode: (on) => {
        set({pageMode: on});
        get().rebuildAll();
    },

    setTimeSpanDays: (days) => {
        set({timeSpanDays: days});
        if (get().pageMode) {
            const state = get();
            if (state.visibleStart && state.timeRanges.start) {
                // shift visibleEnd to be visibleStart + timeSpanDays
                const newEnd = addDays(state.visibleStart, days);
                set({visibleEnd: clampDate(newEnd, state.timeRanges.start, state.timeRanges.end)});
            }
            state.rebuildAll();
        }
    },

    // Called once tasks are loaded or changed, it rebuilds everything
    rebuildAll: (newRawTasks) => {
        const state = get();

        // If we got a new tasks array, store it
        if (Array.isArray(newRawTasks)) {
            state.rawTasks = newRawTasks;
        }

        // Build tree
        const tree = buildTree(state.rawTasks);

        // Build visible tasks
        const visible = buildVisibleTasks(tree, state.collapsed);

        // Compute overall time range (min->max of all tasks)
        const rng = computeTimeRange(visible);

        // Also store that in state
        state.timeRanges = rng;

        // Calculate the total (entire) number of days
        const dayMs = 24 * 60 * 60 * 1000;
        let totalDays = 0;
        let start = rng.start, end = rng.end;
        if (start && end && start < end) {
            totalDays = Math.ceil((end - start) / dayMs);
        }

        // By default, domain is the entire range
        let finalStart = start;
        let finalEnd = end;

        // If page mode is on, use visibleStart/visibleEnd
        if (state.pageMode && start && end) {
            // If not set yet, init the visible window so it includes "today" if possible
            if (!state.visibleStart || !state.visibleEnd) {
                const vs = getInitialVisibleStart(start, end);
                const ve = addDays(vs, state.timeSpanDays);
                set({
                    visibleStart: clampDate(vs, start, end),
                    visibleEnd: clampDate(ve, start, end),
                });
            }

            // Now recalc with the store’s current visibleStart/visibleEnd
            const vs2 = clampDate(state.visibleStart, start, end);
            const ve2 = clampDate(state.visibleEnd, start, end);

            if (vs2 >= ve2) {
                // Force at least 1 day
                set({
                    visibleEnd: addDays(vs2, 1),
                });
            }

            finalStart = get().visibleStart;
            finalEnd = get().visibleEnd;
        }

        // Now compute the "width" for that final domain
        let scale = null;
        let domain = null;
        let width = 0;
        if (finalStart && finalEnd && finalStart < finalEnd) {
            const numDays = Math.ceil((finalEnd - finalStart) / dayMs);
            width = state.defaults.columnWidth * numDays;
            domain = [finalStart, finalEnd];
            scale = d3.scaleTime().domain(domain).range([0, width]);
        }

        // Update store
        set({
            treeTasks: tree,
            visibleTasks: visible,
            timeRanges: rng,
            scale,
            width,
            days: totalDays,
            domain,
        });
    },

    setTasks: (tasks) => {
        set(() => {
            return {rawTasks: tasks};
        });
        get().rebuildAll(tasks);
    },

    toggleCollapse: (taskId) => {
        const was = !!get().collapsed[taskId];
        const newCollapsed = {...get().collapsed, [taskId]: !was};
        set({collapsed: newCollapsed});
        get().rebuildAll();
    },

    setSize: (size) => {
        const current = get().size;
        if (current?.width === size?.width && current?.height === size?.height) return;
        set({size});
    },

    // ----- SHIFT VISIBLE WINDOW: move by timeSpanDays each time -----
    goPrevPage: () => {
        const state = get();
        if (!state.pageMode || !state.visibleStart) return;
        const {start} = state.timeRanges;
        let newStart = addDays(state.visibleStart, -state.timeSpanDays);
        newStart = clampDate(newStart, start, state.timeRanges.end);

        const newEnd = addDays(newStart, state.timeSpanDays);
        set({
            visibleStart: newStart,
            visibleEnd: clampDate(newEnd, start, state.timeRanges.end)
        });
        state.rebuildAll();
    },

    goNextPage: () => {
        const state = get();
        if (!state.pageMode || !state.visibleStart) return;
        const {end} = state.timeRanges;
        let newStart = addDays(state.visibleStart, state.timeSpanDays);
        newStart = clampDate(newStart, state.timeRanges.start, end);

        const newEnd = addDays(newStart, state.timeSpanDays);
        set({
            visibleStart: newStart,
            visibleEnd: clampDate(newEnd, state.timeRanges.start, end)
        });
        state.rebuildAll();
    },

}));

export default useGanttStore;

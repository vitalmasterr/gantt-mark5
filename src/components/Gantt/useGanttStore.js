// src\components\Gantt\useGanttStore.js
import {create} from "zustand";
import ganttHelpers from "./ganttHelpers.js";
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
    if (!tasks || !tasks.length) return { start: null, end: null };
    let [start, end] = [tasks[0].start, tasks[0].end];
    tasks.forEach(t => {
        if (t.start < start) start = t.start;
        if (t.end > end) end = t.end;
    });
    return { start, end };
}

const useGanttStore = create((set, get) => ({
    // Raw tasks from setTasks()
    rawTasks: [],
    // Tree form
    treeTasks: [],
    // Flattened (and possibly filtered by collapsed parents)
    visibleTasks: [],
    // For collapsing: { [taskId]: true/false }
    // if 'true' => that node is collapsed; children won't appear in visibleTasks
    collapsed: {},

    // Current time range for visible tasks
    timeRanges: {start: null, end: null},
    scale: null,
    width: 0,
    days: 0,
    domain: null,
    size: {width: 0, height: 0},

    defaults: {
        rowHeight: 50,
        rulerHeight: 50,
        columnWidth: 100,
    },

    // Snapping config
    snapEnabled: true,
    snapIncrement: 24 * 60 * 60 * 1000, // 1 day in ms
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    setSnapIncrement: (ms) => set({ snapIncrement: ms }),

    /**
     * Rebuild entire store state after tasks or collapsed states change.
     */
    rebuildAll: (newRawTasks) => {
        const state = get();
        const collapsedMap = state.collapsed;
        // If we got a new array, store it:
        if (Array.isArray(newRawTasks)) {
            state.rawTasks = newRawTasks;
        }
        // Rebuild tree
        const tree = buildTree(state.rawTasks);
        // Rebuild visible
        const visible = buildVisibleTasks(tree, collapsedMap);
        // Compute time range
        const rng = computeTimeRange(visible);
        // Compute scale
        const defaults = state.defaults;
        const day = 24*60*60*1000;
        const start = rng.start, end = rng.end;
        let scale = null, totalDays = 0, domain = null, width = 0;
        if (start && end && start < end) {
            totalDays = Math.ceil((end - start) / day);
            width = defaults.columnWidth * totalDays;
            domain = [start, end];
            scale = d3.scaleTime().domain(domain).range([0, width]);
        }

        set({
            treeTasks: tree,
            visibleTasks: visible,
            timeRanges: rng,
            scale,
            width,
            days: totalDays,
            domain
        });
    },

    /**
     * Set tasks from outside
     */
    setTasks: (tasks) => {
        set(() => {
            return { rawTasks: tasks };
        });
        get().rebuildAll(tasks);
    },

    /**
     * Toggle collapsed state of a task
     */
    toggleCollapse: (taskId) => {
        const state = get();
        const was = !!state.collapsed[taskId];
        const newCollapsed = {...state.collapsed, [taskId]: !was};
        set({collapsed: newCollapsed});
        // Rebuild everything with new collapsed states:
        get().rebuildAll();
    },

    /**
     * Set the size of the container
     */
    setSize: (size) => {
        const current = get().size;
        if (current?.width === size?.width && current?.height === size?.height) return;
        set({size});
    },

}));

export default useGanttStore;

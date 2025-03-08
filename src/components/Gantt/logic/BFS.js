// src/components/Gantt/BFS.js

/**
 * This module handles building adjacency maps and performing BFS traversals
 * to propagate constraints *via* BFS, but without direct references to D3 or the DOM.
 *
 * It imports constraint functions and applies them as part of the BFS logic.
 */

import {
    applyAllParentConstraints,
    applyChildConstraintsToParent
} from "./constraints.js";

/**
 * Build an adjacency map indicating "downstream" children of a given task.
 * Key = parentTaskId, Value = array of { id: childTaskId, type: depType }
 */
export function buildDownstreamMap(tasks) {
    const map = {};
    for (const child of tasks) {
        if (!Array.isArray(child.dependencies)) continue;
        for (const dep of child.dependencies) {
            if (!map[dep.id]) map[dep.id] = [];
            map[dep.id].push({ id: child.id, type: dep.type });
        }
    }
    return map;
}

/**
 * Build an adjacency map indicating "upstream" parents of a given task.
 * Key = childTaskId, Value = array of { id: parentTaskId, type: depType }
 */
export function buildUpstreamMap(tasks) {
    const map = {};
    for (const child of tasks) {
        if (!Array.isArray(child.dependencies)) continue;
        for (const dep of child.dependencies) {
            if (!map[child.id]) map[child.id] = [];
            map[child.id].push({ id: dep.id, type: dep.type });
        }
    }
    return map;
}

/**
 * Collect all downstream tasks for a given startId.
 */
export function collectDownstream(startId, downstreamMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (downstreamMap[cur]) {
            for (const c of downstreamMap[cur]) {
                if (!visited.has(c.id)) {
                    queue.push(c.id);
                }
            }
        }
    }
    return visited;
}

/**
 * Collect all upstream tasks for a given startId.
 */
export function collectUpstream(startId, upstreamMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (upstreamMap[cur]) {
            for (const p of upstreamMap[cur]) {
                if (!visited.has(p.id)) {
                    queue.push(p.id);
                }
            }
        }
    }
    return visited;
}

/**
 * Standard BFS recalc: shift children if needed, by applying parent constraints.
 */
export function recalcDownstreamBFS(changedId, ephemeralMap, downstreamMap) {
    const queue = [changedId];
    while (queue.length) {
        const parentId = queue.shift();
        const children = downstreamMap[parentId] || [];
        for (const { id: childId } of children) {
            const child = ephemeralMap.get(childId);
            if (!child) continue;
            const changed = applyAllParentConstraints(child, ephemeralMap);
            if (changed) {
                queue.push(childId);
            }
        }
    }
}

/**
 * BFS recalc upstream: shift parents if the child is forcing constraints in reverse.
 */
export function recalcUpstreamBFS(changedId, ephemeralMap, upstreamMap) {
    const queue = [changedId];
    while (queue.length) {
        const childId = queue.shift();
        const parents = upstreamMap[childId] || [];
        for (const { id: parentId } of parents) {
            const parent = ephemeralMap.get(parentId);
            if (!parent) continue;
            const changed = applyChildConstraintsToParent(parent, ephemeralMap);
            if (changed) {
                queue.push(parentId);
            }
        }
    }
}

/**
 * A helper that runs both downstream and upstream BFS recalc.
 */
export function doTwoWayBFS(changedId, ephemeralMap, downstreamMap, upstreamMap) {
    recalcDownstreamBFS(changedId, ephemeralMap, downstreamMap);
    recalcUpstreamBFS(changedId, ephemeralMap, upstreamMap);
}

// src/components/Gantt/constraints.js

/**
 * This module handles all snapping and constraint-application logic
 * (including clamping modes) without referencing D3/DOM.
 * It's purely data transformations.
 */

/**
 * Child constraints => parent can be forced left (for BFS "reverse" recalc).
 */
export function applyChildConstraintsToParent(parent, ephemeralMap) {
    // gather all children that rely on this parent
    const children = [];
    ephemeralMap.forEach(t => {
        if (!Array.isArray(t.dependencies)) return;
        if (t.dependencies.some(dep => dep.id === parent.id)) {
            children.push(t);
        }
    });

    let changed = false;
    let ps = parent.start.getTime();
    let pe = parent.end.getTime();

    for (const c of children) {
        const cs = c.start.getTime();
        const ce = c.end.getTime();
        for (const dep of c.dependencies || []) {
            if (dep.id !== parent.id) continue;

            // normal FS => c.start >= p.end => reversed => p.end <= c.start
            if (dep.type === "FS") {
                if (pe > cs) {
                    const delta = pe - cs;
                    pe -= delta;
                    ps -= delta;
                    changed = true;
                }
            }
            else if (dep.type === "SS") {
                // c.start >= p.start => p.start <= c.start
                if (ps > cs) {
                    const delta = ps - cs;
                    ps -= delta;
                    pe -= delta;
                    changed = true;
                }
            }
            else if (dep.type === "FF") {
                // c.end >= p.end => p.end <= c.end
                if (pe > ce) {
                    const delta = pe - ce;
                    pe -= delta;
                    ps -= delta;
                    changed = true;
                }
            }
            else if (dep.type === "SF") {
                // c.end >= p.start => p.start <= c.end
                if (ps > ce) {
                    const delta = ps - ce;
                    ps -= delta;
                    pe -= delta;
                    changed = true;
                }
            }
        }
    }

    if (changed) {
        parent.start = new Date(ps);
        parent.end   = new Date(pe);
    }
    return changed;
}

/**
 * For a child with multiple parents, shift it if needed by applying parent constraints.
 */
export function applyAllParentConstraints(child, ephemeralMap) {
    if (!child.dependencies) return false;
    let changed = false;
    let s = child.start.getTime();
    let e = child.end.getTime();

    for (const dep of child.dependencies) {
        const parent = ephemeralMap.get(dep.id);
        if (!parent) continue;
        const ps = parent.start.getTime();
        const pe = parent.end.getTime();

        if (dep.type === "FS") {
            // child.start >= parent.end
            if (s < pe) {
                const delta = pe - s;
                s += delta;
                e += delta;
                changed = true;
            }
        }
        else if (dep.type === "SS") {
            // child.start >= parent.start
            if (s < ps) {
                const delta = ps - s;
                s += delta;
                e += delta;
                changed = true;
            }
        }
        else if (dep.type === "FF") {
            // child.end >= parent.end
            if (e < pe) {
                const delta = pe - e;
                s += delta;
                e += delta;
                changed = true;
            }
        }
        else if (dep.type === "SF") {
            // child.end >= parent.start
            if (e < ps) {
                const delta = ps - e;
                s += delta;
                e += delta;
                changed = true;
            }
        }
    }

    if (changed) {
        child.start = new Date(s);
        child.end   = new Date(e);
    }
    return changed;
}

/**
 * Snap a date to the nearest increment (if snap is on).
 */
export function maybeSnap(date, snap, inc) {
    if (!snap) return date;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offsetMs = date.getTime() - dayStart.getTime();
    const remainder = offsetMs % inc;
    const half = inc / 2;
    const corrected = (remainder >= half)
        ? offsetMs + (inc - remainder)
        : offsetMs - remainder;
    return new Date(dayStart.getTime() + corrected);
}

/**
 * The core "clamp" logic used in "Enforce Constraints" mode:
 *   - mode="move": shift the entire bar if constraints are violated
 *   - mode="left": clamp only the start edge
 *   - mode="right": clamp only the end edge
 */
export function clampTaskToConstraints(task, ephemeralMap, downstreamMap, upstreamMap, mode) {
    // We'll do repeated passes until stable so we handle multiple constraints
    let stable = false;
    while (!stable) {
        stable = true;
        const oldS = task.start.getTime();
        const oldE = task.end.getTime();

        // 1) clamp against parents
        if (Array.isArray(task.dependencies)) {
            for (const dep of task.dependencies) {
                const parent = ephemeralMap.get(dep.id);
                if (!parent) continue;

                const ps = parent.start.getTime();
                const pe = parent.end.getTime();

                if (dep.type === "FS") {
                    // child.start >= parent.end
                    if (task.start < pe) {
                        if (mode === "move") {
                            const shift = pe - task.start.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "left") {
                            task.start = new Date(pe);
                        }
                    }
                }
                else if (dep.type === "SS") {
                    // child.start >= parent.start
                    if (task.start < ps) {
                        if (mode === "move") {
                            const shift = ps - task.start.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "left") {
                            task.start = new Date(ps);
                        }
                    }
                }
                else if (dep.type === "FF") {
                    // child.end >= parent.end
                    if (task.end < pe) {
                        if (mode === "move") {
                            const shift = pe - task.end.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "right") {
                            task.end = new Date(pe);
                        }
                    }
                }
                else if (dep.type === "SF") {
                    // child.end >= parent.start
                    if (task.end < ps) {
                        if (mode === "move") {
                            const shift = ps - task.end.getTime();
                            task.start = new Date(task.start.getTime() + shift);
                            task.end   = new Date(task.end.getTime() + shift);
                        }
                        else if (mode === "right") {
                            task.end = new Date(ps);
                        }
                    }
                }
            }
        }

        // 2) clamp against children (inverse constraints)
        const children = downstreamMap[task.id] || [];
        for (const cinfo of children) {
            const child = ephemeralMap.get(cinfo.id);
            if (!child) continue;
            const cs = child.start.getTime();
            const ce = child.end.getTime();

            if (cinfo.type === "FS") {
                // parent's end <= child's start
                if (task.end.getTime() > cs) {
                    if (mode === "move") {
                        const delta = task.end.getTime() - cs;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "right") {
                        task.end = new Date(cs);
                    }
                }
            }
            else if (cinfo.type === "SS") {
                // parent's start <= child's start
                if (task.start.getTime() > cs) {
                    if (mode === "move") {
                        const delta = task.start.getTime() - cs;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "left") {
                        task.start = new Date(cs);
                    }
                }
            }
            else if (cinfo.type === "FF") {
                // parent's end <= child's end
                if (task.end.getTime() > ce) {
                    if (mode === "move") {
                        const delta = task.end.getTime() - ce;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "right") {
                        task.end = new Date(ce);
                    }
                }
            }
            else if (cinfo.type === "SF") {
                // parent's start <= child's end
                if (task.start.getTime() > ce) {
                    if (mode === "move") {
                        const delta = task.start.getTime() - ce;
                        task.start = new Date(task.start.getTime() - delta);
                        task.end   = new Date(task.end.getTime() - delta);
                    }
                    else if (mode === "left") {
                        task.start = new Date(ce);
                    }
                }
            }
        }

        const newS = task.start.getTime();
        const newE = task.end.getTime();
        if (newS !== oldS || newE !== oldE) {
            stable = false;
        }
    }
}

/**
 * Merge ephemeral changes back into the original tasks array.
 */
export function mergeEphemeral(tasks, ephemeralMap) {
    return tasks.map(t => ephemeralMap.get(t.id) || t);
}

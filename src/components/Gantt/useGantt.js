import React from 'react';
import useGanttStore from './useGanttStore.js';


function useGantt(props) {

    const setSize = useGanttStore(state => state.setSize);
    const tasks = useGanttStore((state) => state.tasks);

    const [containerEl, setContainerEl] = React.useState(null);

    const ganttContainerRef = React.useCallback((node) => {
        if (node !== null) {
            setContainerEl(node);
        }
    }, []);

    const resizeTimerIdRef = React.useRef(null);

    React.useEffect(() => {
        if (!containerEl) return;

        const handleResize = (entry) => {
            const {width, height} = entry.contentRect;

            // Debounce:
            // 1) Clear any pending timer.
            // 2) Set a new timer for e.g. 200ms later.
            clearTimeout(resizeTimerIdRef.current);
            resizeTimerIdRef.current = setTimeout(() => {
                // console.log('[useGantt] debounced resize', {width, height});
                setSize({width, height});
                // ... any other logic goes here ...
            }, 200);
        };

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === containerEl) {
                    handleResize(entry);
                }
            }
        });

        resizeObserver.observe(containerEl);

        return () => {
            // On cleanup, clear the pending timer as well as the observer
            clearTimeout(resizeTimerIdRef.current);
            resizeObserver.unobserve(containerEl);
            resizeObserver.disconnect();
        };
    }, [containerEl]);


    return {tasks, ganttContainerRef};
}

export default useGantt;

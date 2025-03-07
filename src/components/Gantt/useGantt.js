import React from 'react';
import useGanttStore from './useGanttStore.js';

function useGantt() {
    const setSize = useGanttStore(state => state.setSize);

    const [containerEl, setContainerEl] = React.useState(null);
    const ganttContainerRef = React.useCallback((node) => {
        if (node) {
            setContainerEl(node);
        }
    }, []);

    const resizeTimerIdRef = React.useRef(null);

    React.useEffect(() => {
        if (!containerEl) return;

        const handleResize = (entry) => {
            const { width, height } = entry.contentRect;
            // Debounce
            clearTimeout(resizeTimerIdRef.current);
            resizeTimerIdRef.current = setTimeout(() => {
                setSize({ width, height });
            }, 200);
        };

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === containerEl) {
                    handleResize(entry);
                }
            }
        });

        observer.observe(containerEl);
        return () => {
            clearTimeout(resizeTimerIdRef.current);
            observer.unobserve(containerEl);
            observer.disconnect();
        };
    }, [containerEl]);

    return { ganttContainerRef };
}

export default useGantt;

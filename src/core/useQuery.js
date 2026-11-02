import { useCallback, useEffect, useState } from 'react';
/** Kleine hulp om gegevens te laden: { data, error, loading, reload } */
export function useQuery(fn, deps) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    const reload = useCallback(() => setTick((t) => t + 1), []);
    useEffect(() => {
        let alive = true;
        setLoading(true);
        Promise.resolve(fn()).then((r) => {
            if (!alive)
                return;
            setData(r.data);
            setError(r.error ? r.error.message : null);
            setLoading(false);
        });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, tick]);
    return { data, error, loading, reload };
}

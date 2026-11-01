import { useCallback, useEffect, useRef, useState } from 'react';
import { socialApi } from '../api';
import type { FeedFilters, PageMeta, PostCard } from '../types';
import { socialError } from '../utils';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';

export function useFeed(filters: FeedFilters) {
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const cursor = useRef<PageMeta | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const key = JSON.stringify(filters);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useVisibilityRefresh(refresh);
  useEffect(() => {
    const current = ++generation.current;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    pending.current = true; cursor.current = null;
    setPosts([]); setMeta(null); setLoading(true); setError('');
    void socialApi.feed(JSON.parse(key), 1, undefined, controller.signal).then(result => {
      if (current !== generation.current) return;
      setPosts(result.data); cursor.current = result.meta; setMeta(result.meta);
    }).catch(reason => { if (current === generation.current && !controller.signal.aborted) setError(socialError(reason)); })
      .finally(() => { if (current === generation.current) { pending.current = false; setLoading(false); } });
    return () => { controller.abort(); generation.current = current + 1; };
  }, [key, revision]);
  const more = async () => {
    const previous = cursor.current;
    if (pending.current || !previous || previous.page >= previous.totalPages) return;
    const current = generation.current; pending.current = true; setLoading(true); setError('');
    const controller = new AbortController(); abort.current = controller;
    try {
      const result = await socialApi.feed(JSON.parse(key), previous.page + 1, previous.asOf, controller.signal);
      if (current !== generation.current) return;
      setPosts(rows => [...new Map([...rows, ...result.data].map(post => [post.id, post])).values()]);
      cursor.current = result.meta; setMeta(result.meta);
    } catch (reason) { if (current === generation.current && !controller.signal.aborted) setError(socialError(reason)); }
    finally { if (current === generation.current) { pending.current = false; setLoading(false); } }
  };
  return { posts, meta, loading, error, refresh, more, replace: (post: PostCard) => setPosts(rows => rows.map(row => row.id === post.id ? post : row)), remove: (id: number) => setPosts(rows => rows.filter(row => row.id !== id)) };
}

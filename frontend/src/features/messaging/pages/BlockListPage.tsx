import { ArrowLeft, Search, ShieldBan, ShieldCheck } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagingAvatar } from '../components/MessagingUi';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { messagingApi } from '../services/messaging-api';
import { messagingErrorMessage } from '../utils/messages';
import type { BlockItem, PlayerDisplay } from '../types/messaging.types';

export const BlockListPage: React.FC = () => {
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerDisplay[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await messagingApi.listBlocks();
      setBlocks(list);
    } catch (err) {
      setError(messagingErrorMessage(err, 'Không thể tải danh sách chặn'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    try {
      const results = await messagingApi.searchPlayers(searchQuery.trim(), 20);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleBlock = async (playerId: number) => {
    setBusyPlayerId(playerId);
    setError(null);
    try {
      await messagingApi.blockPlayer(playerId);
      setSearchResults((prev) => prev.filter((p) => p.id !== playerId));
      await loadBlocks();
    } catch (err) {
      setError(messagingErrorMessage(err, 'Không thể chặn người chơi này'));
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleUnblock = async (playerId: number) => {
    setBusyPlayerId(playerId);
    setError(null);
    try {
      await messagingApi.unblockPlayer(playerId);
      setBlocks((prev) => prev.filter((b) => b.playerId !== playerId));
    } catch (err) {
      setError(messagingErrorMessage(err, 'Không thể bỏ chặn người chơi này'));
    } finally {
      setBusyPlayerId(null);
    }
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Danh sách người chơi đã chặn"
        description="Người chơi bị chặn sẽ không thể gửi tin nhắn 1-1 mới hoặc gửi lời mời ghép trận cho bạn."
        actions={
          <Button asChild variant="outline">
            <Link to="/messages">
              <ArrowLeft aria-hidden="true" />
              Quay lại Tin nhắn
            </Link>
          </Button>
        }
      />
      {error && (
        <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <Button type="button" variant="ghost" onClick={() => setError(null)}>
            Đóng
          </Button>
        </Alert>
      )}
      <ContentPanel title="Chặn người chơi mới" icon={ShieldBan}>
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
          <Input
            className="min-w-40 flex-1"
            type="text"
            aria-label="Nhập tên người chơi cần tìm"
            placeholder="Nhập tên người chơi cần tìm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="submit" disabled={searching}>
            <Search aria-hidden="true" />
            {searching ? 'Đang tìm...' : 'Tìm kiếm'}
          </Button>
        </form>
        {searchResults.length > 0 && (
          <ul className="space-y-2">
            {searchResults.map((p) => (
              <li
                key={p.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <MessagingAvatar name={p.fullName} />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold">{p.fullName}</span>
                    {p.skillLevel && (
                      <span className="block text-xs text-muted-foreground">{p.skillLevel.name}</span>
                    )}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="danger-soft"
                  disabled={busyPlayerId === p.id}
                  onClick={() => handleBlock(p.id)}
                >
                  Chặn
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ContentPanel>
      <ContentPanel title={`Đang chặn (${blocks.length})`} icon={ShieldCheck}>
        {loading ? (
          <div role="status" className="space-y-2">
            <p className="text-sm text-muted-foreground">Đang tải danh sách...</p>
            <Skeleton className="h-20 w-full" />
          </div>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bạn chưa chặn người chơi nào.</p>
        ) : (
          <ul className="space-y-3">
            {blocks.map((item) => (
              <li
                key={item.playerId}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <MessagingAvatar name={item.fullName} avatarUrl={item.avatarUrl} />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold">{item.fullName}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Đã chặn lúc {new Date(item.blockedAt).toLocaleString('vi-VN')}
                    </span>
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyPlayerId === item.playerId}
                  onClick={() => handleUnblock(item.playerId)}
                >
                  Bỏ chặn
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ContentPanel>
    </PageContainer>
  );
};

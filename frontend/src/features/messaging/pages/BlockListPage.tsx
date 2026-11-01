import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { messagingApi } from '../services/messaging-api';
import type { BlockItem, PlayerDisplay } from '../types/messaging.types';
import '../messaging.css';

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
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách chặn');
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
      setError(err instanceof ApiError ? err.message : 'Không thể chặn người chơi này');
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
      setError(err instanceof ApiError ? err.message : 'Không thể bỏ chặn người chơi này');
    } finally {
      setBusyPlayerId(null);
    }
  };

  return (
    <div style={{ maxWidth: 840, width: '100%', margin: '0 auto', padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#131B2E' }}>
            Danh sách người chơi đã chặn
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#505F76' }}>
            Người chơi bị chặn sẽ không thể gửi tin nhắn 1-1 mới hoặc gửi lời mời ghép trận cho bạn.
          </p>
        </div>
        <Link to="/messages" className="msg-btn">
          ← Quay lại Tin nhắn
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="msg-banner error"
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <span>{error}</span>
          <button type="button" className="msg-btn" onClick={() => setError(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* Search & Block a player */}
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(189, 202, 186, 0.45)',
          borderRadius: 14,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#131B2E' }}>
          Chặn người chơi mới
        </h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="msg-search-input"
            placeholder="Nhập tên người chơi cần tìm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="msg-btn msg-btn-primary" disabled={searching}>
            {searching ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchResults.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#FAF8FF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="msg-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                    {p.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#131B2E' }}>
                      {p.fullName}
                    </div>
                    {p.skillLevel && (
                      <div style={{ fontSize: 11.5, color: '#505F76' }}>{p.skillLevel.name}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="msg-btn msg-btn-danger"
                  disabled={busyPlayerId === p.id}
                  onClick={() => handleBlock(p.id)}
                >
                  Chặn
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Current blocked list */}
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(189, 202, 186, 0.45)',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#131B2E' }}>
          Đang chặn ({blocks.length})
        </h2>

        {loading ? (
          <p style={{ color: '#505F76', fontSize: 14 }}>Đang tải danh sách...</p>
        ) : blocks.length === 0 ? (
          <p style={{ color: '#505F76', fontSize: 14, margin: 0 }}>
            Bạn chưa chặn người chơi nào.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blocks.map((item) => (
              <div
                key={item.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(189, 202, 186, 0.35)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt={item.fullName}
                      className="msg-avatar"
                      style={{ width: 38, height: 38 }}
                    />
                  ) : (
                    <div className="msg-avatar" style={{ width: 38, height: 38 }}>
                      {item.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#131B2E' }}>
                      {item.fullName}
                    </div>
                    <div style={{ fontSize: 12, color: '#505F76' }}>
                      Đã chặn lúc {new Date(item.blockedAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="msg-btn"
                  disabled={busyPlayerId === item.playerId}
                  onClick={() => handleUnblock(item.playerId)}
                >
                  Bỏ chặn
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};


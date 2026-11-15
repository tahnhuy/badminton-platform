import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { formatVnd, walletApi } from '../services/wallet-api';
import type {
  PayoutStatus,
  TopUpInitiation,
  WalletBankAccount,
  WalletPayoutRequest,
  WalletSnapshot,
} from '../types';
import '../wallet.css';

type WalletTab = 'TOP_UP' | 'WITHDRAW' | 'ACCOUNTS';

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

const PAYOUT_LABELS: Record<PayoutStatus, string> = {
  PENDING: 'Chờ Admin duyệt',
  APPROVED: 'Đã duyệt - chờ chuyển khoản',
  REJECTED: 'Bị từ chối',
  PAID: 'Đã chuyển khoản',
  FAILED: 'Thất bại',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { hour12: false });
}

export function WalletPage() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [bankAccounts, setBankAccounts] = useState<WalletBankAccount[]>([]);
  const [payouts, setPayouts] = useState<WalletPayoutRequest[]>([]);
  const [tab, setTab] = useState<WalletTab>('TOP_UP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [amount, setAmount] = useState('50000');
  const [topUp, setTopUp] = useState<TopUpInitiation | null>(null);
  const [creatingTopUp, setCreatingTopUp] = useState(false);
  const topUpBaseline = useRef(0);

  const [withdrawAmount, setWithdrawAmount] = useState('50000');
  const [selectedBankId, setSelectedBankId] = useState<number | ''>('');
  const [creatingWithdrawal, setCreatingWithdrawal] = useState(false);

  const [bankCode, setBankCode] = useState('MBBank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextWallet, nextBanks, nextPayouts] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getBankAccounts(),
        walletApi.getPayouts(),
      ]);
      setWallet(nextWallet);
      setBankAccounts(nextBanks);
      setPayouts(nextPayouts);
      setSelectedBankId(current => current || nextBanks[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tải thông tin ví.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topUpId = topUp?.topUpId ?? null;
  const topUpStatus = topUp?.status ?? null;
  const topUpIsMock = topUp?.isMock ?? false;

  useEffect(() => {
    if (topUpId === null || topUpStatus !== 'PENDING' || topUpIsMock) return;
    const startingBalance = topUpBaseline.current;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const next = await walletApi.getWallet();
        if (cancelled) return;
        setWallet(next);
        if (Number(next.balance) > startingBalance) {
          setTopUp(current => current ? { ...current, status: 'SUCCESS' } : current);
          setNotice('Đã nhận được thanh toán. Số dư ví đã được cập nhật.');
        }
      } catch {
        // Keep polling; transient network errors should not discard the QR.
      }
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [topUpId, topUpStatus, topUpIsMock]);

  const selectedBank = useMemo(
    () => bankAccounts.find(account => account.id === selectedBankId) ?? null,
    [bankAccounts, selectedBankId],
  );

  const createTopUp = async () => {
    setCreatingTopUp(true);
    setError(null);
    setNotice(null);
    try {
      const result = await walletApi.createTopUp(amount);
      topUpBaseline.current = Number(wallet?.balance ?? 0);
      setTopUp(result);
      if (result.status === 'SUCCESS') {
        setNotice('Top-up đã hoàn tất.');
        await load();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo mã nạp ví.');
    } finally {
      setCreatingTopUp(false);
    }
  };

  const confirmMockTopUp = async () => {
    if (!topUp) return;
    try {
      const result = await walletApi.mockConfirmTopUp(topUp.topUpId);
      setWallet(result.wallet);
      setTopUp(current => current ? { ...current, status: 'SUCCESS' } : current);
      setNotice('Đã xác nhận thanh toán thử.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể xác nhận thanh toán thử.');
    }
  };

  const createWithdrawal = async () => {
    if (!selectedBankId) {
      setError('Bạn cần thêm tài khoản nhận tiền trước.');
      setTab('ACCOUNTS');
      return;
    }
    setCreatingWithdrawal(true);
    setError(null);
    setNotice(null);
    try {
      const request = await walletApi.createWithdrawal({
        amount: withdrawAmount,
        bankAccountId: Number(selectedBankId),
      });
      setPayouts(current => [request, ...current]);
      setWallet(await walletApi.getWallet());
      setNotice(request.status === 'APPROVED'
        ? 'Yêu cầu đã được duyệt tự động (sandbox). Dùng SePay Test mode mô phỏng giao dịch tiền ra với nội dung PAYOUT-' + request.id + '.'
        : 'Đã gửi yêu cầu rút tiền. Admin sẽ duyệt và chuyển khoản thủ công.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo yêu cầu rút tiền.');
    } finally {
      setCreatingWithdrawal(false);
    }
  };

  const saveBankAccount = async () => {
    setSavingBank(true);
    setError(null);
    try {
      const account = await walletApi.createBankAccount({
        bankCode: bankCode.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        isDefault: bankAccounts.length === 0,
      });
      setBankAccounts(current => [...current, account]);
      setSelectedBankId(account.id);
      setAccountNumber('');
      setAccountName('');
      setNotice('Đã thêm tài khoản nhận tiền.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể thêm tài khoản nhận tiền.');
    } finally {
      setSavingBank(false);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`Đã copy ${label}.`);
    } catch {
      setError('Không thể copy. Vui lòng chọn và copy thủ công.');
    }
  };

  if (loading) {
    return <div className="wallet-page"><div className="wallet-state">Đang tải ví…</div></div>;
  }

  return (
    <div className="wallet-page">
      <header className="wallet-header">
        <div>
          <p className="wallet-eyebrow">SMASHPRO WALLET</p>
          <h1>Ví của tôi</h1>
          <p>Nạp tiền qua VietQR, thanh toán booking bằng số dư và gửi yêu cầu rút tiền.</p>
        </div>
        <button type="button" className="wallet-secondary" onClick={() => void load()}>Làm mới</button>
      </header>

      {error && <div className="wallet-alert wallet-alert-error" role="alert">{error}</div>}
      {notice && <div className="wallet-alert wallet-alert-success" role="status">{notice}</div>}

      <section className="wallet-balance-grid" aria-label="Số dư ví">
        <article className="wallet-balance-card wallet-balance-main">
          <span>Số dư khả dụng</span>
          <strong>{formatVnd(wallet?.available ?? 0)}</strong>
          <p>Tổng số dư: {formatVnd(wallet?.balance ?? 0)}</p>
        </article>
        <article className="wallet-balance-card">
          <span>Đang giữ</span>
          <strong>{formatVnd(wallet?.held ?? 0)}</strong>
          <p>Cho yêu cầu rút tiền đang chờ xử lý</p>
        </article>
        <article className="wallet-balance-card">
          <span>Cập nhật gần nhất</span>
          <strong className="wallet-date">{formatDate(wallet?.updatedAt ?? null)}</strong>
          <p>Dữ liệu ví lấy trực tiếp từ hệ thống</p>
        </article>
      </section>

      <nav className="wallet-tabs" aria-label="Ví">
        <button type="button" className={tab === 'TOP_UP' ? 'active' : ''} onClick={() => setTab('TOP_UP')}>Nạp tiền</button>
        <button type="button" className={tab === 'WITHDRAW' ? 'active' : ''} onClick={() => setTab('WITHDRAW')}>Rút tiền</button>
        <button type="button" className={tab === 'ACCOUNTS' ? 'active' : ''} onClick={() => setTab('ACCOUNTS')}>Tài khoản nhận</button>
      </nav>

      {tab === 'TOP_UP' && (
        <section className="wallet-panel">
          <div className="wallet-panel-main">
            <h2>Nạp tiền vào ví</h2>
            <p className="wallet-muted">Nhập số tiền, hệ thống tạo mã VietQR và nội dung chuyển khoản riêng.</p>
            <label className="wallet-field">
              <span>Số tiền</span>
              <input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="50000" />
            </label>
            <div className="wallet-quick-amounts">
              {QUICK_AMOUNTS.map(value => (
                <button key={value} type="button" onClick={() => setAmount(String(value))}>{formatVnd(value)}</button>
              ))}
            </div>
            <button type="button" className="wallet-primary" onClick={() => void createTopUp()} disabled={creatingTopUp || !Number(amount)}>
              {creatingTopUp ? 'Đang tạo mã…' : 'Tạo mã nạp tiền'}
            </button>

            {topUp && (
              <div className="wallet-topup-result">
                <div className="wallet-topup-head">
                  <div>
                    <span className={`wallet-status wallet-status-${topUp.status.toLowerCase()}`}>{topUp.status}</span>
                    <h3>{formatVnd(topUp.amount)}</h3>
                  </div>
                  {topUp.status === 'SUCCESS' && <strong className="wallet-success-text">Đã cộng ví</strong>}
                </div>

                {topUp.status === 'PENDING' && topUp.qrUrl && (
                  <div className="wallet-qr-grid">
                    <img src={topUp.qrUrl} alt="Mã VietQR nạp ví" className="wallet-qr" />
                    <dl className="wallet-bank-info">
                      <div><dt>Ngân hàng</dt><dd>{topUp.bankCode}</dd></div>
                      <div><dt>Số tài khoản</dt><dd>{topUp.accountNumber}</dd></div>
                      <div><dt>Chủ tài khoản</dt><dd>{topUp.accountName}</dd></div>
                      <div><dt>Số tiền</dt><dd>{formatVnd(topUp.amount)}</dd></div>
                      <div className="wallet-content-row">
                        <dt>Nội dung CK</dt>
                        <dd><code>{topUp.transferContent}</code><button type="button" onClick={() => void copy(topUp.transferContent ?? '', 'nội dung chuyển khoản')}>Copy</button></dd>
                      </div>
                    </dl>
                  </div>
                )}

                {topUp.status === 'PENDING' && (
                  <p className="wallet-muted">
                    Đang chờ thanh toán. Nếu dùng SePay Test mode, mở SePay → Mô phỏng giao dịch với đúng số tiền và nội dung trên.
                  </p>
                )}
                {topUp.isMock && topUp.status === 'PENDING' && (
                  <button type="button" className="wallet-secondary" onClick={() => void confirmMockTopUp()}>Xác nhận thanh toán thử</button>
                )}
              </div>
            )}
          </div>
          <aside className="wallet-panel-aside">
            <h3>Lưu ý</h3>
            <ul>
              <li>Chuyển đúng số tiền và nội dung để hệ thống tự động cộng ví.</li>
              <li>Không sửa nội dung chuyển khoản.</li>
              <li>Ví được cập nhật trong vài giây sau khi ngân hàng báo có.</li>
              <li>Mọi giao dịch đều có lịch sử trong hệ thống.</li>
            </ul>
          </aside>
        </section>
      )}

      {tab === 'WITHDRAW' && (
        <section className="wallet-grid-2">
          <div className="wallet-panel">
            <h2>Yêu cầu rút tiền</h2>
            <p className="wallet-muted">Số tiền sẽ được giữ lại cho đến khi Admin duyệt và chuyển khoản thủ công.</p>
            <label className="wallet-field">
              <span>Số tiền rút</span>
              <input inputMode="numeric" value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="50000" />
            </label>
            <label className="wallet-field">
              <span>Tài khoản nhận</span>
              <select value={selectedBankId} onChange={event => setSelectedBankId(Number(event.target.value) || '')}>
                <option value="">Chọn tài khoản</option>
                {bankAccounts.map(account => (
                  <option key={account.id} value={account.id}>{account.bankCode} · {account.accountNumber} · {account.accountName}</option>
                ))}
              </select>
            </label>
            {selectedBank && <p className="wallet-muted">Nhận về: {selectedBank.accountName} · {selectedBank.bankCode} · {selectedBank.accountNumber}</p>}
            <button type="button" className="wallet-primary" onClick={() => void createWithdrawal()} disabled={creatingWithdrawal || !Number(withdrawAmount)}>
              {creatingWithdrawal ? 'Đang gửi…' : 'Gửi yêu cầu rút'}
            </button>
            {bankAccounts.length === 0 && (
              <button type="button" className="wallet-link-button" onClick={() => setTab('ACCOUNTS')}>Thêm tài khoản nhận tiền</button>
            )}
          </div>

          <div className="wallet-panel">
            <h2>Lịch sử yêu cầu</h2>
            {payouts.length === 0 ? <p className="wallet-muted">Chưa có yêu cầu rút tiền.</p> : (
              <div className="wallet-list">
                {payouts.map(request => (
                  <article key={request.id} className="wallet-list-item">
                    <div>
                      <strong>{formatVnd(request.amount)}</strong>
                      <p>{formatDate(request.requestedAt)}</p>
                      <p>Nội dung CK: <code>PAYOUT-{request.id}</code></p>
                    </div>
                    <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>{PAYOUT_LABELS[request.status]}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'ACCOUNTS' && (
        <section className="wallet-grid-2">
          <div className="wallet-panel">
            <h2>Thêm tài khoản nhận tiền</h2>
            <label className="wallet-field">
              <span>Mã ngân hàng</span>
              <input value={bankCode} onChange={event => setBankCode(event.target.value)} placeholder="MBBank" />
            </label>
            <label className="wallet-field">
              <span>Số tài khoản</span>
              <input value={accountNumber} onChange={event => setAccountNumber(event.target.value)} placeholder="0123456789" />
            </label>
            <label className="wallet-field">
              <span>Tên chủ tài khoản</span>
              <input value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="NGUYEN VAN A" />
            </label>
            <button type="button" className="wallet-primary" onClick={() => void saveBankAccount()} disabled={savingBank || !accountNumber.trim() || !accountName.trim()}>
              {savingBank ? 'Đang lưu…' : 'Thêm tài khoản'}
            </button>
          </div>

          <div className="wallet-panel">
            <h2>Tài khoản đã lưu</h2>
            {bankAccounts.length === 0 ? <p className="wallet-muted">Chưa có tài khoản nhận tiền.</p> : (
              <div className="wallet-list">
                {bankAccounts.map(account => (
                  <article key={account.id} className="wallet-list-item">
                    <div>
                      <strong>{account.bankCode} · {account.accountNumber}</strong>
                      <p>{account.accountName}</p>
                    </div>
                    {account.isDefault && <span className="wallet-status wallet-status-success">Mặc định</span>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

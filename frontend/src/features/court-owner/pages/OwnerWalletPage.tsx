import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { formatVnd, walletApi } from '../../wallet/services/wallet-api';
import type { PayoutStatus, WalletBankAccount, WalletPayoutRequest, WalletSnapshot } from '../../wallet/types';
import '../../wallet/wallet.css';

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

export function payoutTransferContent(payoutId: number): string {
  return `PAYOUT-${payoutId}`;
}

export function OwnerWalletPage() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [bankAccounts, setBankAccounts] = useState<WalletBankAccount[]>([]);
  const [payouts, setPayouts] = useState<WalletPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const selectedBank = useMemo(
    () => bankAccounts.find(account => account.id === selectedBankId) ?? null,
    [bankAccounts, selectedBankId],
  );

  const createWithdrawal = async () => {
    if (!selectedBankId) {
      setError('Bạn cần thêm tài khoản nhận tiền trước.');
      return;
    }
    setCreatingWithdrawal(true);
    setError(null);
    setNotice(null);
    try {
      const request = await walletApi.createOwnerPayout({
        amount: withdrawAmount,
        bankAccountId: Number(selectedBankId),
      });
      setPayouts(current => [request, ...current]);
      setWallet(await walletApi.getWallet());
      setNotice(`Đã tạo yêu cầu #${request.id}. Nội dung chuyển khoản: ${payoutTransferContent(request.id)} (${request.status === 'APPROVED' ? 'đã tự duyệt' : 'chờ Admin duyệt'}).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo yêu cầu rút tiền.');
    } finally {
      setCreatingWithdrawal(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`Đã copy ${label}.`);
    } catch {
      setError('Không thể copy. Vui lòng chọn và copy thủ công.');
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

  if (loading) {
    return <div className="wallet-state">Đang tải ví chủ sân…</div>;
  }

  return (
    <div className="wallet-page">
      <header className="wallet-header">
        <div>
          <p className="wallet-eyebrow">SMASHPRO OWNER WALLET</p>
          <h1>Ví &amp; thu nhập</h1>
          <p>Doanh thu booking hoàn tất được cộng vào ví. Tạo yêu cầu rút để Admin chuyển khoản.</p>
        </div>
        <button type="button" className="wallet-secondary" onClick={() => void load()}>Làm mới</button>
      </header>

      {error && <div className="wallet-alert wallet-alert-error" role="alert">{error}</div>}
      {notice && <div className="wallet-alert wallet-alert-success" role="status">{notice}</div>}

      <section className="wallet-balance-grid" aria-label="Số dư ví chủ sân">
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

      <section className="wallet-panel">
        <h2>Rút doanh thu</h2>
        <p className="wallet-muted">
          Số tiền rút sẽ được giữ trong ví đến khi Admin duyệt và đánh dấu đã chuyển khoản.
          Mỗi yêu cầu có nội dung chuyển khoản riêng dạng <code>PAYOUT-&lt;id&gt;</code> để
          đối soát/webhook.
        </p>
        <label className="wallet-field">
          <span>Số tiền rút</span>
          <input
            inputMode="numeric"
            value={withdrawAmount}
            onChange={event => setWithdrawAmount(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="50000"
          />
        </label>
        <label className="wallet-field">
          <span>Tài khoản nhận tiền</span>
          <select value={selectedBankId} onChange={event => setSelectedBankId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">Chọn tài khoản</option>
            {bankAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.bankCode} · {account.accountNumber} · {account.accountName}
              </option>
            ))}
          </select>
        </label>
        {selectedBank && (
          <p className="wallet-muted">
            Sẽ chuyển tới {selectedBank.bankCode} · {selectedBank.accountNumber} · {selectedBank.accountName}
          </p>
        )}
        <button
          type="button"
          className="wallet-primary"
          onClick={() => void createWithdrawal()}
          disabled={creatingWithdrawal || !Number(withdrawAmount) || !selectedBankId}
        >
          {creatingWithdrawal ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}
        </button>
      </section>

      <section className="wallet-panel">
        <h2>Tài khoản nhận tiền</h2>
        {bankAccounts.length === 0 && <p className="wallet-muted">Chưa có tài khoản nhận tiền.</p>}
        <ul className="wallet-bank-list">
          {bankAccounts.map(account => (
            <li key={account.id}>
              <strong>{account.bankCode}</strong>
              <span>{account.accountNumber}</span>
              <span>{account.accountName}</span>
              {account.isDefault && <em>Mặc định</em>}
            </li>
          ))}
        </ul>
        <div className="wallet-bank-form">
          <label className="wallet-field">
            <span>Ngân hàng</span>
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
          <button
            type="button"
            className="wallet-secondary"
            onClick={() => void saveBankAccount()}
            disabled={savingBank || !bankCode.trim() || !accountNumber.trim() || !accountName.trim()}
          >
            {savingBank ? 'Đang lưu…' : 'Thêm tài khoản'}
          </button>
        </div>
      </section>

      <section className="wallet-panel">
        <h2>Lịch sử yêu cầu rút</h2>
        {payouts.length === 0 && <p className="wallet-muted">Chưa có yêu cầu rút tiền.</p>}
        {payouts.length > 0 && (
          <div className="wallet-table-wrap">
            <table className="wallet-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nội dung chuyển khoản</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Tạo lúc</th>
                  <th>Đã chuyển</th>
                  <th>Ghi chú Admin</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(row => (
                  <tr key={row.id}>
                    <td>#{row.id}</td>
                    <td>
                      <span className="wallet-code">{payoutTransferContent(row.id)}</span>
                      <button type="button" className="wallet-copy" onClick={() => void copyText(payoutTransferContent(row.id), 'nội dung chuyển khoản')}>Copy</button>
                    </td>
                    <td><strong>{formatVnd(row.amount)}</strong></td>
                    <td>{PAYOUT_LABELS[row.status]}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>{formatDate(row.paidAt)}</td>
                    <td>{row.adminNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

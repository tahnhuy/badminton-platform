import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { formatVnd, walletApi } from '../../wallet/services/wallet-api';
import type { PayoutStatus, WalletBankAccount, WalletPayoutRequest, WalletSnapshot } from '../../wallet/types';

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
    return <div className="wallet-state rounded-2xl bg-card p-10 text-center text-muted-foreground">Đang tải ví chủ sân…</div>;
  }

  return (
    <div className="wallet-page mx-auto flex w-full max-w-300 flex-col gap-5 px-3.5 pt-5 pb-12 font-sans text-foreground sm:px-6 sm:pt-8 sm:pb-16">
      <header className="wallet-header flex flex-wrap items-end justify-between gap-4 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:tracking-tight sm:[&_h1]:text-3xl [&_p]:mt-1 [&_p]:text-sm [&_p]:leading-5 [&_p]:text-muted-foreground">
        <div>
          <p className="wallet-eyebrow mb-1 text-2xs font-extrabold tracking-widest text-primary">SMASHPRO OWNER WALLET</p>
          <h1>Ví &amp; thu nhập</h1>
          <p>Doanh thu booking hoàn tất được cộng vào ví. Tạo yêu cầu rút để Admin chuyển khoản.</p>
        </div>
        <button type="button" className="wallet-secondary rounded-lg bg-secondary px-4.5 py-3 text-sm font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void load()}>Làm mới</button>
      </header>

      {error && <div className="wallet-alert rounded-lg px-4 py-3 text-sm leading-5 wallet-alert-error border border-destructive/20 bg-destructive/10 text-destructive" role="alert">{error}</div>}
      {notice && <div className="wallet-alert rounded-lg px-4 py-3 text-sm leading-5 wallet-alert-success border border-primary/20 bg-primary/10 text-primary" role="status">{notice}</div>}

      <section className="wallet-balance-grid grid grid-cols-1 gap-3.5 min-[901px]:grid-cols-[1.4fr_1fr_1fr]" aria-label="Số dư ví chủ sân">
        <article className="wallet-balance-card min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm [&_span]:block [&_span]:text-xs [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_span]:uppercase [&_strong]:mt-2 [&_strong]:block [&_strong]:text-2xl [&_strong]:leading-8 [&_strong]:tracking-tight [&_strong]:wrap-anywhere [&_p]:mt-1.5 [&_p]:text-xs [&_p]:leading-5 [&_p]:text-muted-foreground wallet-balance-main border-transparent bg-primary text-primary-foreground [&_span]:text-primary-foreground/80 [&_p]:text-primary-foreground/80">
          <span>Số dư khả dụng</span>
          <strong>{formatVnd(wallet?.available ?? 0)}</strong>
          <p>Tổng số dư: {formatVnd(wallet?.balance ?? 0)}</p>
        </article>
        <article className="wallet-balance-card min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm [&_span]:block [&_span]:text-xs [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_span]:uppercase [&_strong]:mt-2 [&_strong]:block [&_strong]:text-2xl [&_strong]:leading-8 [&_strong]:tracking-tight [&_strong]:wrap-anywhere [&_p]:mt-1.5 [&_p]:text-xs [&_p]:leading-5 [&_p]:text-muted-foreground">
          <span>Đang giữ</span>
          <strong>{formatVnd(wallet?.held ?? 0)}</strong>
          <p>Cho yêu cầu rút tiền đang chờ xử lý</p>
        </article>
        <article className="wallet-balance-card min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm [&_span]:block [&_span]:text-xs [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_span]:uppercase [&_strong]:mt-2 [&_strong]:block [&_strong]:text-2xl [&_strong]:leading-8 [&_strong]:tracking-tight [&_strong]:wrap-anywhere [&_p]:mt-1.5 [&_p]:text-xs [&_p]:leading-5 [&_p]:text-muted-foreground">
          <span>Cập nhật gần nhất</span>
          <strong className="wallet-date text-sm! leading-5!">{formatDate(wallet?.updatedAt ?? null)}</strong>
          <p>Dữ liệu ví lấy trực tiếp từ hệ thống</p>
        </article>
      </section>

      <section className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
        <h2>Rút doanh thu</h2>
        <p className="wallet-muted mb-4 text-xs leading-5 text-muted-foreground">
          Số tiền rút sẽ được giữ trong ví đến khi Admin duyệt và đánh dấu đã chuyển khoản.
          Mỗi yêu cầu có nội dung chuyển khoản riêng dạng <code>PAYOUT-&lt;id&gt;</code> để
          đối soát/webhook.
        </p>
        <label className="wallet-field mb-3.5 flex flex-col gap-2 text-xs font-semibold">
          <span>Số tiền rút</span>
          <Input className="h-11 bg-card text-sm"
            inputMode="numeric"
            value={withdrawAmount}
            onChange={event => setWithdrawAmount(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="50000"
          />
        </label>
        <label className="wallet-field mb-3.5 flex flex-col gap-2 text-xs font-semibold">
          <span>Tài khoản nhận tiền</span>
          <Select aria-label="Tài khoản nhận tiền" value={selectedBankId === '' ? '' : String(selectedBankId)} onChange={value => setSelectedBankId(value ? Number(value) : '')} options={[
            { value: '', label: 'Chọn tài khoản' },
            ...bankAccounts.map(account => ({ value: String(account.id), label: `${account.bankCode} · ${account.accountNumber} · ${account.accountName}` })),
          ]} />
        </label>
        {selectedBank && (
          <p className="wallet-muted mb-4 text-xs leading-5 text-muted-foreground">
            Sẽ chuyển tới {selectedBank.bankCode} · {selectedBank.accountNumber} · {selectedBank.accountName}
          </p>
        )}
        <button
          type="button"
          className="wallet-primary rounded-lg bg-primary px-4.5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void createWithdrawal()}
          disabled={creatingWithdrawal || !Number(withdrawAmount) || !selectedBankId}
        >
          {creatingWithdrawal ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}
        </button>
      </section>

      <section className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
        <h2>Tài khoản nhận tiền</h2>
        {bankAccounts.length === 0 && <p className="wallet-muted mb-4 text-xs leading-5 text-muted-foreground">Chưa có tài khoản nhận tiền.</p>}
        <ul className="wallet-bank-list mt-0 mb-4.5 flex list-none flex-col gap-2 p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:gap-2.5 [&_li]:rounded-lg [&_li]:bg-muted [&_li]:px-3 [&_li]:py-2.5 [&_li]:text-xs [&_strong]:text-sm [&_em]:ml-auto [&_em]:text-2xs [&_em]:font-bold [&_em]:text-primary [&_em]:not-italic">
          {bankAccounts.map(account => (
            <li key={account.id}>
              <strong>{account.bankCode}</strong>
              <span>{account.accountNumber}</span>
              <span>{account.accountName}</span>
              {account.isDefault && <em>Mặc định</em>}
            </li>
          ))}
        </ul>
        <div className="wallet-bank-form grid grid-cols-1 items-end gap-3 min-[901px]:grid-cols-3">
          <label className="wallet-field mb-3.5 flex flex-col gap-2 text-xs font-semibold">
            <span>Ngân hàng</span>
            <Input className="h-11 bg-card text-sm" value={bankCode} onChange={event => setBankCode(event.target.value)} placeholder="MBBank" />
          </label>
          <label className="wallet-field mb-3.5 flex flex-col gap-2 text-xs font-semibold">
            <span>Số tài khoản</span>
            <Input className="h-11 bg-card text-sm" value={accountNumber} onChange={event => setAccountNumber(event.target.value)} placeholder="0123456789" />
          </label>
          <label className="wallet-field mb-3.5 flex flex-col gap-2 text-xs font-semibold">
            <span>Tên chủ tài khoản</span>
            <Input className="h-11 bg-card text-sm" value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="NGUYEN VAN A" />
          </label>
          <button
            type="button"
            className="wallet-secondary rounded-lg bg-secondary px-4.5 py-3 text-sm font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void saveBankAccount()}
            disabled={savingBank || !bankCode.trim() || !accountNumber.trim() || !accountName.trim()}
          >
            {savingBank ? 'Đang lưu…' : 'Thêm tài khoản'}
          </button>
        </div>
      </section>

      <section className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
        <h2>Lịch sử yêu cầu rút</h2>
        {payouts.length === 0 && <p className="wallet-muted mb-4 text-xs leading-5 text-muted-foreground">Chưa có yêu cầu rút tiền.</p>}
        {payouts.length > 0 && (
          <div className="wallet-table-wrap w-full overflow-x-auto">
            <table className="wallet-table w-full border-collapse text-xs [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:tracking-wide [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_th]:uppercase [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-left [&_td]:whitespace-nowrap">
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
                      <span className="wallet-code rounded-md bg-info/10 px-2 py-1 font-mono text-xs font-bold text-info">{payoutTransferContent(row.id)}</span>
                      <button type="button" className="wallet-copy ml-1.5 rounded-md border border-border bg-card px-2 py-1 text-2xs font-bold text-primary" onClick={() => void copyText(payoutTransferContent(row.id), 'nội dung chuyển khoản')}>Copy</button>
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

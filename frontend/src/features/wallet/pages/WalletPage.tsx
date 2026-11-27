import { MoneyPreview } from '@/components/common/money-preview';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Check, KeyRound, ShieldCheck } from 'lucide-react';
import { pinErrorMessage } from '../services/pin-errors';
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction, type Dispatch } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { formatVnd, walletApi } from '../services/wallet-api';
import type {
  PayoutStatus,
  TopUpInitiation,
  WalletBankAccount,
  WalletEntryPage,
  WalletLedgerEntry,
  WalletPayoutRequest,
  WalletSnapshot,
  WithdrawalPinStatus,
  WithdrawalPinChallenge,
} from '../types';

type WalletTab = 'TOP_UP' | 'WITHDRAW' | 'ACCOUNTS' | 'HISTORY';

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

const PAYOUT_LABELS: Record<PayoutStatus, string> = {
  PENDING: 'Chờ Admin duyệt',
  APPROVED: 'Đã duyệt - chờ chuyển khoản',
  REJECTED: 'Bị từ chối',
  PAID: 'Đã chuyển khoản',
  FAILED: 'Thất bại',
};

const ENTRY_LABELS: Record<WalletLedgerEntry['entryType'], string> = {
  TOP_UP: 'Nạp ví',
  PAYMENT: 'Thanh toán',
  REFUND: 'Hoàn tiền',
  WITHDRAWAL: 'Rút ví',
  PAYOUT: 'Chi trả',
  ADMIN_ADJUSTMENT: 'Admin điều chỉnh',
  OWNER_EARNING: 'Doanh thu sân',
  OWNER_EARNING_REVERSAL: 'Thu hồi doanh thu',
  TOURNAMENT_EARNING: 'Lệ phí giải (Organizer)',
};

const HISTORY_PAGE_SIZE = 20;

function entryReference(entry: WalletLedgerEntry): string | null {
  if (!entry.referenceType) return null;
  const type = entry.referenceType === 'BOOKING'
    ? 'Booking'
    : entry.referenceType === 'WITHDRAWAL' || entry.referenceType === 'OWNER_PAYOUT'
      ? 'Yêu cầu'
      : entry.referenceType;
  return entry.referenceId ? `${type} #${entry.referenceId}` : type;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { hour12: false });
}

/** Only in-app tournament pages are accepted as a return target (no open redirect). */
function safeReturnTo(value: string | null): string | null {
  return value && /^\/tournaments\/\d+$/.test(value) ? value : null;
}

export function WalletPage() {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [bankAccounts, setBankAccounts] = useState<WalletBankAccount[]>([]);
  const [payouts, setPayouts] = useState<WalletPayoutRequest[]>([]);
  const [tab, setTab] = useState<WalletTab>('TOP_UP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<WalletEntryPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [amount, setAmount] = useState('50000');
  const [topUp, setTopUp] = useState<TopUpInitiation | null>(null);
  const [creatingTopUp, setCreatingTopUp] = useState(false);
  const topUpBaseline = useRef(0);

  const [withdrawAmount, setWithdrawAmount] = useState('50000');
  const [selectedBankId, setSelectedBankId] = useState<number | ''>('');
  const [creatingWithdrawal, setCreatingWithdrawal] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalNotice, setWithdrawalNotice] = useState<string | null>(null);
  const withdrawalFeedbackRef = useRef<HTMLDivElement>(null);
  const withdrawalIntentRef = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    if (withdrawalError || withdrawalNotice) {
      withdrawalFeedbackRef.current?.focus({ preventScroll: true });
      withdrawalFeedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [withdrawalError, withdrawalNotice]);
  const [withdrawPin, setWithdrawPin] = useState('');
  const [pinStatus, setPinStatus] = useState<WithdrawalPinStatus | null>(null);
  const [pinFlow, setPinFlow] = useState<'IDLE' | 'OTP' | 'NEW_PIN'>('IDLE');
  const [pinChallenge, setPinChallenge] = useState<WithdrawalPinChallenge | null>(null);
  const [pinOtp, setPinOtp] = useState('');
  const [pinResetToken, setPinResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  const [bankCode, setBankCode] = useState('MBBank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextWallet, nextBanks, nextPayouts, nextPinStatus] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getBankAccounts(),
        walletApi.getPayouts(),
        walletApi.getWithdrawalPinStatus(),
      ]);
      setWallet(nextWallet);
      setBankAccounts(nextBanks);
      setPayouts(nextPayouts);
      setPinStatus(nextPinStatus);
      setSelectedBankId(current => current || nextBanks[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tải thông tin ví.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await walletApi.getEntries(page, HISTORY_PAGE_SIZE));
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : 'Không thể tải lịch sử giao dịch.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'HISTORY') void loadHistory(historyPage);
  }, [tab, historyPage, loadHistory]);

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
    setWithdrawalError(null);
    setWithdrawalNotice(null);
    if (!/^\d+$/.test(withdrawAmount) || !Number.isSafeInteger(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      setWithdrawalError('Vui lòng nhập số tiền rút hợp lệ, lớn hơn 0 đồng.');
      return;
    }
    if (wallet && Number(withdrawAmount) > Number(wallet.available)) {
      setWithdrawalError(`Số tiền rút vượt số dư khả dụng. Bạn có thể rút tối đa ${formatVnd(wallet.available)}.`);
      return;
    }
    if (!selectedBankId) {
      setWithdrawalError('Vui lòng chọn tài khoản nhận tiền. Nếu chưa có, hãy thêm tại mục Tài khoản nhận.');
      return;
    }
    if (!/^\d{6}$/.test(withdrawPin)) {
      setWithdrawalError('Vui lòng nhập mã PIN rút tiền gồm 6 chữ số.');
      return;
    }
    setCreatingWithdrawal(true);
    setError(null);
    setNotice(null);
    setPinError(null);
    // The same id is reused while the user retries the same payout, so a lost
    // response cannot create a second request (the server replays the first one).
    const intentKey = `${withdrawAmount}:${selectedBankId}`;
    if (withdrawalIntentRef.current?.key !== intentKey) {
      withdrawalIntentRef.current = { key: intentKey, id: crypto.randomUUID() };
    }
    try {
      const request = await walletApi.createWithdrawal({
        amount: withdrawAmount,
        bankAccountId: Number(selectedBankId),
        withdrawalPin: withdrawPin,
        clientRequestId: withdrawalIntentRef.current.id,
      });
      withdrawalIntentRef.current = null;
      setWithdrawPin('');
      setPayouts(current => [request, ...current.filter(item => item.id !== request.id)]);
      setWithdrawalNotice(request.status === 'APPROVED'
        ? 'Yêu cầu đã được duyệt tự động (sandbox). Dùng SePay Test mode mô phỏng giao dịch tiền ra với nội dung PAYOUT-' + request.id + '.'
        : 'Đã gửi yêu cầu rút tiền. Admin sẽ duyệt và chuyển khoản thủ công.');
      // The request already exists; a failed balance refresh must not look like a failed request.
      await walletApi.getWallet().then(setWallet).catch(() => undefined);
    } catch (err) {
      setWithdrawalError(pinErrorMessage(err));
      if (err instanceof ApiError && err.code === 'WALLET_PIN_LOCKED') {
        setPinStatus(await walletApi.getWithdrawalPinStatus().catch(() => pinStatus));
      }
    } finally {
      setCreatingWithdrawal(false);
    }
  };

  const startPinReset = async () => {
    setPinBusy(true);
    setPinError(null);
    setPinNotice(null);
    try {
      const challenge = await walletApi.requestWithdrawalPinReset();
      setPinChallenge(challenge);
      setPinOtp('');
      setPinFlow('OTP');
      setPinNotice('Mã xác minh đã được gửi tới email tài khoản.');
    } catch (err) {
      setPinError(pinErrorMessage(err));
    } finally {
      setPinBusy(false);
    }
  };

  const verifyPinOtp = async () => {
    if (!pinChallenge) return;
    setPinBusy(true);
    setPinError(null);
    try {
      const authorization = await walletApi.verifyWithdrawalPinReset({ challengeId: pinChallenge.challengeId, otp: pinOtp });
      setPinResetToken(authorization.resetToken);
      setPinFlow('NEW_PIN');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setPinError(pinErrorMessage(err));
    } finally {
      setPinBusy(false);
    }
  };

  const saveNewPin = async () => {
    if (!/^\d{6}$/.test(newPin)) {
      setPinError('Mã PIN phải gồm 6 chữ số.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Mã PIN xác nhận không khớp.');
      return;
    }
    setPinBusy(true);
    setPinError(null);
    try {
      await walletApi.resetWithdrawalPin({ resetToken: pinResetToken, newPin, confirmPin });
      setPinNotice('Mã PIN rút tiền đã được cập nhật thành công.');
      setPinFlow('IDLE');
      setPinChallenge(null);
      setPinResetToken('');
      setNewPin('');
      setConfirmPin('');
      // The PIN is already saved; a failed status refresh must not look like a failed reset.
      await walletApi.getWithdrawalPinStatus().then(setPinStatus).catch(() => undefined);
    } catch (err) {
      setPinError(pinErrorMessage(err));
      if (err instanceof ApiError && err.code === 'AUTH_RESET_TOKEN_INVALID') {
        // The one-time authorization expired; restart from the email verification.
        setPinFlow('IDLE');
        setPinChallenge(null);
        setPinResetToken('');
        setNewPin('');
        setConfirmPin('');
      }
    } finally {
      setPinBusy(false);
    }
  };

  const resendPinOtp = async () => {
    if (!pinChallenge) return;
    setPinBusy(true);
    setPinError(null);
    try {
      setPinChallenge(await walletApi.resendWithdrawalPinOtp({ challengeId: pinChallenge.challengeId }));
      setPinOtp('');
      setPinNotice('Đã gửi lại mã xác minh. Mã cũ không còn hiệu lực.');
    } catch (err) {
      setPinError(pinErrorMessage(err));
    } finally {
      setPinBusy(false);
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
      return true;
    } catch {
      setError('Không thể copy. Vui lòng chọn và copy thủ công.');
      return false;
    }
  };

  if (loading) {
    return <div className="wallet-page mx-auto flex w-full max-w-300 flex-col gap-5 px-3.5 pt-5 pb-12 font-sans text-base leading-relaxed text-foreground sm:px-6 sm:pt-8 sm:pb-16"><div className="wallet-state rounded-2xl bg-card p-10 text-center text-muted-foreground">Đang tải ví…</div></div>;
  }

  return (
    <div className="wallet-page mx-auto flex w-full max-w-300 flex-col gap-5 px-3.5 pt-5 pb-12 font-sans text-base leading-relaxed text-foreground sm:px-6 sm:pt-8 sm:pb-16">
      <header className="wallet-header flex flex-wrap items-end justify-between gap-4 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight sm:[&_h1]:text-4xl [&_p]:mt-1 [&_p]:text-base [&_p]:leading-5 [&_p]:text-muted-foreground">
        <div>
          <p className="wallet-eyebrow mb-1 text-xs font-extrabold tracking-widest text-primary">SMASHPRO WALLET</p>
          <h1>Ví của tôi</h1>
          <p>Nạp tiền qua VietQR, thanh toán booking bằng số dư và gửi yêu cầu rút tiền.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {returnTo && <Link to={returnTo} className="rounded-lg border border-primary px-4.5 py-3 text-base font-bold text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">← Quay lại giải đấu</Link>}
        <button type="button" className="wallet-secondary rounded-lg border border-primary/40 bg-card px-4.5 py-3 text-base font-bold text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { void load(); if (tab === 'HISTORY') void loadHistory(historyPage); }}>Làm mới</button>
        </div>
      </header>

      {error && <div className="wallet-alert rounded-lg px-4 py-3 text-base leading-5 wallet-alert-error border border-destructive/20 bg-destructive/10 text-destructive" role="alert">{error}</div>}
      {notice && <div className="wallet-alert rounded-lg px-4 py-3 text-base leading-5 wallet-alert-success border border-primary/20 bg-primary/10 text-primary" role="status">{notice}</div>}

      {renderWalletBalances(wallet)}

      {renderWalletTabs(tab, setTab, setHistoryPage)}

      {tab === 'TOP_UP' && (
        <section className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
          <div className="wallet-panel-main max-w-190">
            <h2>Nạp tiền vào ví</h2>
            <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Nhập số tiền, hệ thống tạo mã VietQR và nội dung chuyển khoản riêng.</p>
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Số tiền</span>
              <Input className="h-11 bg-card text-base" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="50000" />
            </label>
            <MoneyPreview value={amount} className="-mt-1 mb-3.5" />
            <div className="wallet-quick-amounts mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_AMOUNTS.map(value => (
                <button key={value} type="button" aria-pressed={Number(amount) === value}
                  className={`min-h-12 rounded-lg border px-3 py-3 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${Number(amount) === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted'}`}
                  onClick={() => setAmount(String(value))}>{formatVnd(value)}</button>
              ))}
            </div>
            <button type="button" className="wallet-primary rounded-lg bg-primary px-4.5 py-3 text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void createTopUp()} disabled={creatingTopUp || !Number(amount)}>
              {creatingTopUp ? 'Đang tạo mã…' : 'Tạo mã nạp tiền'}
            </button>

            {topUp && (
              renderTopUpResult(topUp, copy, confirmMockTopUp)
            )}
          </div>
          <aside className="wallet-panel-aside mt-4.5 rounded-2xl bg-muted p-4.5 [&_ul]:list-disc [&_ul]:pl-4.5 [&_ul]:text-sm [&_ul]:leading-5 [&_ul]:text-muted-foreground">
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
        <section className="wallet-grid-2 grid grid-cols-1 items-start gap-4 min-[901px]:grid-cols-2">
          <div className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
            <h2>Yêu cầu rút tiền</h2>
            <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Số tiền sẽ được giữ lại cho đến khi Admin duyệt và chuyển khoản thủ công.</p>
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Số tiền rút</span>
              <Input className="h-11 bg-card text-base" inputMode="numeric" value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="50000" />
              <span className="font-normal text-muted-foreground">Có thể rút tối đa: {formatVnd(wallet?.available ?? 0)}</span>
            </label>
            <MoneyPreview value={withdrawAmount} className="-mt-1 mb-3.5" />
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Tài khoản nhận</span>
              <Select aria-label="Tài khoản nhận" value={selectedBankId === '' ? '' : String(selectedBankId)} onChange={value => setSelectedBankId(Number(value) || '')} options={[
                { value: '', label: 'Chọn tài khoản' },
                ...bankAccounts.map(account => ({ value: String(account.id), label: `${account.bankCode} · ${account.accountNumber} · ${account.accountName}` })),
              ]} />
            </label>
            {selectedBank && <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Nhận về: {selectedBank.accountName} · {selectedBank.bankCode} · {selectedBank.accountNumber}</p>}
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Mã PIN rút tiền</span>
              <Input className="h-11 bg-card text-base" type="password" inputMode="numeric" maxLength={6} value={withdrawPin}
                onChange={event => setWithdrawPin(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="6 chữ số" />
            </label>
            {pinStatus?.lockedUntil && new Date(pinStatus.lockedUntil) > new Date() && (
              <p className="mb-3 text-sm font-semibold text-destructive" role="status">
                Mã PIN đang tạm khóa đến {new Date(pinStatus.lockedUntil).toLocaleString('vi-VN', { hour12: false })}.
              </p>
            )}
            {(withdrawalError || withdrawalNotice) && (
              <div ref={withdrawalFeedbackRef} tabIndex={-1} role={withdrawalError ? 'alert' : 'status'}
                className={`mb-3 rounded-lg border px-4 py-3 text-sm leading-6 ${withdrawalError ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 text-primary'}`}>
                {withdrawalError || withdrawalNotice}
              </div>
            )}
            <button type="button" className="wallet-primary rounded-lg bg-primary px-4.5 py-3 text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void createWithdrawal()} disabled={creatingWithdrawal}>
              {creatingWithdrawal ? 'Đang gửi…' : 'Gửi yêu cầu rút'}
            </button>
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="mr-1 inline size-3.5" />{pinStatus?.hasPin ? 'Mã PIN rút tiền đã thiết lập.' : 'Bạn chưa thiết lập mã PIN rút tiền.'}</p>
                <button type="button" className="wallet-link-button p-0 text-sm font-bold text-primary" onClick={() => void startPinReset()} disabled={pinBusy}>
                  {pinStatus?.hasPin ? 'Quên mã PIN?' : 'Thiết lập mã PIN'}
                </button>
              </div>
              {pinError && <p className="mt-2 text-sm font-semibold text-destructive" role="alert">{pinError}</p>}
              {pinNotice && <p className="mt-2 text-sm font-semibold text-primary" role="status">{pinNotice}</p>}
              {pinFlow === 'OTP' && (
                <div className="mt-3 grid gap-2">
                  <p className="text-sm text-muted-foreground">Nhập mã xác minh đã gửi tới email tài khoản.</p>
                  <Input className="h-11 bg-card text-base" inputMode="numeric" maxLength={6} value={pinOtp} onChange={event => setPinOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="123456" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="wallet-primary rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50" onClick={() => void verifyPinOtp()} disabled={pinBusy || pinOtp.length !== 6}>Xác minh</button>
                    <button type="button" className="wallet-link-button p-0 text-sm font-bold text-primary" onClick={() => void resendPinOtp()} disabled={pinBusy}>Gửi lại mã</button>
                  </div>
                </div>
              )}
              {pinFlow === 'NEW_PIN' && (
                <div className="mt-3 grid gap-2">
                  <Input className="h-11 bg-card text-base" type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={event => setNewPin(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="Mã PIN mới" />
                  <Input className="h-11 bg-card text-base" type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="Nhập lại mã PIN" />
                  <button type="button" className="wallet-primary justify-self-start rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50" onClick={() => void saveNewPin()} disabled={pinBusy}><KeyRound aria-hidden="true" className="mr-1 inline size-3.5" />Lưu mã PIN</button>
                </div>
              )}
            </div>
            {bankAccounts.length === 0 && (
              <button type="button" className="wallet-link-button mt-3 inline-block p-0 text-sm font-bold text-primary" onClick={() => setTab('ACCOUNTS')}>Thêm tài khoản nhận tiền</button>
            )}
          </div>

          <div className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
            <h2>Lịch sử yêu cầu</h2>
            {payouts.length === 0 ? <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Chưa có yêu cầu rút tiền.</p> : (
              <div className="wallet-list m-0 flex list-none flex-col gap-2 p-0">
                {payouts.map(request => (
                  <article key={request.id} className="wallet-list-item flex items-start justify-between gap-3 rounded-lg bg-muted p-3 [&_strong]:text-base [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
                    <div>
                      <strong>{formatVnd(request.amount)}</strong>
                      <p>{formatDate(request.requestedAt)}</p>
                      {request.expiresAt && ['PENDING', 'APPROVED'].includes(request.status) && <p>Hạn xử lý: {formatDate(request.expiresAt)}</p>}
                      {request.status === 'FAILED' && request.adminNote && <p>{request.adminNote}</p>}
                      <p>Nội dung CK: <code>PAYOUT-{request.id}</code></p>
                    </div>
                    <span className={`wallet-status inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase [&.wallet-status-pending]:bg-caution/10 [&.wallet-status-pending]:text-caution [&.wallet-status-approved]:bg-info/10 [&.wallet-status-approved]:text-info [&.wallet-status-paid]:bg-primary/10 [&.wallet-status-paid]:text-primary [&.wallet-status-success]:bg-primary/10 [&.wallet-status-success]:text-primary [&.wallet-status-rejected]:bg-destructive/10 [&.wallet-status-rejected]:text-destructive [&.wallet-status-failed]:bg-destructive/10 [&.wallet-status-failed]:text-destructive wallet-status-${request.status.toLowerCase()}`}>{PAYOUT_LABELS[request.status]}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'HISTORY' && (
        renderWalletHistory(history, historyLoading, historyError, historyPage, setHistoryPage)
      )}

      {tab === 'ACCOUNTS' && (
        <section className="wallet-grid-2 grid grid-cols-1 items-start gap-4 min-[901px]:grid-cols-2">
          <div className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
            <h2>Thêm tài khoản nhận tiền</h2>
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Mã ngân hàng</span>
              <Input className="h-11 bg-card text-base" value={bankCode} onChange={event => setBankCode(event.target.value)} placeholder="MBBank" />
            </label>
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Số tài khoản</span>
              <Input className="h-11 bg-card text-base" value={accountNumber} onChange={event => setAccountNumber(event.target.value)} placeholder="0123456789" />
            </label>
            <label className="wallet-field mb-3.5 flex flex-col gap-2 text-sm font-semibold">
              <span>Tên chủ tài khoản</span>
              <Input className="h-11 bg-card text-base" value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="NGUYEN VAN A" />
            </label>
            <button type="button" className="wallet-primary rounded-lg bg-primary px-4.5 py-3 text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void saveBankAccount()} disabled={savingBank || !accountNumber.trim() || !accountName.trim()}>
              {savingBank ? 'Đang lưu…' : 'Thêm tài khoản'}
            </button>
          </div>

          <div className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
            <h2>Tài khoản đã lưu</h2>
            {bankAccounts.length === 0 ? <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Chưa có tài khoản nhận tiền.</p> : (
              <div className="wallet-list m-0 flex list-none flex-col gap-2 p-0">
                {bankAccounts.map(account => (
                  <article key={account.id} className="wallet-list-item flex items-start justify-between gap-3 rounded-lg bg-muted p-3 [&_strong]:text-base [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
                    <div>
                      <strong>{account.bankCode} · {account.accountNumber}</strong>
                      <p>{account.accountName}</p>
                    </div>
                    {account.isDefault && <span className="wallet-status inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase [&.wallet-status-pending]:bg-caution/10 [&.wallet-status-pending]:text-caution [&.wallet-status-approved]:bg-info/10 [&.wallet-status-approved]:text-info [&.wallet-status-paid]:bg-primary/10 [&.wallet-status-paid]:text-primary [&.wallet-status-success]:bg-primary/10 [&.wallet-status-success]:text-primary [&.wallet-status-rejected]:bg-destructive/10 [&.wallet-status-rejected]:text-destructive [&.wallet-status-failed]:bg-destructive/10 [&.wallet-status-failed]:text-destructive wallet-status-success">Mặc định</span>}
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

function renderWalletTabs(tab: string, setTab: Dispatch<SetStateAction<WalletTab>>, setHistoryPage: Dispatch<SetStateAction<number>>) {
  return <nav className="wallet-tabs flex max-w-full gap-2 self-stretch overflow-x-auto rounded-2xl bg-muted p-1.5 sm:self-start [&_button]:flex-1 [&_button]:rounded-lg [&_button]:px-4 [&_button]:py-2 [&_button]:text-base [&_button]:font-semibold [&_button]:whitespace-nowrap [&_button]:text-muted-foreground [&_button.active]:bg-card [&_button.active]:text-primary [&_button.active]:shadow-sm" aria-label="Ví">
    <button type="button" className={tab === 'TOP_UP' ? 'active' : ''} onClick={() => setTab('TOP_UP')}>Nạp tiền</button>
    <button type="button" className={tab === 'WITHDRAW' ? 'active' : ''} onClick={() => setTab('WITHDRAW')}>Rút tiền</button>
    <button type="button" className={tab === 'ACCOUNTS' ? 'active' : ''} onClick={() => setTab('ACCOUNTS')}>Tài khoản nhận</button>
    <button type="button" className={tab === 'HISTORY' ? 'active' : ''} onClick={() => { setTab('HISTORY'); setHistoryPage(1); }}>Lịch sử giao dịch</button>
  </nav>;
}

function TransferContentCopy({ value, copy }: { value: string; copy: (value: string, label: string) => Promise<boolean> }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const handleCopy = async () => {
    if (!await copy(value, 'nội dung chuyển khoản')) return;
    if (timer.current) clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 3000);
  };
  return <button type="button" onClick={() => void handleCopy()}
    aria-label={copied ? 'Đã sao chép nội dung chuyển khoản' : 'Copy nội dung chuyển khoản'}
    className="inline-flex h-11 min-w-18 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-accent px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <span aria-live="polite" className="inline-flex items-center justify-center">
      {copied ? <><Check aria-hidden="true" className="size-5" /><span className="sr-only">Đã sao chép</span></> : 'Copy'}
    </span>
  </button>;
}

function renderTopUpResult(topUp: TopUpInitiation, copy: (value: string, label: string) => Promise<boolean>, confirmMockTopUp: () => Promise<void>): import("react").ReactNode {
  return <div className="wallet-topup-result mt-5 border-t border-border pt-5">
    <div className="wallet-topup-head mb-3.5 flex items-start justify-between gap-3 [&_h3]:mt-1.5 [&_h3]:text-3xl">
      <div>
        <span className={`wallet-status inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase [&.wallet-status-pending]:bg-caution/10 [&.wallet-status-pending]:text-caution [&.wallet-status-approved]:bg-info/10 [&.wallet-status-approved]:text-info [&.wallet-status-paid]:bg-primary/10 [&.wallet-status-paid]:text-primary [&.wallet-status-success]:bg-primary/10 [&.wallet-status-success]:text-primary [&.wallet-status-rejected]:bg-destructive/10 [&.wallet-status-rejected]:text-destructive [&.wallet-status-failed]:bg-destructive/10 [&.wallet-status-failed]:text-destructive wallet-status-${topUp.status.toLowerCase()}`}>{topUp.status}</span>
        <h3>{formatVnd(topUp.amount)}</h3>
      </div>
      {topUp.status === 'SUCCESS' && <strong className="wallet-success-text text-sm text-primary">Đã cộng ví</strong>}
    </div>

    {topUp.status === 'PENDING' && topUp.qrUrl && (
      <div className="wallet-qr-grid grid grid-cols-1 items-start gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <img src={topUp.qrUrl} alt="Mã VietQR nạp ví" className="wallet-qr mx-auto size-45 rounded-2xl border border-border bg-card object-contain" />
        <dl className="wallet-bank-info m-0 flex flex-col gap-2 [&>div]:grid [&>div]:grid-cols-[108px_minmax(0,1fr)] [&>div]:items-baseline [&>div]:gap-2 [&_dt]:text-sm [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:text-base [&_dd]:font-bold [&_dd]:wrap-anywhere">
          <div><dt>Ngân hàng</dt><dd>{topUp.bankCode}</dd></div>
          <div><dt>Số tài khoản</dt><dd>{topUp.accountNumber}</dd></div>
          <div><dt>Chủ tài khoản</dt><dd>{topUp.accountName}</dd></div>
          <div><dt>Số tiền</dt><dd>{formatVnd(topUp.amount)}</dd></div>
          <div className="wallet-content-row flex flex-wrap items-center gap-2">
            <dt>Nội dung CK</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2"><code className="min-w-0 wrap-anywhere">{topUp.transferContent}</code><TransferContentCopy key={topUp.transferContent} value={topUp.transferContent ?? ''} copy={copy} /></dd>
          </div>
        </dl>
      </div>
    )}

    {topUp.status === 'PENDING' && topUp.expiresAt && <p className="mt-3 text-sm font-semibold text-caution">Hạn thanh toán: {formatDate(topUp.expiresAt)}</p>}
    {topUp.status === 'PENDING' && (
      <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">
        Đang chờ thanh toán. Nếu dùng SePay Test mode, mở SePay → Mô phỏng giao dịch với đúng số tiền và nội dung trên.
      </p>
    )}
    {topUp.isMock && topUp.status === 'PENDING' && (
      <button type="button" className="wallet-secondary rounded-lg bg-secondary px-4.5 py-3 text-base font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void confirmMockTopUp()}>Xác nhận thanh toán thử</button>
    )}
  </div>;
}

function renderWalletBalances(wallet: WalletSnapshot | null) {
  return <section className="wallet-balance-grid grid grid-cols-1 gap-3.5 min-[901px]:grid-cols-[1.4fr_1fr_1fr]" aria-label="Số dư ví">
    <article className="wallet-balance-card min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm [&_span]:block [&_span]:text-sm [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_span]:uppercase [&_strong]:mt-2 [&_strong]:block [&_strong]:text-3xl [&_strong]:leading-8 [&_strong]:tracking-tight [&_strong]:wrap-anywhere [&_p]:mt-1.5 [&_p]:text-sm [&_p]:leading-5 [&_p]:text-muted-foreground wallet-balance-main border-transparent bg-primary text-primary-foreground [&_span]:text-primary-foreground/80 [&_p]:text-primary-foreground/80">
      <span>Số dư khả dụng</span>
      <strong>{formatVnd(wallet?.available ?? 0)}</strong>
      <p>Tổng số dư: {formatVnd(wallet?.balance ?? 0)}</p>
    </article>
    <article className="wallet-balance-card min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm [&_span]:block [&_span]:text-sm [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_span]:uppercase [&_strong]:mt-2 [&_strong]:block [&_strong]:text-3xl [&_strong]:leading-8 [&_strong]:tracking-tight [&_strong]:wrap-anywhere [&_p]:mt-1.5 [&_p]:text-sm [&_p]:leading-5 [&_p]:text-muted-foreground">
      <span>Đang giữ</span>
      <strong>{formatVnd(wallet?.held ?? 0)}</strong>
      <p>Cho yêu cầu rút tiền đang chờ xử lý</p>
    </article>
    <article className="wallet-balance-card min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm [&_span]:block [&_span]:text-sm [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_span]:uppercase [&_strong]:mt-2 [&_strong]:block [&_strong]:text-3xl [&_strong]:leading-8 [&_strong]:tracking-tight [&_strong]:wrap-anywhere [&_p]:mt-1.5 [&_p]:text-sm [&_p]:leading-5 [&_p]:text-muted-foreground">
      <span>Cập nhật gần nhất</span>
      <strong className="wallet-date text-base! leading-5!">{formatDate(wallet?.updatedAt ?? null)}</strong>
      <p>Dữ liệu ví lấy trực tiếp từ hệ thống</p>
    </article>
  </section>;
}

function renderWalletHistory(
  history: WalletEntryPage | null,
  historyLoading: boolean,
  historyError: string | null,
  historyPage: number,
  setHistoryPage: Dispatch<SetStateAction<number>>,

): import("react").ReactNode {
  return <section className="wallet-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm sm:p-6 [&_h2]:mb-1.5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h3]:mb-2.5 [&_h3]:text-base">
    <div className="wallet-history-head flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2>Lịch sử giao dịch</h2>
        <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Các khoản nạp/rút ví, thanh toán, hoàn tiền và điều chỉnh trên sàn.</p>
        <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Giao dịch đang chờ xử lý xem ở tab Nạp tiền / Rút tiền tương ứng.</p>
      </div>
      {history && <span className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">{history.meta.total} giao dịch</span>}
    </div>
    {historyLoading && <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground" role="status">Đang tải lịch sử giao dịch…</p>}
    {historyError && <div className="wallet-alert rounded-lg px-4 py-3 text-base leading-5 wallet-alert-error border border-destructive/20 bg-destructive/10 text-destructive" role="alert">{historyError}</div>}
    {history && !historyLoading && history.data.length === 0 && (
      <p className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Chưa có giao dịch nào.</p>
    )}
    {history && history.data.length > 0 && (
      <div className="wallet-table-wrap w-full overflow-x-auto">
        <table className="wallet-table w-full border-collapse text-sm [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-sm [&_th]:tracking-wide [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_th]:uppercase [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-left [&_td]:whitespace-nowrap">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Loại giao dịch</th>
              <th>Nội dung</th>
              <th>Số tiền</th>
              <th>Số dư sau</th>
            </tr>
          </thead>
          <tbody>
            {history.data.map(entry => {
              const credit = Number(entry.amount) >= 0;
              const reference = entryReference(entry);
              return <tr key={entry.id}>
                <td>{formatDate(entry.createdAt)}</td>
                <td><span className={`wallet-entry-type inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold whitespace-nowrap text-muted-foreground [&.wallet-entry-top-up]:bg-primary/10 [&.wallet-entry-top-up]:text-primary [&.wallet-entry-refund]:bg-primary/10 [&.wallet-entry-refund]:text-primary [&.wallet-entry-owner-earning]:bg-primary/10 [&.wallet-entry-owner-earning]:text-primary [&.wallet-entry-tournament-earning]:bg-primary/10 [&.wallet-entry-tournament-earning]:text-primary [&.wallet-entry-payment]:bg-destructive/10 [&.wallet-entry-payment]:text-destructive [&.wallet-entry-owner-earning-reversal]:bg-destructive/10 [&.wallet-entry-owner-earning-reversal]:text-destructive [&.wallet-entry-withdrawal]:bg-caution/10 [&.wallet-entry-withdrawal]:text-caution [&.wallet-entry-payout]:bg-caution/10 [&.wallet-entry-payout]:text-caution [&.wallet-entry-admin-adjustment]:bg-info/10 [&.wallet-entry-admin-adjustment]:text-info wallet-entry-${entry.entryType.toLowerCase().replaceAll('_', '-')}`}>{ENTRY_LABELS[entry.entryType]}</span></td>
                <td>
                  <strong>{entry.description ?? ENTRY_LABELS[entry.entryType]}</strong>
                  {reference && <p className="wallet-entry-ref mt-1 text-sm font-medium text-muted-foreground">{reference}</p>}
                </td>
                <td className={credit ? 'wallet-amount-positive font-bold text-primary' : 'wallet-amount-negative font-bold text-destructive'}>
                  {credit ? '+' : ''}{formatVnd(entry.amount)}
                </td>
                <td>{formatVnd(entry.balanceAfter)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    )}
    {history && history.meta.totalPages > 1 && (
      renderWalletPagination(historyPage, historyLoading, setHistoryPage, history)
    )}
  </section>;
}

function renderWalletPagination(
  historyPage: number,
  historyLoading: boolean,
  setHistoryPage: Dispatch<SetStateAction<number>>,
  history: WalletEntryPage,

): import("react").ReactNode {
  return <div className="wallet-history-pagination mt-4.5 flex items-center justify-center gap-3">
    <button type="button" className="wallet-secondary rounded-lg bg-secondary px-4.5 py-3 text-base font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={historyPage <= 1 || historyLoading} onClick={() => setHistoryPage(page => Math.max(1, page - 1))}>Trước</button>
    <span className="wallet-muted mb-4 text-sm leading-5 text-muted-foreground">Trang {history.meta.page}/{history.meta.totalPages}</span>
    <button type="button" className="wallet-secondary rounded-lg bg-secondary px-4.5 py-3 text-base font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={historyPage >= history.meta.totalPages || historyLoading} onClick={() => setHistoryPage(page => page + 1)}>Sau</button>
  </div>;
}

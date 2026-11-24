import { Banknote, Building2, Copy, KeyRound, Plus, RefreshCw, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { DataTable } from '@/components/common/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { formatVnd, walletApi } from '../../wallet/services/wallet-api';
import { pinErrorMessage } from '../../wallet/services/pin-errors';
import type { PayoutStatus, WalletBankAccount, WalletPayoutRequest, WalletSnapshot, WithdrawalPinStatus, WithdrawalPinChallenge } from '../../wallet/types';

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
  const [addingBank, setAddingBank] = useState(false);

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
      setSelectedBankId(current => nextBanks.some(bank => bank.id === current) ? current : (nextBanks.find(bank => bank.isDefault)?.id ?? nextBanks[0]?.id ?? ''));
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

  const withdrawalIntentRef = useRef<{ key: string; id: string } | null>(null);
  const createWithdrawal = async () => {
    if (!selectedBankId) {
      setError('Bạn cần thêm tài khoản nhận tiền trước.');
      return;
    }
    if (!/^\d{6}$/.test(withdrawPin)) {
      setError('Vui lòng nhập mã PIN rút tiền gồm 6 chữ số.');
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
      const request = await walletApi.createOwnerPayout({
        amount: withdrawAmount,
        bankAccountId: Number(selectedBankId),
        withdrawalPin: withdrawPin,
        clientRequestId: withdrawalIntentRef.current.id,
      });
      withdrawalIntentRef.current = null;
      setWithdrawPin('');
      setPayouts(current => [request, ...current.filter(item => item.id !== request.id)]);
      setNotice(`Đã tạo yêu cầu #${request.id}. Nội dung chuyển khoản: ${payoutTransferContent(request.id)} (${request.status === 'APPROVED' ? 'đã tự duyệt' : 'chờ Admin duyệt'}).`);
      // The request already exists; a failed balance refresh must not look like a failed request.
      await walletApi.getWallet().then(setWallet).catch(() => undefined);
    } catch (err) {
      setError(pinErrorMessage(err));
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
      setPinChallenge(await walletApi.requestWithdrawalPinReset());
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
    if (!/^\d{6}$/.test(newPin) || newPin !== confirmPin) {
      setPinError('Mã PIN phải gồm 6 chữ số và xác nhận phải khớp.');
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
      setAddingBank(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể thêm tài khoản nhận tiền.');
    } finally {
      setSavingBank(false);
    }
  };

  if (loading && !wallet) {
    return <div className="wallet-state rounded-2xl bg-card p-10 text-center text-muted-foreground">Đang tải ví chủ sân…</div>;
  }

  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Ví & thu nhập" description="Theo dõi số dư, tài khoản ngân hàng và yêu cầu rút tiền." actions={<Button type="button" variant="outline" className="h-11" onClick={() => void load()}><RefreshCw aria-hidden="true" />Làm mới</Button>} />
    <p className="text-sm text-muted-foreground">Ví thuộc tài khoản chủ sân, tổng hợp từ tất cả cơ sở.</p>
    {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">{error}</div>}
    {notice && <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-primary" role="status">{notice}</div>}
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Số dư ví chủ sân">
      {[
        { label: 'Số dư khả dụng', value: wallet?.available ?? 0, caption: 'Có thể tạo yêu cầu rút tiền', icon: Wallet },
        { label: 'Tổng số dư', value: wallet?.balance ?? 0, caption: 'Bao gồm số dư khả dụng và đang giữ', icon: Banknote },
        { label: 'Đang chờ rút', value: wallet?.held ?? 0, caption: 'Số tiền giữ cho yêu cầu đang xử lý', icon: Building2 },
      ].map(({ label, value, caption, icon: Icon }) => <ContentPanel key={label}><div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{label}</span><Icon aria-hidden="true" className="size-5 shrink-0" /></div><strong className="break-words text-2xl font-bold tracking-tight">{formatVnd(value)}</strong><p className="text-sm text-muted-foreground">{caption}</p></ContentPanel>)}
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <ContentPanel title="Tạo yêu cầu rút tiền" icon={Banknote}>
        <p className="text-sm leading-6 text-muted-foreground">Kiểm tra tài khoản nhận tiền trước khi gửi yêu cầu. Số tiền sẽ được giữ trong ví trong khi yêu cầu được xử lý.</p>
        <form className="flex flex-col gap-5" onSubmit={event => { event.preventDefault(); void createWithdrawal(); }}>
          <label className="flex flex-col gap-2 text-sm font-semibold"><span>Số tiền rút</span><Input className="h-11 bg-card" inputMode="numeric" required value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="50000" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold"><span>Tài khoản nhận tiền</span><Select aria-label="Tài khoản nhận tiền" value={selectedBankId === '' ? '' : String(selectedBankId)} onChange={value => setSelectedBankId(value ? Number(value) : '')} options={[{ value: '', label: 'Chọn tài khoản' }, ...bankAccounts.map(account => ({ value: String(account.id), label: `${account.bankCode} · •••• ${account.accountNumber.slice(-4)} · ${account.accountName}` }))]} /></label>
          {selectedBank && <p className="break-words text-sm text-muted-foreground">Chuyển tới {selectedBank.bankCode} · •••• {selectedBank.accountNumber.slice(-4)} · {selectedBank.accountName}</p>}
          {!bankAccounts.length && <p className="text-sm text-muted-foreground">Thêm tài khoản ngân hàng để nhận tiền.</p>}
          <label className="flex flex-col gap-2 text-sm font-semibold"><span>Mã PIN rút tiền</span><Input className="h-11 bg-card" type="password" inputMode="numeric" maxLength={6} required value={withdrawPin} onChange={event => setWithdrawPin(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="6 chữ số" /></label>
          {pinStatus?.lockedUntil && new Date(pinStatus.lockedUntil) > new Date() && <p className="text-xs font-semibold text-destructive" role="status">Mã PIN đang tạm khóa đến {new Date(pinStatus.lockedUntil).toLocaleString('vi-VN', { hour12: false })}.</p>}
          <Button type="submit" className="h-11 self-start" disabled={creatingWithdrawal || !Number(withdrawAmount) || !selectedBankId}>{creatingWithdrawal ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}</Button>
          <div className="border-t border-border pt-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground">{pinStatus?.hasPin ? 'Mã PIN rút tiền đã thiết lập.' : 'Bạn chưa thiết lập mã PIN rút tiền.'}</p>
              <Button type="button" variant="ghost" className="h-11 px-2 text-primary" onClick={() => void startPinReset()} disabled={pinBusy}>{pinStatus?.hasPin ? 'Quên mã PIN?' : 'Thiết lập mã PIN'}</Button>
            </div>
            {pinError && <p className="mt-2 font-semibold text-destructive" role="alert">{pinError}</p>}
            {pinNotice && <p className="mt-2 font-semibold text-primary" role="status">{pinNotice}</p>}
            {pinFlow === 'OTP' && <div className="mt-3 grid gap-2">
              <p className="text-muted-foreground">Nhập mã xác minh đã gửi tới email tài khoản.</p>
              <Input className="h-11 bg-card" inputMode="numeric" maxLength={6} value={pinOtp} onChange={event => setPinOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="123456" />
              <Button type="button" className="h-11 justify-self-start" onClick={() => void verifyPinOtp()} disabled={pinBusy || pinOtp.length !== 6}>Xác minh</Button>
            </div>}
            {pinFlow === 'NEW_PIN' && <div className="mt-3 grid gap-2">
              <Input className="h-11 bg-card" type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={event => setNewPin(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="Mã PIN mới" />
              <Input className="h-11 bg-card" type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="Nhập lại mã PIN" />
              <Button type="button" variant="outline" className="h-11 justify-self-start" onClick={() => void saveNewPin()} disabled={pinBusy}><KeyRound aria-hidden="true" />Lưu mã PIN</Button>
            </div>}
          </div>
        </form>
      </ContentPanel>
      <ContentPanel>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold tracking-tight">Tài khoản ngân hàng</h2><Button type="button" variant="ghost" className="h-11 text-primary" aria-expanded={addingBank || !bankAccounts.length} aria-controls="owner-bank-form" onClick={() => setAddingBank(value => !value)}><Plus aria-hidden="true" />{addingBank ? 'Đóng' : 'Thêm'}</Button></div>
        {!bankAccounts.length && <p className="text-sm text-muted-foreground">Chưa có tài khoản nhận tiền.</p>}
        <ul className="flex flex-col gap-4">{bankAccounts.map(account => <li key={account.id} className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-border p-4"><span className="flex size-11 items-center justify-center rounded-lg bg-success-bg text-primary"><Building2 aria-hidden="true" className="size-5" /></span><h3 className="break-all text-base font-bold">{account.bankCode}</h3><p className="text-sm text-muted-foreground">•••• •••• {account.accountNumber.slice(-4)}</p><p className="break-all text-sm font-medium">{account.accountName}</p>{account.isDefault && <Badge variant="success">Tài khoản mặc định</Badge>}</li>)}</ul>
        {(addingBank || !bankAccounts.length) && <form id="owner-bank-form" className="flex flex-col gap-4 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); void saveBankAccount(); }}>
          <label className="flex flex-col gap-2 text-sm font-semibold"><span>Ngân hàng</span><Input className="h-11 bg-card" required value={bankCode} onChange={event => setBankCode(event.target.value)} placeholder="MBBank" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold"><span>Số tài khoản</span><Input className="h-11 bg-card" required inputMode="numeric" value={accountNumber} onChange={event => setAccountNumber(event.target.value)} placeholder="0123456789" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold"><span>Tên chủ tài khoản</span><Input className="h-11 bg-card" required value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="NGUYEN VAN A" /></label>
          <Button type="submit" variant="outline" className="h-11 self-start" disabled={savingBank || !bankCode.trim() || !accountNumber.trim() || !accountName.trim()}>{savingBank ? 'Đang lưu…' : 'Thêm tài khoản'}</Button>
        </form>}
      </ContentPanel>
    </div>
    <ContentPanel title="Lịch sử yêu cầu rút tiền">
      <DataTable scrollable data={payouts} keyExtractor={row => row.id} emptyState={<p>Chưa có yêu cầu rút tiền.</p>} columns={[
        { key: 'code', header: 'Mã yêu cầu', minWidth: 220, render: row => <div className="flex items-center gap-2"><strong className="font-mono text-sm">{payoutTransferContent(row.id)}</strong><Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Sao chép ${payoutTransferContent(row.id)}`} onClick={() => void copyText(payoutTransferContent(row.id), 'nội dung chuyển khoản')}><Copy aria-hidden="true" /></Button></div> },
        { key: 'date', header: 'Ngày gửi', minWidth: 180, render: row => formatDate(row.createdAt) },
        { key: 'amount', header: 'Số tiền', minWidth: 160, render: row => <strong>{formatVnd(row.amount)}</strong> },
        { key: 'bank', header: 'Ngân hàng', minWidth: 180, render: row => { const bank = bankAccounts.find(account => account.id === row.bankAccountId); return bank ? `${bank.bankCode} · •••• ${bank.accountNumber.slice(-4)}` : '—'; } },
        { key: 'status', header: 'Trạng thái', minWidth: 240, render: row => <Badge className={row.status === 'REJECTED' || row.status === 'FAILED' ? 'bg-danger-bg text-danger' : undefined} variant={row.status === 'PAID' ? 'success' : row.status === 'REJECTED' || row.status === 'FAILED' ? 'neutral' : 'caution'}>{PAYOUT_LABELS[row.status]}</Badge> },
        { key: 'paidAt', header: 'Đã chuyển', minWidth: 180, render: row => formatDate(row.paidAt) },
        { key: 'note', header: 'Ghi chú Admin', minWidth: 200, render: row => row.adminNote || '—' },
      ]} />
      <p className="text-xs text-muted-foreground">Cập nhật gần nhất: {formatDate(wallet?.updatedAt ?? null)}</p>
    </ContentPanel>
  </div>;
}

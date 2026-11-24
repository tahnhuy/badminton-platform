import type { Locator } from '@playwright/test';

export interface CreateUserPayload {
  email?: string;
  password?: string;
  role?: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  mustChangePassword?: boolean;
}

export interface CreatedUser {
  id: string;
  email: string;
  plainPassword: string;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  mustChangePassword: boolean;
}

export async function resetDatabase(): Promise<void> {
  const res = await fetch('http://localhost:3000/api/v1/test/reset', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reset test database: ${res.statusText}`);
  }
}

export async function createE2EUser(payload: CreateUserPayload = {}): Promise<CreatedUser> {
  const res = await fetch('http://localhost:3000/api/v1/test/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create test user: ${errorText}`);
  }

  return res.json();
}

export interface SeededCourt {
  facilityId: number;
  courtId: number;
  ownerId: number;
  ownerEmail: string;
  ownerPassword: string;
}

export async function seedCourt(): Promise<SeededCourt> {
  const res = await fetch('http://localhost:3000/api/v1/test/seed-court', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to seed court fixture: ${res.statusText}`);
  }
  return res.json();
}

/** Pick an option in the shared Radix Select: open the trigger, then click the option by its caller value. */
export async function chooseSelectOption(control: Locator, value: string): Promise<void> {
  await control.click();
  await control.page().locator(`[role="option"][data-value="${value}"]`).click();
}

export interface RegisterPlayerPayload {
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
  skillSurvey: { version: number; answers: Record<string, unknown> };
}

/** Test-only helper: starts registration, reads the fake-adapter OTP and verifies it. */
export async function registerPlayer(
  request: import('@playwright/test').APIRequestContext,
  payload: RegisterPlayerPayload
) {
  const pending = await request.post('/api/v1/auth/register', {
    data: {
      password: 'ValidPassword123!',
      fullName: 'E2E Player',
      withdrawalPin: '284691',
      withdrawalPinConfirm: '284691',
      ...payload,
    },
  });
  if (pending.status() !== 202) {
    throw new Error(`Registration start failed: ${pending.status()} ${await pending.text()}`);
  }
  const { data } = await pending.json();
  const otpResponse = await request.get(
    `/api/v1/test/latest-otp?email=${encodeURIComponent(payload.email.toLowerCase())}&template=REGISTER_OTP`
  );
  if (!otpResponse.ok()) {
    throw new Error(`No OTP for ${payload.email}: ${otpResponse.status()} ${await otpResponse.text()}`);
  }
  const { otp } = await otpResponse.json();
  return request.post('/api/v1/auth/register/verify', {
    data: { challengeId: data.challengeId, otp },
  });
}

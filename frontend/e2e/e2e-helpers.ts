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

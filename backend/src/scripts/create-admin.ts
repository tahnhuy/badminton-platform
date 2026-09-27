import '../shared/config/env';
import { authService } from '../modules/auth/auth.service';
import { pool } from '../db/client';

async function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => {
      resolve(input.replace(/[\r\n]+$/, ''));
    });
    process.stdin.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const email = process.argv[2];
  if (!email || !email.trim()) {
    console.error('Error: Email argument is required. Usage: npx tsx src/scripts/create-admin.ts <email>');
    process.exit(1);
  }

  const password = await readPasswordFromStdin();
  if (!password) {
    console.error('Error: Password must be provided via standard input.');
    process.exit(1);
  }

  try {
    const admin = await authService.createAdminAccount({
      email: email.trim(),
      password,
    });

    console.log(`Admin account created successfully with ID: ${admin.id}`);
  } catch (err: any) {
    console.error(`Failed to create admin account: ${err.message || 'Unknown error'}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message || 'Unknown error'}`);
  process.exit(1);
});

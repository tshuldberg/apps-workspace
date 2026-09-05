'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useWebLocalAuth } from '@/components/WebLocalAuthProvider';
import { WebAuthForm } from '@/components/AuthForm';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useWebLocalAuth();
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = useCallback(
    async (email: string, password: string) => {
      setError(undefined);

      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push('/');
      router.refresh();
    },
    [signIn, router],
  );

  return (
    <WebAuthForm
      mode="sign-in"
      onSubmit={handleSubmit}
      error={error}
      altLink={
        <span>
          Don't have an account?{' '}
          <Link href="/auth/sign-up" style={{ color: 'var(--text, #F4EDE2)' }}>
            Create one
          </Link>
        </span>
      }
    />
  );
}

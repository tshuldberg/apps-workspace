'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useWebLocalAuth } from '@/components/WebLocalAuthProvider';
import { WebAuthForm } from '@/components/AuthForm';

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useWebLocalAuth();
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setError(undefined);

      const result = await signUp(email, password, displayName);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push('/');
      router.refresh();
    },
    [signUp, router],
  );

  return (
    <WebAuthForm
      mode="sign-up"
      onSubmit={handleSubmit}
      error={error}
      altLink={
        <span>
          Already have an account?{' '}
          <Link href="/auth/sign-in" style={{ color: 'var(--text, #F4EDE2)' }}>
            Sign in
          </Link>
        </span>
      }
    />
  );
}

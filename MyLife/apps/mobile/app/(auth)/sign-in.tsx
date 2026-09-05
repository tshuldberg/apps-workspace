import { useCallback, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useLocalAuth } from '@mylife/auth';
import { AuthForm, colors, Text } from '@mylife/ui';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useLocalAuth();
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = useCallback(
    async (email: string, password: string) => {
      setError(undefined);

      const result = signIn(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace('/(hub)');
    },
    [signIn, router],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <AuthForm mode="sign-in" onSubmit={handleSubmit} error={error} />
      <View style={styles.altLink}>
        <Text variant="caption" color={colors.textTertiary}>
          Don't have an account?{' '}
        </Text>
        <Link href="/(auth)/sign-up">
          <Text variant="caption" color={colors.text}>
            Create one
          </Text>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 64,
  },
  altLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
});

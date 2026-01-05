import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { auth } from '../firebaseConfig';

export default function HomeScreen() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // ✅ AUTO ACCESS
        router.replace('/homepage');
      } else {
        setCheckingAuth(false); // show buttons
      }
    });

    return unsubscribe;
  }, []);

  // 🔄 Prevent flash on slower phones
  if (checkingAuth) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/login')}
      >
        <Text style={styles.buttonText}>LOG-IN</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/signup')}
      >
        <Text style={styles.buttonText}>SIGN-UP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: { width: 200, height: 200, marginBottom: 40 },
  button: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    width: '80%',
    borderRadius: 50,
    marginVertical: 10,
    alignItems: 'center',
    elevation: 2,
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import { Link, useRouter } from 'expo-router';
import { getAuth } from "firebase/auth";
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // If user is already logged in, redirect to homepage
        router.replace("/homepage");
      }
      // If no user, stay on landing page
    });

    return () => unsubscribe(); // clean up listener
  }, []);

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"/>
      
      {/* Buttons */}
      <Link href="/signup" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>SIGN-IN</Text>
        </TouchableOpacity>
      </Link>

      <Link href="/login" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>LOG-IN</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 80,
    borderRadius: 50,
    marginVertical: 10,
    elevation: 2,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
  },
});

import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import { auth } from '../firebaseConfig';

const LOGO_IMAGE = require("../assets/logo.png");

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Missing Fields", "Please enter username and password.");
            return;
        }

        setLoading(true);
        try {
            // Reconstruct email and trim whitespace
            const email = `${username.trim().toLowerCase()}@trackseat.com`; 
            await signInWithEmailAndPassword(auth, email, password);

            // Firebase handles persistence automatically. 
            // We just need to navigate.
        } catch (error: any) {
            console.error("Login failed:", error);
            Alert.alert("Login Failed", "Invalid username or password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />

            <TextInput
                style={styles.input}
                placeholder="USERNAME"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="PASSWORD"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            <TouchableOpacity 
                style={[styles.button, loading && { backgroundColor: '#ccc' }]} 
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SIGN IN</Text>}
            </TouchableOpacity>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Don't have an account? 
                    <Link href="/signup" style={styles.linkText}> 
                        <Text> SIGN UP</Text>
                    </Link>
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', padding: 20, justifyContent: 'center' },
    logo: { width: 150, height: 150, marginBottom: 20 },
    input: { width: '100%', padding: 15, borderRadius: 25, backgroundColor: '#f5f5f5', marginBottom: 15, fontSize: 16 },
    button: { width: '100%', backgroundColor: '#4dc3ff', padding: 15, borderRadius: 25, alignItems: 'center', marginTop: 10 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    footer: { marginTop: 30 },
    footerText: { fontSize: 14, color: '#666' },
    linkText: { color: '#4dc3ff', fontWeight: 'bold' }
});
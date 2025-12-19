import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import * as React from 'react';
import { useState } from 'react';
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth } from '../firebaseConfig';

const LOGO_IMAGE = require("../assets/logo.png"); // Ensure path is correct

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Missing Fields", "Please enter username and password.");
            return;
        }

        try {
            // Firebase uses email for sign-in, so we reconstruct the email
            const email = `${username}@trackseat.com`; 
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save login state and UID
            await AsyncStorage.setItem("user", JSON.stringify({ uid: user.uid }));
            await AsyncStorage.setItem("isLoggedIn", "true");

            // Navigate to the home page
            router.replace('/homepage');

        } catch (error: any) {
            console.error("Login failed:", error);
            Alert.alert("Login Failed", "Invalid username or password. Please try again.");
        }
    };

    return (
        <View style={styles.container}>
            <Image
                source={LOGO_IMAGE}
                style={styles.logo}
                resizeMode="contain"
            />

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

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>SIGN IN</Text>
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
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        padding: 20,
        justifyContent: 'center',
    },
    logo: {
        width: 150,
        height: 150,
        marginBottom: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
    },
    input: {
        width: '100%',
        padding: 15,
        borderRadius: 25,
        backgroundColor: '#f5f5f5',
        marginBottom: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#eee',
    },
    button: {
        width: '100%',
        backgroundColor: '#4dc3ff',
        padding: 15,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 30,
    },
    footerText: {
        fontSize: 14,
        color: '#666',
    },
    linkText: {
        color: '#4dc3ff',
        fontWeight: 'bold',
    }
});
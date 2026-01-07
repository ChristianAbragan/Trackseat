import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickProfilePic = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setProfilePic(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!fullName || !username || !password || !birthdate) {
      Alert.alert("Missing Fields", "Please fill all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const email = `${username.trim().toLowerCase()}@trackseat.com`;
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Calculate Age
      const birth = new Date(birthdate);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }

      // Save to Realtime Database
      await set(ref(db, "users/" + uid), {
        fullName,
        username,
        profileImage: profilePic || "",
        birthdate,
        age: calculatedAge,
        role: "user", 
        status: "checked-out",
        activeInApp: true,
      });

      
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.outerContainer}> 
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />

        <TextInput style={styles.input} placeholder="FULL NAME" value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="USERNAME" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="CONFIRM PASSWORD" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="BIRTHDATE (YYYY-MM-DD)" value={birthdate} onChangeText={setBirthdate} keyboardType="numeric" />

        <TouchableOpacity style={styles.uploadButton} onPress={pickProfilePic}>
          <Text style={styles.uploadText}>{profilePic ? "Profile Picture ✅" : "Upload Profile Picture"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, loading && { backgroundColor: '#ccc' }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SIGN UP</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: "#fff" },
  contentContainer: { alignItems: "center", padding: 20, paddingTop: 60 },
  logo: { width: 100, height: 100, marginBottom: 30 },
  input: { width: "100%", padding: 12, borderRadius: 20, backgroundColor: "#f5f5f5", marginBottom: 15 },
  button: { backgroundColor: "#4dc3ff", paddingVertical: 12, width: '100%', borderRadius: 20, marginTop: 10, alignItems: 'center' },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  uploadButton: { backgroundColor: "#ddd", padding: 12, borderRadius: 10, marginBottom: 15, width: "100%", alignItems: 'center' },
  uploadText: { color: "#333" },
});
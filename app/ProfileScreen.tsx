import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import { get, getDatabase, onValue, push, ref, serverTimestamp, update } from "firebase/database";
import { getStorage } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { app } from "../firebaseConfig";

const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app); 

type User = {
    uid: string;
    username?: string;
    fullName?: string;
    birthdate?: string;
    age?: number;
    profileImage?: string;
    role?: string;
    status?: string;
    activeInApp?: boolean;
};

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [fullName, setFullName] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [profileImage, setProfileImage] = useState<string | null>(null);
    
    // Report States
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportMessage, setReportMessage] = useState("");

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            if (!currentUser) {
                router.replace("/signup");
                return;
            }
            const userRef = ref(db, "users/" + currentUser.uid);
            const dbUnsubscribe = onValue(userRef, (snapshot) => { 
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setUser({ uid: currentUser.uid, ...data });
                    setFullName(data.fullName || "");
                    setBirthdate(data.birthdate || "");
                    setProfileImage(data.profileImage || null);
                }
                setLoading(false);
            });
            return () => { unsubscribe(); dbUnsubscribe(); }
        });
        return unsubscribe;
    }, []);

    // --- NEW: SUBMIT REPORT LOGIC ---
    const submitReport = async () => {
        if (!reportMessage.trim()) return Alert.alert("Empty", "Please enter a message.");
        
        try {
            // Check if user is on a bus to tag the report to a Bus ID
            const statusSnap = await get(ref(db, `users/${user?.uid}/status`));
            const currentStatus = statusSnap.val();
            let activeBusID = "Not On Board";

            if (currentStatus && typeof currentStatus === 'string' && currentStatus.startsWith('on-board-')) {
                activeBusID = currentStatus.split('-').pop() || "Unknown Bus";
            }

            await push(ref(db, "reports"), {
                reporterName: user?.fullName || "Anonymous",
                reporterID: user?.uid,
                message: reportMessage,
                busID: activeBusID,
                timestamp: serverTimestamp(),
                status: "Pending"
            });

            Alert.alert("Success", "Report sent to Admin.");
            setReportMessage("");
            setReportModalVisible(false);
        } catch (e) { 
            Alert.alert("Error", "Failed to send."); 
        }
    };

    const handleUpdate = async () => {
        if (!user) return;
        setLoading(true); 
        try {
            await update(ref(db, "users/" + user.uid), { fullName, birthdate });
            Alert.alert("Success", "Profile updated!");
            setEditing(false);
        } catch (e) { Alert.alert("Error", "Update failed."); }
        setLoading(false);
    };

    const handleSignOut = async () => {
        try {
            if (user) await update(ref(db, "users/" + user.uid), { activeInApp: false });
            await signOut(auth);
            await AsyncStorage.removeItem("user");
            await AsyncStorage.setItem("isLoggedIn", "false");
            router.replace("/");
        } catch (err: any) { Alert.alert("Error", err.message); }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007bff" /></View>;
    if (!user) return null;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Image source={{ uri: profileImage || "https://via.placeholder.com/120" }} style={styles.profileImage} />
            
            {editing ? (
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
            ) : (
                <Text style={styles.info}>Full Name: {user.fullName}</Text>
            )}

            <Text style={styles.info}>Username: {user.username}</Text>

            {editing ? (
                <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={birthdate} onChangeText={setBirthdate} />
            ) : (
                <Text style={styles.info}>Birthdate: {user.birthdate || "N/A"}</Text>
            )}
            <Text style={styles.info}>Age: {user.age ?? "N/A"}</Text>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: editing ? "green" : "#007bff" }]} onPress={() => editing ? handleUpdate() : setEditing(true)}>
                <Text style={styles.saveBtnText}>{editing ? "Save Changes" : "Edit Profile"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#555" }]} onPress={handleSignOut}>
                <Text style={styles.saveBtnText}>Sign Out</Text>
            </TouchableOpacity>

            {/* --- NEW: REPORT BUTTON --- */}
            <TouchableOpacity 
                style={styles.smallReportBtn} 
                onPress={() => setReportModalVisible(true)}
            >
                <Text style={styles.smallReportText}>Report a Problem</Text>
            </TouchableOpacity>

            {/* --- NEW: REPORT MODAL --- */}
            <Modal visible={reportModalVisible} transparent={true} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setReportModalVisible(false)}>
                    <View style={styles.reportPopup}>
                        <Text style={styles.popupTitle}>Report an Issue</Text>
                        <TextInput 
                            style={styles.popupInput} 
                            placeholder="Describe the problem (e.g., driver speeding, bus is dirty...)" 
                            multiline 
                            numberOfLines={4}
                            value={reportMessage}
                            onChangeText={setReportMessage}
                        />
                        <View style={styles.popupActionRow}>
                            <TouchableOpacity style={[styles.popupButton, {backgroundColor: '#ccc'}]} onPress={() => setReportModalVisible(false)}>
                                <Text>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.popupButton, {backgroundColor: '#dc3545'}]} onPress={submitReport}>
                                <Text style={{color: 'white', fontWeight: 'bold'}}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, alignItems: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    profileImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 15 },
    info: { width: "100%", fontSize: 16, marginBottom: 10, padding: 12, backgroundColor: "#f0f0f0", borderRadius: 10 },
    input: { width: "100%", padding: 12, borderRadius: 10, borderColor: "#ccc", borderWidth: 1, marginBottom: 10 },
    saveBtn: { padding: 12, borderRadius: 10, marginTop: 15, width: "100%", alignItems: "center" },
    saveBtnText: { color: "#fff", fontWeight: "bold" },
    
    // Report Styles
    smallReportBtn: { marginTop: 30, padding: 8 },
    smallReportText: { color: "#dc3545", textDecorationLine: 'underline', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    reportPopup: { width: '85%', backgroundColor: 'white', borderRadius: 15, padding: 20, elevation: 10 },
    popupTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    popupInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', backgroundColor: '#fafafa' },
    popupActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 10 },
    popupButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 }
});
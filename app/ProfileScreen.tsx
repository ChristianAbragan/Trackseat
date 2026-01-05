import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import { get, getDatabase, onValue, push, ref, serverTimestamp, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { app } from "../firebaseConfig";

const auth = getAuth(app);
const db = getDatabase(app);

type User = {
    uid: string;
    username?: string;
    fullName?: string;
    birthdate?: string;
    age?: number;
    profileImage?: string;
    role?: string;
};

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [fullName, setFullName] = useState("");
    const [birthdate, setBirthdate] = useState("");
    
    // States for Passenger Stat
    const [passengerStat, setPassengerStat] = useState(0);

    // Report States
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportMessage, setReportMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // DYNAMIC AVATAR GENERATOR: Uses an external API to create initials based on user name
    // This replaces the need for Firebase Storage.
    const avatarUrl = user?.fullName 
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=343253&color=fff&size=128&font-size=0.33`
        : "https://via.placeholder.com/150";

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            if (!currentUser) {
                router.replace("/signup");
                return;
            }
            const userRef = ref(db, "users/" + currentUser.uid);
            onValue(userRef, (snapshot) => { 
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setUser({ uid: currentUser.uid, ...data });
                    setFullName(data.fullName || "");
                    setBirthdate(data.birthdate || "");
                    
                    if(data.boardingHistory) {
                        setPassengerStat(Object.keys(data.boardingHistory).length);
                    }
                }
                setLoading(false);
            });
        });
        return unsubscribe;
    }, []);

    const submitReport = async () => {
        if (!reportMessage.trim()) return Alert.alert("Empty", "Please enter a message.");
        setIsSubmitting(true);
        try {
            const statusSnap = await get(ref(db, `users/${user?.uid}/status`));
            const currentStatus = statusSnap.val();
            let activeBusID = (currentStatus && typeof currentStatus === 'string' && currentStatus.startsWith('on-board-')) 
                ? currentStatus.split('-').pop() : "Not On Board";

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
        } catch (e: any) { Alert.alert("Error", e.message); } finally { setIsSubmitting(false); }
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

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#343253" /></View>;
    if (!user) return null;

    return (
        <ScrollView style={styles.main}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => editing ? handleUpdate() : setEditing(true)}>
                   <Text style={{color: editing ? 'green' : '#007bff', fontWeight: 'bold'}}>{editing ? "Save" : "Edit"}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.profileHeader}>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
                </View>
                <Text style={styles.nameText}>{user.fullName}</Text>
                <Text style={styles.usernameSub}>@{user.username}</Text>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{passengerStat}</Text>
                    <Text style={styles.statLabel}>Total Trips</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{user.role === 'driver' ? 'Driver' : 'User'}</Text>
                    <Text style={styles.statLabel}>Rank</Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionLabel}>Personal Information</Text>
                
                <View style={styles.infoTile}>
                    <Text style={styles.tileLabel}>Full Name</Text>
                    {editing ? (
                        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholderTextColor="#888" />
                    ) : (
                        <Text style={styles.tileValue}>{user.fullName}</Text>
                    )}
                </View>

                <View style={styles.infoTile}>
                    <Text style={styles.tileLabel}>Birthdate</Text>
                    {editing ? (
                        <TextInput style={styles.input} value={birthdate} onChangeText={setBirthdate} placeholder="YYYY-MM-DD" />
                    ) : (
                        <Text style={styles.tileValue}>{user.birthdate || "N/A"}</Text>
                    )}
                </View>

                <View style={styles.infoTile}>
                    <Text style={styles.tileLabel}>Age</Text>
                    <Text style={styles.tileValue}>{user.age ?? "N/A"} Years Old</Text>
                </View>

                <TouchableOpacity style={styles.reportBtn} onPress={() => setReportModalVisible(true)}>
                    <Ionicons name="warning-outline" size={20} color="#dc3545" />
                    <Text style={styles.reportBtnText}>Report a Problem</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
                    <Text style={styles.logoutBtnText}>SIGN OUT</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={reportModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Report Problem</Text>
                            <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>
                        
                        <TextInput
                            style={styles.textArea}
                            multiline
                            numberOfLines={5}
                            placeholder="Describe the issue you encountered..."
                            value={reportMessage}
                            onChangeText={setReportMessage}
                            placeholderTextColor="#999"
                        />

                        <TouchableOpacity 
                            style={[styles.submitBtn, isSubmitting && {opacity: 0.7}]} 
                            onPress={submitReport}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Report</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    main: { flex: 1, backgroundColor: "#FFFFFF" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
    profileHeader: { alignItems: 'center', marginVertical: 10 },
    imageContainer: { padding: 4, backgroundColor: '#f0f0f0', borderRadius: 70, elevation: 3 },
    profileImage: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#343253' },
    nameText: { fontSize: 24, fontWeight: 'bold', color: '#000', marginTop: 10 },
    usernameSub: { fontSize: 14, color: '#777' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 25, backgroundColor: '#f8f9fa', padding: 20, borderRadius: 20, marginVertical: 15 },
    statBox: { alignItems: 'center' },
    statNum: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    statLabel: { fontSize: 12, color: '#888' },
    content: { paddingHorizontal: 25 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#aaa', textTransform: 'uppercase', marginBottom: 15 },
    infoTile: { backgroundColor: '#F9F9F9', padding: 15, borderRadius: 15, marginBottom: 10 },
    tileLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
    tileValue: { fontSize: 16, color: '#000', fontWeight: '600' },
    input: { fontSize: 16, color: '#000', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 5 },
    reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, padding: 10 },
    reportBtnText: { color: "#dc3545", fontWeight: "bold", marginLeft: 8 },
    logoutBtn: { backgroundColor: "#333", padding: 18, borderRadius: 15, marginTop: 10, alignItems: "center", marginBottom: 50 },
    logoutBtnText: { color: "#fff", fontWeight: "bold" },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    textArea: { backgroundColor: '#f0f0f0', borderRadius: 15, padding: 15, height: 120, textAlignVertical: 'top', color: '#000', fontSize: 16, marginBottom: 20 },
    submitBtn: { backgroundColor: '#dc3545', padding: 16, borderRadius: 15, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
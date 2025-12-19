import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"; // Added MaterialCommunityIcons
import { useFocusEffect } from '@react-navigation/native';
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { get, getDatabase, onValue, ref, remove, runTransaction, update } from "firebase/database";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Image,
    Modal, // Added
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { app } from "../firebaseConfig";

const BUS_ICON = require("../assets/Bus1.png"); 
const LOGO_IMG = require("../assets/TRACKSEAT.png"); 
const FARE_IMG = require("../assets/fair.png"); // Added: Ensure this file exists in assets

// ... [Interface and OROTSCO_STOPS data remains exactly the same] ...
interface User { id: string; fullName: string; busID: string; role: 'driver' | 'conductor'; }
type BusData = { id: string; latitude: number; longitude: number; available_seats: number; passenger_count: number; route: string; status: string; color: string; capacity: number; plate?: string; };
const OROTSCO_STOPS = [ { id: 's1', name: "Stop 1", latitude: 8.473104, longitude: 124.695549 }, { id: 's2', name: "Stop 2", latitude: 8.474451, longitude: 124.685952 }, { id: 's3', name: "Stop 3", latitude: 8.475694, longitude: 124.679254 }, { id: 's4', name: "Stop 4", latitude: 8.479671, longitude: 124.672420 }, { id: 's5', name: "Stop 5", latitude: 8.482522, longitude: 124.665288 }, { id: 's6', name: "Stop 6", latitude: 8.483297, longitude: 124.661882 }, { id: 's7', name: "Stop 7", latitude: 8.484162, longitude: 124.658058 }, { id: 's8', name: "Stop 8", latitude: 8.484958, longitude: 124.654564 }, { id: 's9', name: "Stop 9", latitude: 8.485655, longitude: 124.651303 }, { id: 's10', name: "Stop 10", latitude: 8.486467, longitude: 124.647317 }, { id: 's11', name: "Stop 11", latitude: 8.489387, longitude: 124.637887 }, { id: 's12', name: "Stop 12", latitude: 8.500167, longitude: 124.628138 }, { id: 's13', name: "Stop 13", latitude: 8.504340, longitude: 124.624529 }, { id: 's14', name: "Stop 14", latitude: 8.504285, longitude: 124.617997 }, { id: 's15', name: "Stop 15", latitude: 8.504229, longitude: 124.616685 }, { id: 's16', name: "Stop 16", latitude: 8.504195, longitude: 124.614898 }, { id: 's17', name: "Stop 17", latitude: 8.504154, longitude: 124.613224 }, { id: 's18', name: "Stop 18", latitude: 8.503892, longitude: 124.609624 }, { id: 's19', name: "Stop 19", latitude: 8.503685, longitude: 124.607363 }, { id: 's20', name: "Stop 20", latitude: 8.503402, longitude: 124.603450 }, { id: 's21', name: "Stop 21", latitude: 8.503211, longitude: 124.599320 }, { id: 's22', name: "Stop 22", latitude: 8.503142, longitude: 124.595878 }, { id: 's23', name: "Stop 23", latitude: 8.505551, longitude: 124.591880 }, { id: 's24', name: "Stop 24", latitude: 8.506895, longitude: 124.590465 }, { id: 's25', name: "Stop 25", latitude: 8.509314, longitude: 124.587880 }, { id: 's26', name: "Stop 26 (Turnaround)", latitude: 8.511726, longitude: 124.585276 }, ];
const BUS_CAPACITY = 40; 

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'running': return '#28a745';
        case 'offline': case 'checked-out': return '#dc3545'; 
        case 'stopped': return '#ffc107';
        default: return '#007bff';
    }
};

const StatusPill = ({ status }: { status: string }) => (
    <View style={[styles.statusPill, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.statusText}>{status.toUpperCase()}</Text>
    </View>
);

export default function HomeScreen() {
    const router = useRouter();
    const [selectedBus, setSelectedBus] = useState<BusData | null>(null); 
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [onBoard, setOnBoard] = useState(false);
    const [mapKey, setMapKey] = useState(1);
    const [showDetailedMarkers, setShowDetailedMarkers] = useState(true); 
    const [personnel, setPersonnel] = useState<User[]>([]); 
    const [busLocations, setBusLocations] = useState<BusData[]>([]); 
    const [showTrafficInfo, setShowTrafficInfo] = useState(false);
    const [fareModalVisible, setFareModalVisible] = useState(false); // NEW STATE

    const auth = getAuth(app); 
    const db = getDatabase(app);

    // ... [Existing useFocusEffect and all useEffects remain exactly the same] ...
    useFocusEffect(useCallback(() => { setMapKey(prev => prev + 1); return () => {}; }, []));

    useEffect(() => {
        const usersRef = ref(db, "users");
        const unsubscribe = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const userList: User[] = Object.keys(data).filter(uid => data[uid].busID).map(uid => ({ id: uid, fullName: data[uid].fullName, busID: data[uid].busID, role: data[uid].role, }));
                setPersonnel(userList);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                onValue(ref(db, `users/${currentUser.uid}/status`), (snap) => {
                    const status = snap.val();
                    setOnBoard(typeof status === 'string' && status.startsWith('on-board-'));
                }, { onlyOnce: true });
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const busRef = ref(db, 'buses');
        const unsubscribe = onValue(busRef, (snapshot) => {
            if (snapshot.exists()) {
                const busesObject = snapshot.val();
                const busArray: BusData[] = Object.keys(busesObject).map((key) => {
                    const bus = busesObject[key];
                    return { id: key, latitude: bus.latitude || 0, longitude: bus.longitude || 0, available_seats: bus.available_seats ?? BUS_CAPACITY, passenger_count: bus.passenger_count || 0, route: bus.route || "N/A", status: bus.status || "Offline", capacity: bus.capacity || BUS_CAPACITY, plate: bus.plate || "N/A", } as BusData;
                }).filter(bus => bus.latitude !== 0 && bus.longitude !== 0); 
                setBusLocations(busArray);
                if (selectedBus) {
                    const updatedBus = busArray.find(b => b.id === selectedBus.id);
                    if (updatedBus) setSelectedBus(updatedBus);
                }
            } else { setBusLocations([]); }
        });
        return () => unsubscribe(); 
    }, [selectedBus]);
    
    useEffect(() => {
        let subscriber: Location.LocationSubscription;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") return;
            subscriber = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (location) => {
                setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude, });
            });
        })();
        return () => { if (subscriber) subscriber.remove(); };
    }, []); 

    const isNearBus = () => { 
        if (!userLocation || !selectedBus) return false;
        const R = 6371000; 
        const dLat = ((selectedBus.latitude - userLocation.latitude) * Math.PI) / 180;
        const dLon = ((selectedBus.longitude - userLocation.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos((userLocation.latitude * Math.PI) / 180) * Math.cos((selectedBus.latitude * Math.PI) / 180);
        return (2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) <= 20; 
    };
    
    const handleOnBoard = useCallback(async () => {
        if (!selectedBus || !auth.currentUser) return;
        if (!isNearBus()) { Alert.alert("Too Far", "You must be within 20 meters to board."); return; }
        try {
            await runTransaction(ref(db, `buses/${selectedBus.id}`), (current) => {
                if (current) { current.passenger_count = (current.passenger_count || 0) + 1; current.available_seats = (current.available_seats || BUS_CAPACITY) - 1; }
                return current;
            });
            await update(ref(db, `users/${auth.currentUser.uid}`), { status: `on-board-${selectedBus.id}` });
            setOnBoard(true);
        } catch (error) { Alert.alert("Error", "Failed to board."); }
    }, [auth.currentUser, db, isNearBus, selectedBus]);
    
    const handleCheckOut = useCallback(async () => {
        if (!auth.currentUser) return;
        try {
            const snap = await get(ref(db, `users/${auth.currentUser.uid}/status`));
            const status = snap.val();
            await update(ref(db, `users/${auth.currentUser.uid}`), { status: `checked-out` });
            if (status?.startsWith('on-board-')) { await remove(ref(db, `bus_passengers/${status.split('-').pop()}/${auth.currentUser.uid}`)); }
            setOnBoard(false);
        } catch (error) { Alert.alert("Error", "Failed to check out."); }
    }, [auth.currentUser, db]);

    const getPersonnelNames = () => {
        const drv = personnel.find(u => u.busID === selectedBus?.id && u.role === 'driver');
        const cnd = personnel.find(u => u.busID === selectedBus?.id && u.role === 'conductor');
        return { driverName: drv?.fullName || "N/A", conductorName: cnd?.fullName || "N/A" };
    };
    const { driverName, conductorName } = getPersonnelNames();

    return (
        <View style={styles.container}>
            <MapView
                key={mapKey} 
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{ latitude: 8.4850, longitude: 124.6450, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                showsTraffic={true}
                onRegionChangeComplete={(r) => setShowDetailedMarkers(r.latitudeDelta < 0.05)} 
            >
                {userLocation && !onBoard && (
                    <Marker coordinate={userLocation}>
                        <View style={styles.userMarker}><View style={styles.userLocationDot} /></View>
                    </Marker>
                )}
                {showDetailedMarkers && (
                    <>
                        {OROTSCO_STOPS.map((stop) => (
                            <Marker key={stop.id} coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}>
                                <View style={styles.stopDot} />
                            </Marker>
                        ))}
                        {busLocations.map((bus) => (
                            <Marker key={bus.id} coordinate={{ latitude: bus.latitude, longitude: bus.longitude }} onPress={() => setSelectedBus(selectedBus?.id === bus.id ? null : bus)}>
                                <Image source={BUS_ICON} style={[styles.busIcon]} />
                            </Marker>
                        ))}
                    </>
                )}
            </MapView>

            <View style={styles.floatingHeader}>
                <Image source={LOGO_IMG} style={styles.logo} resizeMode="contain" />
                <TouchableOpacity onPress={() => router.push("/ProfileScreen")}>
                    <Ionicons name="person-circle-outline" size={32} color="white" />
                </TouchableOpacity>
            </View>

            {/* FLOATING ACTION BUTTONS (TRAFFIC & FARE) */}
            <View style={styles.trafficToggleContainer}>
                <TouchableOpacity style={styles.iconButton} onPress={() => setFareModalVisible(true)}>
                    <MaterialCommunityIcons name="cash-multiple" size={30} color="#28a745" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setShowTrafficInfo(!showTrafficInfo)}>
                    <Ionicons name="information-circle-outline" size={30} color="#007bff" />
                </TouchableOpacity>
            </View>

            {/* INFO BOX FOR SELECTED BUS */}
            {selectedBus && (
                <View style={styles.infoBox}>
                    <View style={styles.infoBoxHeader}>
                        <Text style={styles.busTitle}>Bus: {selectedBus.id}</Text>
                        <StatusPill status={selectedBus.status} />
                    </View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Plate:</Text><Text style={styles.detailValue}>{selectedBus.plate}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Route:</Text><Text style={styles.detailValue}>{selectedBus.route}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Driver:</Text><Text style={styles.detailValue}>{driverName}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Conductor:</Text><Text style={styles.detailValue}>{conductorName}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Count:</Text><Text style={styles.detailValue}>{selectedBus.passenger_count} / {selectedBus.capacity}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Seats:</Text><Text style={[styles.detailValue, { color: selectedBus.available_seats > 5 ? 'green' : 'red' }]}>{selectedBus.available_seats}</Text></View>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: onBoard ? "#dc3545" : "#28a745" }]} onPress={onBoard ? handleCheckOut : handleOnBoard}>
                        <Text style={styles.actionButtonText}>{onBoard ? "CHECK OUT" : "ON BOARD"}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* FARE MODAL POPUP */}
            <Modal visible={fareModalVisible} transparent={true} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setFareModalVisible(false)}>
                    <View style={styles.fareModalContent}>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setFareModalVisible(false)}>
                            <Ionicons name="close-circle" size={35} color="#dc3545" />
                        </TouchableOpacity>
                        <Image source={FARE_IMG} style={styles.fareImage} resizeMode="contain" />
                    </View>
                </Pressable>
            </Modal>

            {/* TRAFFIC LEGEND */}
            {showTrafficInfo && (
                <View style={styles.trafficInfoBox}>
                    <Text style={styles.trafficText}>🟢 Not Traffic</Text>
                    <Text style={styles.trafficText}>🟡 Moderate</Text>
                    <Text style={styles.trafficText}>🔴 Traffic</Text>
                    <Text style={styles.trafficText}>🟣 Super Traffic</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    floatingHeader: { position: "absolute", top: 20, left: 15, right: 15, height: 60, backgroundColor: "#343253ff", borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, elevation: 10, zIndex: 100 },
    logo: { width: 140, height: 40 },
    busIcon: { width: 30, height: 30, resizeMode: 'contain', backgroundColor: '#35dc6dff', borderRadius: 5 },
    stopDot: { width: 10, height: 10, borderRadius: 1, backgroundColor: '#dc3545', borderWidth: 1, borderColor: '#000000ff' },
    userMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0, 123, 255, 0.4)", justifyContent: "center", alignItems: "center" },
    userLocationDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00ff40ff', borderWidth: 2, borderColor: 'white' },
    infoBox: { position: "absolute", bottom: 20, left: 10, right: 10, backgroundColor: "white", padding: 15, borderRadius: 8, elevation: 8 },
    infoBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
    busTitle: { fontSize: 20, fontWeight: "bold" },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15 },
    statusText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    detailLabel: { fontSize: 15, color: '#6c757d' },
    detailValue: { fontSize: 15, fontWeight: '600' },
    actionButton: { marginTop: 15, paddingVertical: 12, borderRadius: 5, alignItems: "center" },
    actionButtonText: { color: "#fff", fontWeight: "bold" },
    trafficToggleContainer: { position: "absolute", top: 100, right: 25, gap: 15 },
    iconButton: { backgroundColor: "white", borderRadius: 50, padding: 8, elevation: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    fareModalContent: { width: '95%', backgroundColor: 'white', borderRadius: 15, padding: 10, alignItems: 'center' },
    fareImage: { width: '100%', height: 500 },
    closeBtn: { alignSelf: 'flex-end', marginBottom: 5 },
    trafficInfoBox: { position: 'absolute', top: 165, right: 70, padding: 12, backgroundColor: "white", borderRadius: 8, elevation: 5, borderLeftWidth: 4, borderLeftColor: '#355272ff' },
    trafficText: { fontSize: 14, color: "#333", marginVertical: 2 },
});
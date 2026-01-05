import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from '@react-navigation/native';
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { get, getDatabase, onValue, ref, remove, runTransaction, update } from "firebase/database";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
    Alert,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    FlatList,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { app } from "../firebaseConfig";

const BUS_ICON = require("../assets/Bus1.png"); 
const LOGO_IMG = require("../assets/TRACKSEAT.png"); 
const FARE_IMG = require("../assets/fair.png");

interface User { id: string; fullName: string; busID: string; role: 'driver' | 'conductor'; }
type BusData = { id: string; latitude: number; longitude: number; available_seats: number; passenger_count: number; route: string; status: string; color: string; capacity: number; plate?: string; last_seen?: number; };

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

export default function HomeScreen() {
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const [selectedBus, setSelectedBus] = useState<BusData | null>(null); 
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [onBoard, setOnBoard] = useState(false);
    const [mapKey, setMapKey] = useState(1);
    const [showDetailedMarkers, setShowDetailedMarkers] = useState(true); 
    const [personnel, setPersonnel] = useState<User[]>([]); 
    const [busLocations, setBusLocations] = useState<BusData[]>([]); 
    const [showTrafficInfo, setShowTrafficInfo] = useState(false);
    const [fareModalVisible, setFareModalVisible] = useState(false);
    const [busListVisible, setBusListVisible] = useState(false);

    const auth = getAuth(app); 
    const db = getDatabase(app);

    useFocusEffect(useCallback(() => { setMapKey(prev => prev + 1); return () => {}; }, []));

    useEffect(() => {
        const usersRef = ref(db, "users");
        onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const userList: User[] = Object.keys(data).filter(uid => data[uid].busID).map(uid => ({ id: uid, fullName: data[uid].fullName, busID: data[uid].busID, role: data[uid].role, }));
                setPersonnel(userList);
            }
        });
    }, []);

    useEffect(() => {
        auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                onValue(ref(db, `users/${currentUser.uid}/status`), (snap) => {
                    const status = snap.val();
                    setOnBoard(typeof status === 'string' && status.startsWith('on-board-'));
                }, { onlyOnce: true });
            }
        });
    }, []);

    // MAIN FIREBASE LISTENER: Fixes infinite loop and offline ghosting
    useEffect(() => {
        const busRef = ref(db, 'buses');
        const unsubscribe = onValue(busRef, (snapshot) => {
            if (snapshot.exists()) {
                const busesObject = snapshot.val();
                const now = Date.now();

                const busArray: BusData[] = Object.keys(busesObject).map((key) => {
                    const bus = busesObject[key];
                    
                    // HEARTBEAT LOGIC: If last_seen is older than 60 seconds, it's Offline
                    const isTimedOut = !bus.last_seen || (now - bus.last_seen > 60000);
                    const finalStatus = isTimedOut ? "Offline" : (bus.status || "Offline");

                    return { 
                        id: key, 
                        latitude: bus.latitude || 0, 
                        longitude: bus.longitude || 0, 
                        available_seats: bus.available_seats ?? BUS_CAPACITY, 
                        passenger_count: bus.passenger_count || 0, 
                        route: bus.route || "N/A", 
                        status: finalStatus, 
                        capacity: bus.capacity || BUS_CAPACITY, 
                        plate: bus.plate || "N/A", 
                    } as BusData;
                }).filter(bus => bus.latitude !== 0); 
                
                setBusLocations(busArray);

                // FIXED: Only update selectedBus if data actually changed to stop the loop
                if (selectedBus) {
                    const updated = busArray.find(b => b.id === selectedBus.id);
                    if (updated && (updated.status !== selectedBus.status || updated.available_seats !== selectedBus.available_seats)) {
                        setSelectedBus(updated);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [selectedBus?.id]); // Only watch the ID to prevent the depth error

    useEffect(() => {
        Location.requestForegroundPermissionsAsync().then(({status}) => {
            if (status === 'granted') {
                Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (location) => {
                    setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
                });
            }
        });
    }, []); 

    const isNearBus = () => { 
        if (!userLocation || !selectedBus) return false;
        const R = 6371000; 
        const dLat = ((selectedBus.latitude - userLocation.latitude) * Math.PI) / 180;
        const dLon = ((selectedBus.longitude - userLocation.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos((userLocation.latitude * Math.PI) / 180) * Math.cos((selectedBus.latitude * Math.PI) / 180);
        return (2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) <= 20; 
    };
    
    const handleOnBoard = async () => {
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
    };
    
    const handleCheckOut = async () => {
        if (!auth.currentUser) return;
        try {
            const snap = await get(ref(db, `users/${auth.currentUser.uid}/status`));
            const status = snap.val();
            await update(ref(db, `users/${auth.currentUser.uid}`), { status: `checked-out` });
            if (status?.startsWith('on-board-')) { await remove(ref(db, `bus_passengers/${status.split('-').pop()}/${auth.currentUser.uid}`)); }
            setOnBoard(false);
        } catch (error) { Alert.alert("Error", "Failed to check out."); }
    };

    const getPersonnelNames = () => {
        const drv = personnel.find(u => u.busID === selectedBus?.id && u.role === 'driver');
        const cnd = personnel.find(u => u.busID === selectedBus?.id && u.role === 'conductor');
        return { driverName: drv?.fullName || "N/A", conductorName: cnd?.fullName || "N/A" };
    };
    const { driverName, conductorName } = getPersonnelNames();

    const snapToBus = (bus: BusData) => {
        setSelectedBus(bus);
        setBusListVisible(false);
        mapRef.current?.animateToRegion({
            latitude: bus.latitude,
            longitude: bus.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }, 1000);
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
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
                {showDetailedMarkers && OROTSCO_STOPS.map((stop) => (
                    <Marker key={stop.id} coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}>
                        <View style={styles.stopDot} />
                    </Marker>
                ))}
                {busLocations.map((bus) => (
                    <Marker key={bus.id} coordinate={{ latitude: bus.latitude, longitude: bus.longitude }} onPress={() => setSelectedBus(bus)}>
                        <Image source={BUS_ICON} style={styles.busMarkerIcon} />
                    </Marker>
                ))}
            </MapView>

            <View style={styles.floatingHeader}>
                <Image source={LOGO_IMG} style={styles.logo} resizeMode="contain" />
                <TouchableOpacity onPress={() => router.push("/ProfileScreen")}>
                    <Ionicons name="person-circle" size={35} color="white" />
                </TouchableOpacity>
            </View>

            <View style={styles.fabStack}>
                <TouchableOpacity style={[styles.fab, {backgroundColor: '#007bff'}]} onPress={() => setBusListVisible(true)}>
                    <MaterialCommunityIcons name="bus-multiple" size={26} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.fab} onPress={() => setFareModalVisible(true)}>
                    <MaterialCommunityIcons name="cash-multiple" size={26} color="#28a745" />
                </TouchableOpacity>
                
                {/* Traffic Button and Attached Legend */}
                <View style={{alignItems: 'flex-end'}}>
                    <TouchableOpacity style={styles.fab} onPress={() => setShowTrafficInfo(!showTrafficInfo)}>
                        <Ionicons name="information-circle" size={26} color={showTrafficInfo ? "#007bff" : "#666"} />
                    </TouchableOpacity>
                    {showTrafficInfo && (
                        <View style={styles.trafficLegend}>
                            <Text style={styles.legendTitle}>Live Traffic Status</Text>
                            <View style={styles.legendRow}><View style={[styles.dot, {backgroundColor: '#2ecc71'}]}/><Text style={styles.legendText}>Smooth / No Traffic</Text></View>
                            <View style={styles.legendRow}><View style={[styles.dot, {backgroundColor: '#f1c40f'}]}/><Text style={styles.legendText}>Moderate</Text></View>
                            <View style={styles.legendRow}><View style={[styles.dot, {backgroundColor: '#e67e22'}]}/><Text style={styles.legendText}>Heavy Traffic</Text></View>
                            <View style={styles.legendRow}><View style={[styles.dot, {backgroundColor: '#e74c3c'}]}/><Text style={styles.legendText}>Super Traffic</Text></View>
                        </View>
                    )}
                </View>
            </View>

            {selectedBus && (
                <View style={styles.bottomInfoCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.busTitle}>Bus {selectedBus.id}</Text>
                        <View style={[styles.statusPill, { backgroundColor: getStatusColor(selectedBus.status) }]}>
                            <Text style={styles.statusText}>{selectedBus.status.toUpperCase()}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.detailRow}><Text style={styles.label}>Plate:</Text><Text style={styles.value}>{selectedBus.plate}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.label}>Route:</Text><Text style={styles.value}>{selectedBus.route}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.label}>Driver:</Text><Text style={styles.value}>{driverName}</Text></View>

                    {/* SEATS FORMATTED AS 2/40 */}
                    <View style={styles.detailRow}>
                        <Text style={styles.label}>Availability:</Text>
                        <Text style={[styles.value, {color: selectedBus.status === 'Offline' ? '#888' : '#28a745'}]}>
                            {selectedBus.available_seats}/{selectedBus.capacity || 40}
                        </Text>
                    </View>

                    <TouchableOpacity 
                        disabled={selectedBus.status === 'Offline'}
                        style={[styles.actionButton, { backgroundColor: onBoard ? "#dc3545" : "#28a745", opacity: selectedBus.status === 'Offline' ? 0.5 : 1 }]} 
                        onPress={onBoard ? handleCheckOut : handleOnBoard}
                    >
                        <Text style={styles.actionButtonText}>{onBoard ? "CHECK OUT" : "ON BOARD"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedBus(null)} style={{marginTop: 10, alignSelf:'center'}}><Text style={{color: '#888'}}>Dismiss</Text></TouchableOpacity>
                </View>
            )}

            <Modal visible={busListVisible} animationType="slide" transparent={true}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.sheet}>
                        <Text style={styles.sheetTitle}>Buses Online</Text>
                        <FlatList
                            data={busLocations}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.listItem} onPress={() => snapToBus(item)}>
                                    <View style={[styles.activeDot, { backgroundColor: item.status.toLowerCase() === 'offline' ? '#ccc' : '#28a745' }]} />
                                    <View style={styles.listIcon}><Ionicons name="bus" size={20} color="white" /></View>
                                    <View><Text style={styles.listBusID}>Bus {item.id}</Text><Text style={styles.listRoute}>{item.route}</Text></View>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.closeSheetBtn} onPress={() => setBusListVisible(false)}><Text style={{color: 'white', fontWeight: 'bold'}}>CLOSE</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={fareModalVisible} transparent={true} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setFareModalVisible(false)}>
                    <View style={styles.fareModalContent}>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setFareModalVisible(false)}><Ionicons name="close-circle" size={35} color="#dc3545" /></TouchableOpacity>
                        <Image source={FARE_IMG} style={styles.fareImage} resizeMode="contain" />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { flex: 1 },
    floatingHeader: { position: "absolute", top: 40, left: 15, right: 15, height: 65, backgroundColor: "#343253", borderRadius: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, elevation: 10 },
    logo: { width: 130, height: 40 },
    busMarkerIcon: { width: 35, height: 35, resizeMode: 'contain' },
    fabStack: { position: "absolute", top: 120, right: 20, gap: 12 },
    fab: { backgroundColor: "white", width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', elevation: 8 },
    // Corrected Traffic Legend Positioning
    trafficLegend: { position: 'absolute', top: 0, right: 65, padding: 12, backgroundColor: "white", borderRadius: 15, elevation: 5, borderLeftWidth: 5, borderLeftColor: '#343253', width: 150 },
    legendTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 5, color: '#000' },
    legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    legendText: { fontSize: 11, color: '#333' },
    bottomInfoCard: { position: "absolute", bottom: 20, left: 15, right: 15, backgroundColor: "white", padding: 20, borderRadius: 20, elevation: 15 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    busTitle: { fontSize: 22, fontWeight: "bold", color: '#000' },
    statusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15 },
    statusText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    label: { fontSize: 15, color: '#666' },
    value: { fontSize: 15, fontWeight: '700', color: '#000' },
    actionButton: { marginTop: 15, paddingVertical: 14, borderRadius: 12, alignItems: "center", elevation: 4 },
    actionButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '60%' },
    sheetTitle: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 20 },
    listItem: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
    activeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    listIcon: { backgroundColor: '#007bff', padding: 10, borderRadius: 12, marginRight: 15 },
    listBusID: { fontWeight: 'bold', fontSize: 16, color: '#000' },
    listRoute: { color: '#888', fontSize: 13 },
    closeSheetBtn: { backgroundColor: '#333', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 15 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    fareModalContent: { width: '95%', backgroundColor: 'white', borderRadius: 20, padding: 15 },
    fareImage: { width: '100%', height: 450 },
    closeBtn: { alignSelf: 'flex-end' },
    userMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0, 123, 255, 0.2)", justifyContent: "center", alignItems: "center" },
    userLocationDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#007bff', borderWidth: 3, borderColor: 'white' },
    stopDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#dc3545', borderWidth: 1, borderColor: '#fff' }
});
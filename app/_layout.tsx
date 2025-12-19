import { Stack } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerTitleAlign: "center" }}>
        <Stack.Screen name="index" options={{ title: "TrackSeat" }} />
        <Stack.Screen name="signup" options={{ title: "Signup" }} />
        <Stack.Screen name="homepage" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
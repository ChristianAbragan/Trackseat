import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="index" options={{ title: "TrackSeat" }} />
      <Stack.Screen name="bus/[id]" options={{ title: "Bus Details" }} />
      <Stack.Screen name="bus/[id]/onboard" options={{ title: "On Board" }} />
    </Stack>
  );
}

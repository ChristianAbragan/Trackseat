import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function OnBoard() {
  const { id } = useLocalSearchParams();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Currently on Bus: {id}</Text>
    </View>
  );
}
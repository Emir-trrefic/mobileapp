import { registerRootComponent } from 'expo';
import { Text, View } from 'react-native';

function Min() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#081028' }}>
      <Text style={{ color: '#fff', fontSize: 22 }}>Expo Go çalışıyor</Text>
    </View>
  );
}

registerRootComponent(Min);

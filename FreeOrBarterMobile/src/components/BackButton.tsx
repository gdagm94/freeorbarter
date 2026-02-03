import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

interface BackButtonProps {
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, style }) => {
    const navigation = useNavigation();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else {
            navigation.goBack();
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            style={[styles.button, style]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
        >
            <Text style={styles.icon}>←</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 24,
        color: '#1F2937', // Matches generic dark text color used in app
        lineHeight: 28,
    },
});

import { View, Text, StyleSheet } from 'react-native';

interface Message {
  id: string;
  read: boolean;
  read_at?: string | null;
  sender_id: string;
}

interface ReadReceiptProps {
  message: Message;
  currentUserId: string;
}

export function ReadReceipt({ message, currentUserId }: ReadReceiptProps) {
  // Only show read receipt for messages sent by current user
  if (message.sender_id !== currentUserId) {
    return null;
  }

  if (!message.read) {
    return (
      <View style={styles.container}>
        <Text style={styles.unreadText}>Sent</Text>
      </View>
    );
  }

  if (!message.read_at) {
    return (
      <View style={styles.container}>
        <Text style={styles.readText}>Read</Text>
      </View>
    );
  }

  const formatReadTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return 'Read now';
    } else if (diffInMinutes < 60) {
      return `Read ${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) {
      return `Read ${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `Read ${date.toLocaleDateString()}`;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.readText}>{formatReadTime(message.read_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
  },
  unreadText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  readText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
});

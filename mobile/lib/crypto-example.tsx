/**
 * Example React Native Component demonstrating E2E Encryption
 * 
 * This example shows how to integrate the crypto utilities into a
 * React Native chat application. It demonstrates:
 * 1. Initializing encryption on app startup
 * 2. Encrypting messages before sending
 * 3. Decrypting messages when receiving
 * 4. Handling encryption setup UI
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import {
  getOrCreateKeyPair,
  encryptDM,
  decryptDM,
  isEncryptionSetup,
  getPublicKeyBase64,
  CryptoError,
  type EncryptedMessage,
} from './crypto-rn';

/**
 * Example chat component with E2E encryption
 */
export function EncryptedChatExample() {
  const [isReady, setIsReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');
  const [message, setMessage] = useState('');
  const [encryptedMsg, setEncryptedMsg] = useState<EncryptedMessage | null>(null);
  const [decryptedMsg, setDecryptedMsg] = useState('');
  
  // Recipient info (in real app, this comes from API)
  const recipientUserId = 'bob456';
  const recipientPublicKey = 'base64_encoded_public_key_here';
  const myUserId = 'alice123';
  
  /**
   * Initialize encryption on component mount
   * This should be called when the app starts or user logs in
   */
  useEffect(() => {
    initializeEncryption();
  }, []);
  
  const initializeEncryption = async () => {
    try {
      // Check if encryption is already set up
      const isSetup = await isEncryptionSetup();
      
      if (!isSetup) {
        // Generate new key pair on first use
        console.log('Generating new X25519 key pair...');
        await getOrCreateKeyPair();
      }
      
      // Get public key to upload to server
      const pubKey = await getPublicKeyBase64();
      setPublicKey(pubKey);
      
      // TODO: Upload public key to server
      // await uploadPublicKeyToServer(pubKey);
      
      setIsReady(true);
      console.log('Encryption initialized successfully');
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      Alert.alert('Encryption Error', 'Failed to set up encryption');
    }
  };
  
  /**
   * Encrypt and send a message
   */
  const handleSendMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }
    
    try {
      // Encrypt the message before sending to server
      const encrypted = await encryptDM(
        message,
        recipientPublicKey, // Recipient's public key from API
        recipientUserId,
        myUserId
      );
      
      setEncryptedMsg(encrypted);
      
      // In a real app, send encrypted message to server:
      // await sendMessageToServer({
      //   recipientId: recipientUserId,
      //   content: encrypted.ciphertext,
      //   iv: encrypted.iv,
      //   salt: encrypted.salt,
      //   keyVersion: encrypted.keyVersion,
      // });
      
      Alert.alert('Success', 'Message encrypted and sent!');
      setMessage('');
    } catch (error) {
      if (error instanceof CryptoError) {
        Alert.alert('Encryption Error', error.message);
      } else {
        Alert.alert('Error', 'Failed to encrypt message');
      }
      console.error('Encryption error:', error);
    }
  };
  
  /**
   * Decrypt a received message
   */
  const handleDecryptMessage = async () => {
    if (!encryptedMsg) {
      Alert.alert('Error', 'No encrypted message to decrypt');
      return;
    }
    
    try {
      // In a real app, encryptedMsg would come from the server
      // Here we're decrypting the message we just encrypted
      
      // Get sender's public key from API/cache
      const senderPublicKey = publicKey; // In real app, fetch from server
      
      // Decrypt the message
      const plaintext = await decryptDM(
        encryptedMsg,
        senderPublicKey,
        myUserId, // Sender ID
        myUserId  // My ID
      );
      
      setDecryptedMsg(plaintext);
      
      if (plaintext.includes('Unable to decrypt')) {
        Alert.alert('Warning', 'Could not decrypt message');
      }
    } catch (error) {
      console.error('Decryption error:', error);
      Alert.alert('Error', 'Failed to decrypt message');
    }
  };
  
  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text>Initializing encryption...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>E2E Encrypted Chat Demo</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Your Public Key:</Text>
        <Text style={styles.key} numberOfLines={2}>
          {publicKey}
        </Text>
        <Text style={styles.hint}>
          This key would be uploaded to the server and shared with other users
        </Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>Send Encrypted Message:</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Enter a message..."
          multiline
        />
        <Button title="Encrypt & Send" onPress={handleSendMessage} />
      </View>
      
      {encryptedMsg && (
        <View style={styles.section}>
          <Text style={styles.label}>Encrypted Message:</Text>
          <Text style={styles.encrypted} numberOfLines={3}>
            {encryptedMsg.ciphertext.slice(0, 100)}...
          </Text>
          <Text style={styles.hint}>
            This is what gets sent to the server (unreadable)
          </Text>
          <Button title="Decrypt Message" onPress={handleDecryptMessage} />
        </View>
      )}
      
      {decryptedMsg && (
        <View style={styles.section}>
          <Text style={styles.label}>Decrypted Message:</Text>
          <Text style={styles.decrypted}>{decryptedMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  key: {
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#e0e0e0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  encrypted: {
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#ffe0e0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  decrypted: {
    fontSize: 14,
    backgroundColor: '#e0ffe0',
    padding: 8,
    borderRadius: 4,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    minHeight: 60,
  },
});

/**
 * Hook for managing encryption in functional components
 */
export function useEncryption() {
  const [isReady, setIsReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const init = async () => {
      try {
        const isSetup = await isEncryptionSetup();
        
        if (!isSetup) {
          await getOrCreateKeyPair();
        }
        
        const pubKey = await getPublicKeyBase64();
        setPublicKey(pubKey);
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        console.error('Encryption initialization failed:', err);
      }
    };
    
    init();
  }, []);
  
  const encrypt = async (
    plaintext: string,
    recipientPublicKey: string,
    recipientUserId: string,
    myUserId: string
  ): Promise<EncryptedMessage> => {
    if (!isReady) {
      throw new Error('Encryption not initialized');
    }
    
    return await encryptDM(plaintext, recipientPublicKey, recipientUserId, myUserId);
  };
  
  const decrypt = async (
    encrypted: EncryptedMessage,
    senderPublicKey: string,
    senderUserId: string,
    myUserId: string
  ): Promise<string> => {
    if (!isReady) {
      throw new Error('Encryption not initialized');
    }
    
    return await decryptDM(encrypted, senderPublicKey, senderUserId, myUserId);
  };
  
  return {
    isReady,
    publicKey,
    error,
    encrypt,
    decrypt,
  };
}

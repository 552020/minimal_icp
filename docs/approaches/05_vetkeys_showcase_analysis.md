# VetKeys Showcase Analysis

> Analysis of the `ic-vetkey-showcase` - a comprehensive demo showcasing **three different VetKeys approaches** in one application.

## 🎯 **Overview: Three-in-One VetKeys Demo**

The VetKeys Showcase is a **comprehensive demonstration** that implements **three distinct VetKeys use cases** in a single React application:

1. **🔒 TimeLock** - Time-delayed decryption (like secret bid auctions)
2. **📝 Encrypted Notes** - Personal key derivation for private storage
3. **💬 Messages** - Identity-based encryption for user-to-user messaging

**Live Demo**: [https://ddnbn-miaaa-aaaal-qsl3q-cai.icp0.io](https://ddnbn-miaaa-aaaal-qsl3q-cai.icp0.io/)

---

## 🏗️ **Architecture Overview**

### **Technology Stack**

- **Backend**: Rust with IC CDK + manual VetKeys integration
- **Frontend**: React + TypeScript + `@dfinity/vetkeys@0.1.0`
- **State Management**: Zustand for caching keys
- **UI**: TailwindCSS + Radix UI components

### **Key Innovation: Multi-Pattern Showcase**

Instead of focusing on one VetKeys pattern, this showcase demonstrates **different encryption strategies** for different use cases:

```rust
// Three different VetKey input patterns:
// 1. TimeLock: timestamp as input
input: timelock_id.to_le_bytes().to_vec()

// 2. Notes: user Principal as input
input: caller.as_ref().to_vec()

// 3. Messages: username as IBE identity
// (handled on frontend with IBE encryption)
```

---

## 🔐 **VetKeys Integration: Manual Implementation**

### **Backend: Minimal VetKeys Wrapper**

```rust
// Single VetKey utility module
pub static VETKEY_PUBLIC_KEY_NAME: &str = "dfx_test_key";

pub async fn get_root_public_key() -> Result<Vec<u8>, String> {
    let args = VetKDPublicKeyArgs {
        key_id: vetkd_key_id(),
        context: vec![],  // Empty context
        canister_id: None,
    };
    let result = vetkd_public_key(&args).await?;
    Ok(result.public_key)
}

// Simple key derivation for users
async fn get_user_key(transport_key: Vec<u8>, username: String) -> Result<Vec<u8>, String> {
    let args = VetKDDeriveKeyArgs {
        input: username.as_bytes().to_vec(),  // Username as identity
        context: vec![],
        transport_public_key: transport_key,
        key_id: vetkd_key_id(),
    };
    let result = vetkd_derive_key(&args).await?;
    Ok(result.encrypted_key)
}
```

### **Frontend: Sophisticated Key Management**

```typescript
// Smart caching with Zustand stores
const useRootKeyStore = create<RootKeyState>((set, get) => ({
  rootPublicKey: null,
  setRootPublicKey: (key: DerivedPublicKey) => set({ rootPublicKey: key }),
  getRootPublicKey: () => get().rootPublicKey,
}));

const useUserKeysStore = create<UserKeysState>((set, get) => ({
  userKeys: new Map(),
  setUserKey: (username: string, key: VetKey) => {
    const keys = new Map(get().userKeys);
    keys.set(username, key);
    set({ userKeys: keys });
  },
}));

// React Query + caching for key retrieval
export function useGetUserKey() {
  return useQuery({
    queryKey: ["get_user_key", username],
    queryFn: async () => {
      // Check cache first
      const cachedUserKey = getUserKey(username);
      if (cachedUserKey) return cachedUserKey;

      // Fetch and decrypt VetKey
      const transportSecretKey = TransportSecretKey.random();
      const userKeyResult = await backend.get_user_key(transportSecretKey.publicKeyBytes(), username);

      const encryptedVetKey = new EncryptedVetKey(userKeyResult.Ok);
      const userKey = encryptedVetKey.decryptAndVerify(
        transportSecretKey,
        rootPublicKey,
        new TextEncoder().encode(username)
      );

      // Cache for future use
      setUserKey(username, userKey);
      return userKey;
    },
  });
}
```

---

## 📊 **Three VetKeys Patterns Analyzed**

### **1. 🔒 TimeLock Pattern - Canister-Side Decryption**

**Use Case**: Time-delayed decryption for auctions, scheduled reveals

```rust
// Backend handles decryption after time expires
pub async fn open_lock(timelock_id: TimeLockId) -> Result<TimeLock, String> {
    if timelock_id >= ic_cdk::api::time() {
        return Err("Time lock has not yet expired.");
    }

    // Canister derives its own VetKey using timestamp
    let input = timelock_id.to_le_bytes().to_vec();
    let transport_key = create_empty_transport_key();  // Empty/public transport key

    let encrypted_vetkey = vetkd_derive_key(...).await?;
    let vetkey = encrypted_vetkey.decrypt_and_verify(...)?;

    // Canister decrypts the data itself
    let ibe_ciphertext = IBECiphertext::deserialize(time_lock.data.as_slice())?;
    let decrypted_data = ibe_ciphertext.decrypt(&vetkey)?;

    // Return decrypted data (now public)
    Ok(decrypted_data)
}
```

**Key Characteristics:**

- ✅ **Canister decryption** acceptable (data becomes public)
- ✅ **Time-based access control**
- ✅ **Simple timestamp-based identity**

### **2. 📝 Encrypted Notes Pattern - User-Only Decryption**

**Use Case**: Private notes, personal data storage

```rust
// Backend only stores encrypted blobs
pub fn save_note(encrypted_data: EncryptedNoteData) -> Result<EncryptedNote, String> {
    let caller = msg_caller();
    let note = EncryptedNote {
        owner: caller,
        data: encrypted_data,  // Already encrypted on frontend!
        created_at: now,
        updated_at: now,
    };
    notes.insert(caller, note.clone());
    Ok(note)
}
```

```typescript
// Frontend handles all encryption/decryption
const encryptNote = async (noteText: string) => {
  const rootPublicKey = await getRootPublicKey();
  const userIdentity = new TextEncoder().encode(username);

  // IBE encrypt for the user's own identity
  const ciphertext = IBECiphertext.encrypt(
    rootPublicKey,
    userIdentity,
    new TextEncoder().encode(noteText),
    IbeSeed.random()
  );

  return ciphertext.serialize();
};
```

**Key Characteristics:**

- ✅ **Maximum privacy** (frontend-only decryption)
- ✅ **User-specific keys** (each user has unique VetKey)
- ✅ **Simple data model** (one note per user)

### **3. 💬 Messages Pattern - Dual Encryption**

**Use Case**: Secure messaging between users

```rust
// Backend stores both IBE (for recipient) and VetKey (for sender)
pub fn send_message(
    sender_username: String,
    recipient_username: String,
    ibe_encrypted_data: Vec<u8>,      // For recipient to decrypt
    sender_encrypted_data: Vec<u8>,   // For sender's sent items
) -> Result<MessageId, String> {
    let message = Message {
        sender: sender_username,
        recipient: recipient_username,
        ibe_encrypted_data,      // Encrypted TO recipient's identity
        sender_encrypted_data,   // Encrypted WITH sender's VetKey
        timestamp: now,
    };
    messages.insert(message_id, message);
    Ok(message_id)
}
```

**Key Characteristics:**

- ✅ **IBE for recipients** (encrypt TO username)
- ✅ **VetKey for senders** (encrypt WITH user's key)
- ✅ **Dual storage** (both versions kept)
- ✅ **No sharing complexity** (1:1 messaging)

---

## 🎯 **Comparison with Other Approaches**

| **Aspect**                | **VetKeys Showcase**     | **Encrypted Notes (Complex)** | **Password Manager (Simple)** |
| ------------------------- | ------------------------ | ----------------------------- | ----------------------------- |
| **Complexity**            | 🟡 Moderate              | 🔴 High                       | 🟢 Low                        |
| **Code Lines**            | ~300 backend             | ~500+                         | ~150                          |
| **Learning Value**        | ✅ High (3 patterns)     | ✅ Deep (1 pattern)           | ❌ Low (abstracted)           |
| **Production Ready**      | ❓ Demo quality          | ✅ Production grade           | ✅ Production grade           |
| **Sharing Support**       | ❌ No (1:1 only)         | ✅ Yes (many:many)            | ✅ Yes (built-in)             |
| **Key Caching**           | ✅ React Query + Zustand | ✅ IndexedDB + AES            | ❌ None (handled by lib)      |
| **Frontend Complexity**   | 🟡 Moderate              | 🔴 High                       | 🟢 Low                        |
| **VetKeys Understanding** | ✅ Three patterns        | ✅ Deep dive                  | ❌ Abstracted away            |

---

## 🚀 **Relevance for File Sharing**

### **🥇 Best Pattern for Files: Messages Pattern + Enhancements**

The **Messages pattern** is most relevant for file sharing, but needs enhancements:

```typescript
// Adapt Messages pattern for file sharing
const shareFile = async (filename: string, fileData: Uint8Array, recipientUsername: string) => {
  const rootPublicKey = await getRootPublicKey();
  const senderVetKey = await getUserKey(senderUsername);

  // IBE encrypt for recipient (like messages)
  const recipientIdentity = new TextEncoder().encode(recipientUsername);
  const recipientCiphertext = IBECiphertext.encrypt(rootPublicKey, recipientIdentity, fileData, IbeSeed.random());

  // VetKey encrypt for sender's copy
  const senderCiphertext = IBECiphertext.encrypt(
    rootPublicKey,
    new TextEncoder().encode(senderUsername),
    fileData,
    IbeSeed.random()
  );

  // Store both versions
  await backend.upload_file({
    filename,
    recipient_encrypted_data: recipientCiphertext.serialize(),
    sender_encrypted_data: senderCiphertext.serialize(),
    content_type: file.type,
    file_size: file.size,
  });
};
```

### **🔄 Enhancements Needed for File Sharing:**

1. **File Metadata**: Add MIME types, sizes, descriptions
2. **Multiple Recipients**: Support sharing with multiple users
3. **Collections/Folders**: Group related files together
4. **Access Control**: Read/Write/Manage permissions
5. **File Discovery**: List accessible files

---

## 💡 **Key Insights for Our Implementation**

### **✅ What to Adopt:**

1. **Sophisticated Frontend Caching**: Zustand + React Query pattern
2. **Username-based Identity**: More user-friendly than Principals
3. **Dual Encryption Pattern**: Keep copies for both sender and recipient
4. **Clean VetKeys Abstraction**: Simple utility functions

### **🔄 What to Enhance:**

1. **Add File Metadata**: Extend beyond simple encrypted blobs
2. **Implement Sharing**: Move beyond 1:1 to 1:many
3. **Add Collections**: Group files into shareable folders
4. **Production Polish**: Error handling, validation, limits

### **❌ What to Avoid:**

1. **Demo-only Code**: Lacks production hardening
2. **No Access Control**: Public endpoints, no authorization
3. **Memory-only Storage**: No stable storage (data lost on upgrade)
4. **No Sharing Model**: Limited to 1:1 interactions

---

## 🎯 **Final Assessment**

### **For Learning VetKeys:**

**⭐ Excellent** - Shows three different patterns clearly

### **For File Sharing Implementation:**

**🟡 Good starting point** - Messages pattern + enhancements needed

### **vs Other Approaches:**

- **More complex** than Password Manager (Encrypted Maps)
- **Less sophisticated** than Encrypted Notes (content-specific keys)
- **Better learning** than either (shows multiple patterns)

---

## 🚀 **Recommendation**

**Use VetKeys Showcase as inspiration**, but **adopt Password Manager with Metadata for implementation**:

1. **Learn from Showcase**: Understand different VetKeys patterns
2. **Use for Frontend**: Adopt the caching and state management patterns
3. **Implement with Encrypted Maps**: Use proven production-ready backend
4. **Best of both worlds**: VetKeys understanding + rapid development

### **Hybrid Approach:**

1. **Phase 1**: Implement with Password Manager + Metadata (fast)
2. **Phase 2**: Study Showcase patterns (learning)
3. **Phase 3**: Enhance with Showcase frontend patterns (optimization)

This gives us both **rapid development** AND **VetKeys mastery**! 🎯

---

## 📝 **Updated Recommendation**

**Primary**: Password Manager with Metadata (fastest, most complete)
**Secondary**: VetKeys Showcase patterns (learning, optimization)
**Combination**: Use Encrypted Maps backend + Showcase frontend patterns

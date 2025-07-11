# Canister Cloud Approach - Production VetKeys File Storage

> **Real production application** demonstrating novel owner principal pattern and comprehensive VetKeys migration insights.

## 📍 **Location & Overview**

**Path**: `secretus/canister_app/backend/src/lib.rs`  
**Lines**: ~250  
**Complexity**: 🟡 Moderate  
**Pattern**: Owner Principal  
**Status**: ✅ Live Production Application

## 🎯 **Core Concept**

Canister Cloud demonstrates a **novel owner principal pattern** where files are always encrypted using the **file owner's Principal** as the IBE identity, with dynamic resolution at access time.

```rust
// Core pattern: Always use file owner's principal
let file_owner = get_file_owner(file_id)?;
let owner_identity = file_owner.as_ref().to_vec();  // Owner's Principal as IBE identity
```

**Revolutionary Insight**: Instead of encrypting to each recipient individually, encrypt once to the owner and grant access through authorization lists.

## 🏗️ **Architecture Analysis**

### **User Management System**

```rust
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct User {
    pub username: String,
    pub public_key: Vec<u8>,  // Traditional public key (not VetKeys)
}

// Complete user system - unique among VetKeys apps
pub users: BTreeMap<Principal, User>        // Principal → User profile
pub usernames: BTreeMap<String, Principal>  // Username → Principal reverse lookup
```

**Key Innovation**: **Only VetKeys app with full user registration system** including usernames and profiles.

### **File Storage Pattern**

```rust
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct File {
    pub id: u64,
    pub owner: Principal,           // File owner (IBE identity base)
    pub name: String,
    pub content: Vec<u8>,           // Encrypted to owner's Principal
    pub size: u64,
    pub created_at: u64,
    pub updated_at: u64,
    pub shared_with: Vec<Principal>, // Authorization list
    pub file_type: String,
    pub description: String,
}

pub file_data: BTreeMap<u64, File>
pub user_files: BTreeMap<Principal, Vec<u64>>  // User → File IDs index
```

**Novel Pattern Characteristics**:

- ✅ **Single encryption**: File encrypted once to owner's Principal
- ✅ **Authorization lists**: `shared_with` grants access without re-encryption
- ✅ **Dynamic resolution**: Access control resolved at request time
- ✅ **Efficient sharing**: No need to re-encrypt for each recipient

### **Access Control Flow**

#### **1. File Upload (Owner Encryption)**

```rust
#[update]
fn upload_file(
    name: String,
    content: Vec<u8>,      // Already encrypted to caller's Principal
    file_type: String,
    description: String,
) -> Result<u64, String> {
    let owner = ic_cdk::api::msg_caller();
    let file_id = generate_file_id();

    let file = File {
        id: file_id,
        owner,                      // Owner's Principal is IBE identity
        name,
        content,                    // Encrypted to owner's Principal
        size: content.len() as u64,
        created_at: ic_cdk::api::time(),
        updated_at: ic_cdk::api::time(),
        shared_with: vec![],        // Initially private
        file_type,
        description,
    };

    FILE_DATA.with(|data| data.borrow_mut().insert(file_id, file));
    USER_FILES.with(|user_files| {
        user_files.borrow_mut().entry(owner).or_insert_with(Vec::new).push(file_id);
    });

    Ok(file_id)
}
```

#### **2. File Sharing (Authorization Grant)**

```rust
#[update]
fn share_file(file_id: u64, username: String) -> Result<(), String> {
    let caller = ic_cdk::api::msg_caller();

    FILE_DATA.with(|data| {
        let mut files = data.borrow_mut();
        let mut file = files.get(&file_id).ok_or("File not found")?.clone();

        // Only owner can share
        if file.owner != caller {
            return Err("Only file owner can share".to_string());
        }

        // Resolve username to Principal
        let recipient_principal = USERNAMES.with(|usernames| {
            usernames.borrow().get(&username).copied()
        }).ok_or("User not found")?;

        // Add to authorization list (NO RE-ENCRYPTION NEEDED!)
        if !file.shared_with.contains(&recipient_principal) {
            file.shared_with.push(recipient_principal);
            files.insert(file_id, file);
        }

        Ok(())
    })
}
```

#### **3. File Access (Dynamic Authorization)**

```rust
#[query]
fn get_file(file_id: u64) -> Result<File, String> {
    let caller = ic_cdk::api::msg_caller();

    FILE_DATA.with(|data| {
        let file = data.borrow().get(&file_id).ok_or("File not found")?.clone();

        // Check authorization: owner OR explicitly shared
        if file.owner == caller || file.shared_with.contains(&caller) {
            Ok(file)  // Return encrypted content (still needs frontend decryption)
        } else {
            Err("Access denied".to_string())
        }
    })
}
```

#### **4. Frontend Decryption (Owner Key Resolution)**

```typescript
// Frontend: Always decrypt using file owner's VetKey
async function decryptFile(file: File): Promise<Uint8Array> {
  // Key insight: Always use FILE OWNER's Principal for VetKey derivation
  const ownerIdentity = file.owner.toUint8Array();

  // Get owner's VetKey (not current user's!)
  const transportKeyPair = TransportSecretKey.generate();
  const ownerEncryptedVetKey = await backend.get_owner_vetkey(
    file.owner, // Owner's Principal
    transportKeyPair.public_key()
  );

  const ownerVetKey = ownerEncryptedVetKey.decrypt(transportKeyPair);

  // Decrypt file using owner's VetKey
  const ciphertext = IBECiphertext.deserialize(file.content);
  return ciphertext.decrypt(ownerVetKey);
}
```

## 🎯 **Novel Pattern Advantages**

### **1. Efficient Sharing**

```rust
// Traditional approach (encrypted_notes pattern):
// - Encrypt file for Alice: encrypt(file, alice_principal)
// - Share with Bob: re-encrypt(file, bob_principal)
// - Share with Carol: re-encrypt(file, carol_principal)
// Result: 3 encrypted copies, expensive operations

// Canister Cloud approach:
// - Encrypt file once: encrypt(file, owner_principal)
// - Share with Bob: add Bob to authorization list
// - Share with Carol: add Carol to authorization list
// Result: 1 encrypted copy, cheap authorization updates
```

### **2. Simplified Key Management**

- ✅ **Single VetKey per file**: Always owner's key, no content-specific keys
- ✅ **No key coordination**: Shared users don't need separate keys
- ✅ **Dynamic access**: Authorization checked at access time

### **3. Storage Efficiency**

- ✅ **One encrypted copy**: No duplicate encrypted content per recipient
- ✅ **Small authorization lists**: Just Principal IDs, not encrypted copies
- ✅ **Efficient updates**: Sharing changes don't require re-encryption

## ❌ **Pattern Limitations**

### **1. Trust Requirements**

```rust
// Critical limitation: Shared users must trust owner's key management
// If owner's key is compromised, ALL shared files are compromised
// Traditional per-recipient encryption isolates compromise to individual keys
```

### **2. Owner Dependency**

- ❌ **Owner required**: Shared users can't decrypt without owner's cooperation
- ❌ **Key rotation complexity**: Owner key changes affect all shared files
- ❌ **Access revocation limitations**: Removing sharing doesn't invalidate cached keys

### **3. Security Trade-offs**

- ❌ **Reduced forward secrecy**: Owner key compromise affects historical files
- ❌ **Centralized risk**: All file security depends on owner's Principal security
- ❌ **Limited cryptographic isolation**: Shared users have same access level as owner

## 🔬 **Production Insights**

### **Real-World Lessons**

1. **User Experience Trumps Perfect Security**
   - Users prefer simple sharing over cryptographic complexity
   - Username-based sharing is essential for adoption
   - Authorization lists are intuitive to users

2. **Performance Matters**
   - Re-encryption for sharing is expensive and slow
   - Single encryption with authorization is much faster
   - Storage costs matter for large files

3. **Trust Models Vary**
   - Some use cases can accept owner-based trust model
   - Family/team file sharing often has implicit trust
   - Not suitable for zero-trust environments

### **Production Architecture Choices**

```rust
// Key production decisions:
pub struct ProductionFileSystem {
    // User management for UX
    users: BTreeMap<Principal, User>,
    usernames: BTreeMap<String, Principal>,

    // File storage optimized for sharing
    files: BTreeMap<u64, File>,           // Single source of truth
    user_files: BTreeMap<Principal, Vec<u64>>, // Index for quick lookup

    // Authorization-based sharing (not cryptographic)
    // shared_with: Vec<Principal> in File struct
}
```

## 🎯 **Best Use Cases**

### **✅ Perfect For:**

- **Family file sharing** - Implicit trust between family members
- **Small team collaboration** - Known team members with trust
- **Personal file organization** - User organizing their own files with occasional sharing
- **Performance-critical applications** - Where sharing speed matters more than perfect isolation

### **❌ Not Suitable For:**

- **Zero-trust environments** - Requires trust in file owners
- **Large enterprise** - Too much centralized risk
- **Sensitive document sharing** - Forward secrecy and isolation critical
- **Anonymous file sharing** - Requires known user identities

## 🚀 **Adaptation for Different Trust Models**

### **Hybrid Approach**

```rust
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum EncryptionMode {
    OwnerPrincipal(Principal),          // Canister Cloud pattern
    PerRecipient(Vec<Principal>),       // Traditional encrypted_notes pattern
    ContentSpecific(String),            // Content-specific IBE identity
}

pub struct FlexibleFile {
    pub encryption_mode: EncryptionMode,
    pub content: Vec<u8>,
    pub authorized_users: Vec<Principal>,
}
```

## 🎓 **Learning Value**

### **What Canister Cloud Teaches**

1. **Real-world trade-offs** between security and usability
2. **Production performance** considerations for VetKeys apps
3. **User experience** importance in cryptographic applications
4. **Alternative sharing patterns** beyond traditional per-recipient encryption
5. **Trust model design** in decentralized applications

### **Research Questions Raised**

1. How to maintain owner pattern benefits while improving security?
2. Can hybrid trust models provide flexibility?
3. What are the optimal trust boundaries for different use cases?
4. How to handle key rotation in owner-based systems?

## 💡 **Key Takeaways**

1. **Novel Pattern**: Owner principal approach offers unique benefits
2. **Production Reality**: Real applications make security/UX trade-offs
3. **Performance Matters**: Sharing efficiency can be more important than perfect isolation
4. **Trust Models**: Different applications have different trust requirements
5. **User Experience**: Username-based sharing essential for adoption

**Canister Cloud demonstrates that innovative VetKeys patterns can emerge from real-world production needs!** 🚀

# File Sharing Backend Architecture Evolution

## Architecture Change: From Manual Transport Keys to EncryptedMaps API

### Previous Approach: `share_tpk_backend`

In the initial implementation, we used a **manual transport key sharing approach**:

- **Alice's workflow**:
  1. Generate and share her public transport key
  2. Make it available for Bob to discover
  3. Bob encrypts files using Alice's public transport key
  4. Alice uses her private transport key to decrypt

- **Key characteristics**:
  - Manual VetKeys implementation
  - Direct transport key management
  - Principal-based identity only
  - Low-level VetKeys API usage
  - Bob needs Alice's transport key before encryption

**Problems with this approach**:

- ❌ **Complex key management**: Users had to handle transport keys manually
- ❌ **No user discovery**: Only cryptographic Principal IDs
- ❌ **Security risks**: Exposed transport key handling
- ❌ **Poor UX**: Complex workflow for sharing

### New Approach: Enhanced Password Manager + EncryptedMaps (Simplified)

We switched to using **VetKeys EncryptedMaps API** with user-friendly layers, but **simplified without collections**:

- **User workflow**:
  1. Users register with friendly usernames
  2. Bob uploads individual files and shares them with "alice" (by username)
  3. EncryptedMaps API handles all VetKeys complexity automatically
  4. Alice accesses shared files through VetKeys derivation

- **Key improvements**:
  - ✅ **EncryptedMaps abstraction**: VetKeys handled automatically
  - ✅ **User registry**: Username-based discovery and sharing
  - ✅ **Proven architecture**: Based on Enhanced Password Manager pattern
  - ✅ **Built-in access control**: Via EncryptedMaps access rights
  - ✅ **Better UX**: "Share with alice" instead of Principal IDs
  - ✅ **Simple structure**: Just Users + Files (no collections overhead)

## Technical Architecture

### Core Components

1. **User Management**

   ```rust
   static USERS: RefCell<StableUserMap>                     // username -> User
   static PRINCIPAL_TO_USERNAME: RefCell<StablePrincipalToUsernameMap>  // reverse lookup
   ```

2. **File Storage** (EncryptedMaps API)

   ```rust
   static ENCRYPTED_MAPS: RefCell<Option<EncryptedMaps<AccessRights>>>
   // Key structure: (file_owner, file_id) - simplified, no collections
   ```

3. **File Metadata**
   ```rust
   static FILE_METADATA: RefCell<StableFileMetadataMap>
   // Same composite key links encrypted content with searchable metadata
   ```

### Data Flow Changes

#### Old: Manual Transport Key Flow

```
Bob → Get Alice's public transport key → Encrypt file → Upload
Alice → Download encrypted file → Use private transport key → Decrypt
```

#### New: EncryptedMaps Flow (Simplified)

```
Bob → Register username → Upload encrypted file → Share file with "alice"
Alice → Register username → Access shared files → EncryptedMaps handles VetKeys → Download/decrypt
```

## Benefits of the New Approach

### For Users

- **Simple registration**: Just username and optional display name
- **Easy sharing**: Share files with usernames instead of Principal IDs
- **File management**: Individual files (no complex collections)
- **User discovery**: Search users by username or display name

### For Developers

- **Less code**: EncryptedMaps handles VetKeys complexity
- **Proven patterns**: Based on working Enhanced Password Manager
- **Built-in security**: Access control via EncryptedMaps
- **Simple structure**: No collection management overhead
- **Rich metadata**: File information separate from encrypted content

### For Security

- **No exposed transport keys**: EncryptedMaps handles internally
- **Proper access control**: Built into VetKeys system
- **Separation of concerns**: Metadata vs encrypted content

## File Structure (Simplified)

### Individual Files

- Owner: Principal who uploaded the file
- File ID: Unique identifier for the file
- Encrypted content: Stored in EncryptedMaps
- Metadata: Filename, content type, size, tags, description
- Sharing: Grant access rights to other users by username

**Key simplification**: No collections - just individual files that can be shared directly.

## Migration Summary

**What changed**:

- From manual transport key sharing → EncryptedMaps API
- From Principal-only identity → Username + Principal
- From low-level VetKeys → High-level abstraction
- ~~From individual file sharing → Collection-based sharing~~
- **Simplified**: Individual file sharing (no collections)

**What stayed the same**:

- VetKeys IBE encryption for security
- IC Principal as base identity
- Stable memory for persistence

**Design decision**: Start simple with individual file sharing. Collections can be added later if needed, but they're not essential for the core use case.

This approach gives us the security benefits of VetKeys with a much better user experience, simpler implementation, and no unnecessary complexity.

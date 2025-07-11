# VetKey File Sharing System

An **incremental development project** building a secure file sharing system using Internet Computer canisters and VetKeys for end-to-end encryption. This project demonstrates how to progressively build complex decentralized applications with TypeScript scripts and Rust canisters.

## 🎯 Project Vision

We're incrementally building a complete file sharing ecosystem where:
- **Alice** can securely share files with **Bob**
- **Bob** can encrypt and upload files for **Alice**  
- All encryption/decryption happens using **VetKeys** for maximum security
- The system is fully **decentralized** on the Internet Computer
- **TypeScript scripts** provide easy interaction with **Rust canisters**

## 🏗️ Incremental Development Approach

This project follows an **incremental development methodology**:

1. ✅ **Phase 1: Basic Communication** (Completed)
   - Simple canister interaction with `general_greet.ts`
   - HTTP agent setup and identity management

2. ✅ **Phase 2: Transport Key Sharing** (Completed)  
   - Alice shares her public transport key via `alice_share_ptk.ts`
   - Stable memory integration with user registration
   - VetKeys transport key generation

3. 🚧 **Phase 3: File Upload & Encryption** (In Progress)
   - Bob retrieves Alice's public transport key
   - Bob encrypts files using VetKeys system  
   - Bob uploads encrypted files to storage canister
   - Notification system for file sharing

4. 📋 **Phase 4: File Retrieval & Decryption** (Planned)
   - Alice receives notifications of new files
   - Alice retrieves and decrypts files using her VetKey
   - File metadata and access control

5. 📋 **Phase 5: Advanced Features** (Future)
   - Multi-user file sharing
   - File versioning and history
   - Access control and permissions
   - Web frontend interface

## 🚀 Current System Architecture

### **Canisters (Rust)**

- **`share_tpk_backend`** - Manages user registration and public transport key sharing
- **`basic_demo_backend`** - Basic "hello world" canister for testing communication
- **`file_storage_backend`** *(Coming Soon)* - Handles encrypted file storage and notifications

### **Scripts (TypeScript)**

- **`alice_share_ptk.ts`** - Alice shares her public transport key with the system
- **`general_greet.ts`** - Basic canister communication test
- **`bob_encrypt_upload_file.ts`** *(Coming Soon)* - Bob encrypts and uploads files for Alice

## 🛠️ Quick Start

### Prerequisites

```bash
# Install dfx (Internet Computer SDK)
DFX_VERSION=0.22.0 sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"

# Install Node.js dependencies
npm install

# Start local IC replica
dfx start --background
```

### Deploy Canisters

```bash
# Build and deploy all canisters
dfx deploy

# Generate TypeScript declarations
dfx generate
```

### Run Scripts

```bash
# Basic communication test
npm run general:greet

# Alice shares her public transport key
npm run alice:share-ptk
```

## 📁 Project Structure

```
vetkey_file_sharing/
├── src/                          # Rust canisters
│   ├── basic_demo_backend/       # Simple greet canister
│   ├── share_tpk_backend/        # Transport key sharing
│   └── file_storage_backend/     # (Coming Soon) File storage
├── scripts/                      # TypeScript interaction scripts
│   ├── alice_share_ptk.ts        # Alice shares transport key
│   ├── general_greet.ts          # Basic communication test
│   ├── scripts.md                # Scripts documentation
│   └── alice_share_ptk.ts.md     # Bug analysis & fixes
├── docs/                         # Learning and technical documentation
│   └── learnings.md              # Complete development learning guide
├── dfx.json                      # IC project configuration
├── package.json                  # Node.js dependencies
└── README.md                     # This file
```

## 🔐 Security & VetKeys Integration

This project leverages **VetKeys** for cryptographic operations:

- **Transport Keys**: Enable secure key exchange between users
- **End-to-End Encryption**: Files are encrypted client-side before upload
- **Identity Management**: Ed25519 signatures for user authentication  
- **Stable Memory**: Persistent storage of user data and keys

### Example VetKeys Usage

```typescript
import { TransportSecretKey } from "@dfinity/vetkeys";

// Generate transport key pair
const transportKey = TransportSecretKey.random();
const publicKey = transportKey.publicKeyBytes();

// Share public key with canister
await actor.register_user(Array.from(publicKey));
```

## 📚 Documentation

- **[Scripts Documentation](./scripts/scripts.md)** - Comprehensive guide to all TypeScript scripts
- **[Learning Guide](./docs/learnings.md)** - Complete troubleshooting and learning reference
- **[Candid Interface Generation](../../docs/rust/candid_interface_generation.md)** - How to generate proper Candid interfaces
- **[JSON Parsing Bug Analysis](./scripts/alice_share_ptk.ts.md)** - Detailed debugging case study

## 🧪 Development Methodology

### Incremental Development Benefits

1. **Testable at Every Stage**: Each phase produces working software
2. **Clear Progress Tracking**: Visible milestones and deliverables  
3. **Risk Mitigation**: Issues caught early in simple components
4. **Learning-Oriented**: Perfect for understanding IC development
5. **Maintainable**: Well-documented progression from simple to complex

### Testing Strategy

- **Unit Tests**: Individual canister methods
- **Integration Tests**: Script-to-canister communication  
- **End-to-End Tests**: Complete user workflows
- **Documentation**: Every bug and fix thoroughly documented

## 🔄 Current Status

### ✅ Completed Features

- [x] Basic IC canister communication
- [x] Ed25519 identity generation and persistence
- [x] VetKeys transport key generation
- [x] User registration with public transport keys
- [x] Stable memory integration for persistence
- [x] Comprehensive error handling and documentation
- [x] Proper TypeScript/Rust integration with generated types

### 🚧 In Progress

- [ ] File storage canister implementation
- [ ] Bob's file encryption and upload script
- [ ] Notification system for file sharing

### 📋 Planned

- [ ] Alice's file retrieval and decryption
- [ ] File metadata management
- [ ] Multi-user access control
- [ ] Web frontend interface

## 🤝 Contributing

This project follows **conventional commits** and maintains comprehensive documentation:

1. **Fork and clone** the repository
2. **Follow the incremental approach** - build on existing phases
3. **Document thoroughly** - every script gets a `.md` file
4. **Test end-to-end** - ensure scripts work with canisters
5. **Use conventional commits** - `feat:`, `fix:`, `docs:`, etc.

## 📖 Learning Resources

- [Internet Computer Documentation](https://internetcomputer.org/docs/)
- [VetKeys Specification](https://github.com/dfinity/vetkeys)
- [Rust CDK Guide](https://internetcomputer.org/docs/current/developer-docs/backend/rust/)
- [TypeScript Agent Documentation](https://agent-js.icp.xyz/)

---

**This project demonstrates incremental development of decentralized applications, showing how complex systems can be built step-by-step with proper testing and documentation at every stage.**

# VetKeys Applications Reference Guide

> **Quick reference to all VetKeys applications** with file locations and brief descriptions for easy navigation.

## 📍 **Official DFINITY Examples**

### **Password Management**

- **Basic Password Manager**: `vetkeys/examples/password_manager/rust/backend/src/lib.rs`
  - Simple encrypted password storage using EncryptedMaps
  - Built-in sharing, no metadata support
  - ~100 lines, perfect for rapid prototyping

- **Enhanced Password Manager**: `vetkeys/examples/password_manager_with_metadata/rust/backend/src/lib.rs`
  - Password storage + searchable metadata
  - Dual storage architecture: encrypted content + metadata
  - ~150 lines, **ideal for file sharing adaptation**

### **Basic Encryption Examples**

- **Simple IBE Messaging**: `vetkeys/examples/basic_ibe/rust/backend/src/lib.rs`
  - Direct Principal-based IBE encryption
  - No sharing, pure 1:1 messaging
  - ~100 lines, **best for learning VetKeys fundamentals**

- **BLS Signature Demo**: `vetkeys/examples/basic_bls_signing/rust/backend/src/lib.rs`
  - Digital signature creation and verification
  - Identity-based BLS signatures
  - ~200 lines, specialized authentication use cases

- **Timelock IBE Demo**: `vetkeys/examples/basic_timelock_ibe/backend/src/lib.rs`
  - Time-delayed decryption for fair auctions
  - Timestamp-based IBE identities
  - ~200 lines, specialized temporal encryption

### **Advanced Applications**

- **Collaborative Notes App**: `vetkeys/examples/encrypted_notes_dapp_vetkd/rust/backend/src/lib.rs`
  - Content-specific keys with sophisticated sharing
  - Note-centric storage with user indexes
  - ~500+ lines, **production-grade sharing patterns**

---

## 🌐 **Community & Production Applications**

### **Ethereum Integration**

- **ETH File Transfer Demo**: `send_file_to_eth_demo/src/backend/src/lib.rs`
  - Native Ethereum address support as IBE identities
  - SIWE authentication, production React frontend
  - ~2000 lines total, **game-changer for Web3 file sharing**

### **Production File Storage**

- **Canister Cloud**: `secretus/canister_app/backend/src/lib.rs`
  - Real production application with novel owner principal pattern
  - Full user registration system with usernames
  - ~250 lines, **unique sharing insights**

### **Educational Showcase**

- **VetKeys Pattern Showcase**: `secretus/ic-vetkey-showcase/src/backend/src/lib.rs`
  - Multiple VetKeys patterns in single app
  - Educational comparison of approaches
  - ~300 lines, **best for learning pattern variety**

---

## 📊 **Quick Selection Guide**

### **🚀 For Fast Results**

- **ETH File Sharing**: `send_file_to_eth_demo` → Production-ready in 3-5 days
- **IC File Sharing**: `password_manager_with_metadata` → Working prototype in 1-2 weeks

### **🎓 For Learning VetKeys**

- **Start Here**: `basic_ibe` → Understand IBE fundamentals
- **Next Level**: `vetkeys_showcase` → Learn pattern variety
- **Advanced**: `encrypted_notes_dapp_vetkd` → Master sophisticated sharing

### **🔬 For Research**

- **Novel Patterns**: `canister_cloud` → Study owner principal approach
- **Production Insights**: All apps → Real-world trade-offs and decisions

---

## 📁 **Analysis Files Structure**

### **Comprehensive Overview**

- `00_vetkeys_applications_reference.md` - **This file** - Quick reference
- `all_vetkeys_approaches_ultimate.md` - **Master analysis** - Complete technical guide

### **Individual Approach Deep-Dives**

- `01_basic_ibe_approach.md` - Simple IBE fundamentals
- `02_encrypted_notes_approach.md` - Advanced content-specific sharing
- `03_password_manager_approach.md` - Encrypted Maps for rapid development
- `04_timelock_bls_approach.md` - Specialized temporal and signature patterns
- `05_vetkeys_showcase_analysis.md` - Multi-pattern educational showcase
- `06_canister_cloud_approach.md` - Production owner principal pattern
- `07_send_file_to_eth_demo_analysis.md` - Ethereum integration game-changer

### **Pattern Analysis**

- `99_user_data_patterns_analysis.md` - How each app links users to encrypted data

---

## 🎯 **Navigation Tips**

1. **Start with ultimate analysis** for strategic overview
2. **Read specific approach files** for implementation details
3. **Study user patterns analysis** for architectural insights
4. **Use this reference** for quick file location lookup

**Happy VetKeys exploring!** 🚀

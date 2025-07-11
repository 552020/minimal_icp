// === Imports ===

use candid::{CandidType, Principal};
use ic_cdk::management_canister::{VetKDCurve, VetKDKeyId};
use ic_cdk::{init, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::storable::Blob;
use ic_stable_structures::{storable::Bound, Storable};
use ic_stable_structures::{BTreeMap as StableBTreeMap, DefaultMemoryImpl};
use ic_vetkeys::encrypted_maps::{EncryptedMaps, VetKey, VetKeyVerificationKey};
use ic_vetkeys::types::{AccessRights, ByteBuf, EncryptedMapValue, TransportKey};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cell::RefCell;

// ===== USER MANAGEMENT (NEW) =====
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct User {
    pub username: String,
    pub principal: Principal,
    pub display_name: Option<String>,
    pub created_at: u64,
}

impl User {
    pub fn new(username: String, principal: Principal, display_name: Option<String>) -> Self {
        Self {
            username,
            principal,
            display_name,
            created_at: ic_cdk::api::time(),
        }
    }
}

impl Storable for User {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).expect("failed to serialize"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(bytes.as_ref()).expect("failed to deserialize")
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ===== FILE METADATA (ADAPTED FROM PASSWORD METADATA) =====
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileMetadata {
    pub filename: String,
    pub content_type: String,
    pub file_size: u64,
    pub creation_date: u64,
    pub last_modification_date: u64,
    pub uploaded_by: Principal,
    pub tags: Vec<String>,
    pub description: Option<String>,
}

impl FileMetadata {
    pub fn new(
        filename: String,
        content_type: String,
        file_size: u64,
        caller: Principal,
        tags: Vec<String>,
        description: Option<String>,
    ) -> Self {
        let time_now = ic_cdk::api::time();
        Self {
            filename,
            content_type,
            file_size,
            creation_date: time_now,
            last_modification_date: time_now,
            uploaded_by: caller,
            tags,
            description,
        }
    }

    pub fn update(
        self,
        filename: String,
        tags: Vec<String>,
        description: Option<String>,
    ) -> Self {
        Self {
            filename,
            creation_date: self.creation_date,
            last_modification_date: ic_cdk::api::time(),
            uploaded_by: self.uploaded_by,
            content_type: self.content_type,
            file_size: self.file_size,
            tags,
            description,
        }
    }
}

impl Storable for FileMetadata {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).expect("failed to serialize"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(bytes.as_ref()).expect("failed to deserialize")
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ===== TYPE DEFINITIONS =====
type Memory = VirtualMemory<DefaultMemoryImpl>;
type CollectionOwner = Principal;
type CollectionName = Blob<32>;
type FileKey = Blob<32>;

// Key structure: (Owner, Collection, FileId) - same pattern as password manager
type StableFileMetadataMap = StableBTreeMap<(CollectionOwner, CollectionName, FileKey), FileMetadata, Memory>;
type StableUserMap = StableBTreeMap<String, User, Memory>; // username -> User
type StablePrincipalToUsernameMap = StableBTreeMap<Principal, String, Memory>; // Principal -> username

// ===== GLOBAL STATE =====
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    // EncryptedMaps for encrypted file content (VetKeys API)
    static ENCRYPTED_MAPS: RefCell<Option<EncryptedMaps<AccessRights>>> =
        const { RefCell::new(None) };
    
    // File metadata storage (searchable, not encrypted)
    static FILE_METADATA: RefCell<StableFileMetadataMap> = RefCell::new(StableBTreeMap::new(
        MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))),
    ));
    
    // User registry for username -> Principal mapping
    static USERS: RefCell<StableUserMap> = RefCell::new(StableBTreeMap::new(
        MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
    ));
    
    // Reverse lookup: Principal -> username
    static PRINCIPAL_TO_USERNAME: RefCell<StablePrincipalToUsernameMap> = RefCell::new(StableBTreeMap::new(
        MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))),
    ));
}

// ===== INITIALIZATION =====
#[init]
fn init(key_name: String) {
    let key_id = VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name: key_name,
    };
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.replace(EncryptedMaps::init(
            "file_sharing_dapp",
            key_id,
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
        ))
    });
}

// ===== USER MANAGEMENT FUNCTIONS =====
#[update]
fn register_user(username: String, display_name: Option<String>) -> Result<User, String> {
    let caller = ic_cdk::api::msg_caller();
    
    // Check if username already exists
    if USERS.with_borrow(|users| users.contains_key(&username)) {
        return Err("Username already exists".to_string());
    }
    
    // Check if user already registered with different username
    if PRINCIPAL_TO_USERNAME.with_borrow(|p2u| p2u.contains_key(&caller)) {
        return Err("User already registered with different username".to_string());
    }
    
    let user = User::new(username.clone(), caller, display_name);
    
    // Store in both maps
    USERS.with_borrow_mut(|users| {
        users.insert(username.clone(), user.clone());
    });
    
    PRINCIPAL_TO_USERNAME.with_borrow_mut(|p2u| {
        p2u.insert(caller, username);
    });
    
    Ok(user)
}

#[query]
fn get_user_by_username(username: String) -> Option<User> {
    USERS.with_borrow(|users| users.get(&username))
}

#[query]
fn get_my_user_profile() -> Option<User> {
    let caller = ic_cdk::api::msg_caller();
    PRINCIPAL_TO_USERNAME.with_borrow(|p2u| {
        p2u.get(&caller).and_then(|username| {
            USERS.with_borrow(|users| users.get(&username))
        })
    })
}

#[query]
fn search_users(query: String) -> Vec<User> {
    USERS.with_borrow(|users| {
        users
            .iter()
            .filter(|(username, user)| {
                username.contains(&query) || 
                user.display_name.as_ref().map_or(false, |name| name.contains(&query))
            })
            .map(|(_, user)| user)
            .take(10) // Limit results
            .collect()
    })
}

// ===== FILE COLLECTION FUNCTIONS (ADAPTED FROM PASSWORD MANAGER) =====
#[query]
fn get_accessible_shared_collections() -> Vec<(Principal, ByteBuf)> {
    ENCRYPTED_MAPS.with_borrow(|encrypted_maps| {
        encrypted_maps
            .as_ref()
            .unwrap()
            .get_accessible_shared_map_names(ic_cdk::api::msg_caller())
            .into_iter()
            .map(|map_id| (map_id.0, ByteBuf::from(map_id.1.as_ref().to_vec())))
            .collect()
    })
}

#[query]
fn get_shared_user_access_for_collection(
    collection_owner: Principal,
    collection_name: ByteBuf,
) -> Result<Vec<(Principal, AccessRights)>, String> {
    let caller = ic_cdk::api::msg_caller();
    let key_id = (
        collection_owner,
        Blob::try_from(collection_name.as_ref()).map_err(|_e| "name too long")?,
    );
    ENCRYPTED_MAPS.with_borrow(|encrypted_maps| {
        encrypted_maps
            .as_ref()
            .unwrap()
            .get_shared_user_access_for_map(caller, key_id)
    })
}

#[query]
fn get_files_in_collection_with_metadata(
    collection_owner: Principal,
    collection_name: ByteBuf,
) -> Result<Vec<(ByteBuf, EncryptedMapValue, FileMetadata)>, String> {
    let collection_name = bytebuf_to_blob(collection_name)?;
    let collection_id = (collection_owner, collection_name);
    let encrypted_values_result = ENCRYPTED_MAPS.with_borrow(|encrypted_maps| {
        encrypted_maps
            .as_ref()
            .unwrap()
            .get_encrypted_values_for_map(ic_cdk::api::msg_caller(), collection_id)
    });
    encrypted_values_result.map(|map_values| {
        FILE_METADATA.with_borrow(|metadata| {
            let iter_metadata = metadata
                .range((collection_owner, collection_name, Blob::default())..)
                .take_while(|((owner, name, _), _)| owner == &collection_owner && name == &collection_name)
                .map(|((_, _, key), metadata)| (key, metadata));

            iter_metadata
                .zip(map_values)
                .map(|((key_left, metadata), (key_right, encrypted_value))| {
                    debug_assert_eq!(key_left, key_right);
                    (
                        ByteBuf::from(key_left.as_slice().to_vec()),
                        encrypted_value,
                        metadata,
                    )
                })
                .collect()
        })
    })
}

#[query]
fn get_my_collections() -> Vec<ByteBuf> {
    ENCRYPTED_MAPS.with_borrow(|encrypted_maps| {
        encrypted_maps
            .as_ref()
            .unwrap()
            .get_owned_non_empty_map_names(ic_cdk::api::msg_caller())
            .into_iter()
            .map(|collection_name| ByteBuf::from(collection_name.as_slice().to_vec()))
            .collect()
    })
}

#[update]
fn upload_file_to_collection(
    collection_owner: Principal,
    collection_name: ByteBuf,
    file_id: ByteBuf,
    encrypted_file_data: EncryptedMapValue,
    filename: String,
    content_type: String,
    file_size: u64,
    tags: Vec<String>,
    description: Option<String>,
) -> Result<Option<(EncryptedMapValue, FileMetadata)>, String> {
    let caller = ic_cdk::api::msg_caller();
    let collection_name_blob = bytebuf_to_blob(collection_name)?;
    let collection_id = (collection_owner, collection_name_blob);
    let file_key = bytebuf_to_blob(file_id)?;
    
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps
            .as_mut()
            .unwrap()
            .insert_encrypted_value(caller, collection_id, file_key, encrypted_file_data)
            .map(|opt_prev_value| {
                FILE_METADATA.with_borrow_mut(|metadata| {
                    let metadata_key = (collection_owner, collection_name_blob, file_key);
                    let metadata_value = metadata
                        .get(&metadata_key)
                        .map(|m| m.update(filename.clone(), tags.clone(), description.clone()))
                        .unwrap_or(FileMetadata::new(filename, content_type, file_size, caller, tags, description));
                    opt_prev_value.zip(metadata.insert(metadata_key, metadata_value))
                })
            })
    })
}

#[update]
fn remove_file_from_collection(
    collection_owner: Principal,
    collection_name: ByteBuf,
    file_id: ByteBuf,
) -> Result<Option<(EncryptedMapValue, FileMetadata)>, String> {
    let collection_name_blob = bytebuf_to_blob(collection_name)?;
    let collection_id = (collection_owner, collection_name_blob);
    let file_key = bytebuf_to_blob(file_id)?;
    
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps
            .as_mut()
            .unwrap()
            .remove_encrypted_value(ic_cdk::api::msg_caller(), collection_id, file_key)
            .map(|opt_prev_value| {
                FILE_METADATA.with_borrow_mut(|metadata| {
                    let metadata_key = (collection_owner, collection_name_blob, file_key);
                    opt_prev_value.zip(metadata.remove(&metadata_key))
                })
            })
    })
}

// ===== SHARING FUNCTIONS (USERNAME-FRIENDLY) =====
#[update]
fn share_collection_with_user(
    collection_name: ByteBuf,
    username: String,
    access_rights: AccessRights,
) -> Result<Option<AccessRights>, String> {
    let caller = ic_cdk::api::msg_caller();
    
    // Get user by username
    let user = USERS.with_borrow(|users| {
        users.get(&username).ok_or("User not found".to_string())
    })?;
    
    let collection_name_blob = bytebuf_to_blob(collection_name)?;
    let collection_id = (caller, collection_name_blob);
    
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.as_mut().unwrap().set_user_rights(
            caller,
            collection_id,
            user.principal,
            access_rights,
        )
    })
}

#[update]
fn remove_user_from_collection(
    collection_name: ByteBuf,
    username: String,
) -> Result<Option<AccessRights>, String> {
    let caller = ic_cdk::api::msg_caller();
    
    // Get user by username
    let user = USERS.with_borrow(|users| {
        users.get(&username).ok_or("User not found".to_string())
    })?;
    
    let collection_name_blob = bytebuf_to_blob(collection_name)?;
    let collection_id = (caller, collection_name_blob);
    
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps
            .as_mut()
            .unwrap()
            .remove_user(caller, collection_id, user.principal)
    })
}

// ===== VETKEYS FUNCTIONS (UNCHANGED) =====
#[update]
async fn get_vetkey_verification_key() -> VetKeyVerificationKey {
    ENCRYPTED_MAPS
        .with_borrow(|encrypted_maps| {
            encrypted_maps
                .as_ref()
                .unwrap()
                .get_vetkey_verification_key()
        })
        .await
}

#[update]
async fn get_encrypted_vetkey(
    collection_owner: Principal,
    collection_name: ByteBuf,
    transport_key: TransportKey,
) -> Result<VetKey, String> {
    let collection_name_blob = bytebuf_to_blob(collection_name)?;
    let collection_id = (collection_owner, collection_name_blob);
    Ok(ENCRYPTED_MAPS
        .with_borrow(|encrypted_maps| {
            encrypted_maps.as_ref().unwrap().get_encrypted_vetkey(
                ic_cdk::api::msg_caller(),
                collection_id,
                transport_key,
            )
        })?
        .await)
}

// ===== UTILITY FUNCTIONS =====
fn bytebuf_to_blob(buf: ByteBuf) -> Result<Blob<32>, String> {
    Blob::try_from(buf.as_ref()).map_err(|_| "too large input".to_string())
}

ic_cdk::export_candid!();

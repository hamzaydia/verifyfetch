use sha2::{Digest, Sha256, Sha384, Sha512};
use wasm_bindgen::prelude::*;

// Initialize panic hook for better error messages in dev
#[cfg(feature = "console_error_panic_hook")]
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Base64 encoding table (standard alphabet)
const BASE64_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Encode bytes to base64 string
fn encode_base64(data: &[u8]) -> String {
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
        let b2 = chunk.get(2).copied().unwrap_or(0) as usize;

        result.push(BASE64_ALPHABET[b0 >> 2] as char);
        result.push(BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);

        if chunk.len() > 1 {
            result.push(BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(BASE64_ALPHABET[b2 & 0x3f] as char);
        } else {
            result.push('=');
        }
    }

    result
}

/// Streaming SHA-256 hasher
///
/// Usage from JavaScript:
/// ```js
/// const hasher = new Sha256Hasher();
/// hasher.update(chunk1);
/// hasher.update(chunk2);
/// const sri = hasher.finalize(); // Returns "sha256-BASE64..."
/// ```
#[wasm_bindgen]
pub struct Sha256Hasher {
    hasher: Sha256,
    bytes_processed: u64,
}

#[wasm_bindgen]
impl Sha256Hasher {
    /// Create a new SHA-256 hasher instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        set_panic_hook();

        Self {
            hasher: Sha256::new(),
            bytes_processed: 0,
        }
    }

    /// Update the hash with a chunk of data
    /// Call this for each chunk from the stream
    #[wasm_bindgen]
    pub fn update(&mut self, data: &[u8]) {
        self.hasher.update(data);
        self.bytes_processed += data.len() as u64;
    }

    /// Get the number of bytes processed so far
    #[wasm_bindgen(getter)]
    pub fn bytes_processed(&self) -> u64 {
        self.bytes_processed
    }

    /// Finalize and return the hash in SRI format (sha256-BASE64)
    /// This consumes the hasher - create a new one for additional hashing
    #[wasm_bindgen]
    pub fn finalize(self) -> String {
        let hash = self.hasher.finalize();
        format!("sha256-{}", encode_base64(&hash))
    }

    /// Finalize and return just the raw base64 hash (without prefix)
    #[wasm_bindgen]
    pub fn finalize_base64(self) -> String {
        let hash = self.hasher.finalize();
        encode_base64(&hash)
    }
}

impl Default for Sha256Hasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Streaming SHA-384 hasher
#[wasm_bindgen]
pub struct Sha384Hasher {
    hasher: Sha384,
    bytes_processed: u64,
}

#[wasm_bindgen]
impl Sha384Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        set_panic_hook();

        Self {
            hasher: Sha384::new(),
            bytes_processed: 0,
        }
    }

    #[wasm_bindgen]
    pub fn update(&mut self, data: &[u8]) {
        self.hasher.update(data);
        self.bytes_processed += data.len() as u64;
    }

    #[wasm_bindgen(getter)]
    pub fn bytes_processed(&self) -> u64 {
        self.bytes_processed
    }

    #[wasm_bindgen]
    pub fn finalize(self) -> String {
        let hash = self.hasher.finalize();
        format!("sha384-{}", encode_base64(&hash))
    }

    #[wasm_bindgen]
    pub fn finalize_base64(self) -> String {
        let hash = self.hasher.finalize();
        encode_base64(&hash)
    }
}

impl Default for Sha384Hasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Streaming SHA-512 hasher
#[wasm_bindgen]
pub struct Sha512Hasher {
    hasher: Sha512,
    bytes_processed: u64,
}

#[wasm_bindgen]
impl Sha512Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        set_panic_hook();

        Self {
            hasher: Sha512::new(),
            bytes_processed: 0,
        }
    }

    #[wasm_bindgen]
    pub fn update(&mut self, data: &[u8]) {
        self.hasher.update(data);
        self.bytes_processed += data.len() as u64;
    }

    #[wasm_bindgen(getter)]
    pub fn bytes_processed(&self) -> u64 {
        self.bytes_processed
    }

    #[wasm_bindgen]
    pub fn finalize(self) -> String {
        let hash = self.hasher.finalize();
        format!("sha512-{}", encode_base64(&hash))
    }

    #[wasm_bindgen]
    pub fn finalize_base64(self) -> String {
        let hash = self.hasher.finalize();
        encode_base64(&hash)
    }
}

impl Default for Sha512Hasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience function for one-shot hashing (small files only)
/// For large files, use the streaming Sha256Hasher instead
#[wasm_bindgen]
pub fn hash_sha256(data: &[u8]) -> String {
    let hash = Sha256::digest(data);
    format!("sha256-{}", encode_base64(&hash))
}

/// Convenience function for one-shot SHA-384 hashing
#[wasm_bindgen]
pub fn hash_sha384(data: &[u8]) -> String {
    let hash = Sha384::digest(data);
    format!("sha384-{}", encode_base64(&hash))
}

/// Convenience function for one-shot SHA-512 hashing
#[wasm_bindgen]
pub fn hash_sha512(data: &[u8]) -> String {
    let hash = Sha512::digest(data);
    format!("sha512-{}", encode_base64(&hash))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_streaming() {
        let mut hasher = Sha256Hasher::new();
        hasher.update(b"hello ");
        hasher.update(b"world");
        let result = hasher.finalize();

        // Verify against known SHA-256 hash of "hello world"
        assert_eq!(result, "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=");
    }

    #[test]
    fn test_sha256_oneshot() {
        let result = hash_sha256(b"hello world");
        assert_eq!(result, "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=");
    }

    #[test]
    fn test_sha384_streaming() {
        let mut hasher = Sha384Hasher::new();
        hasher.update(b"hello world");
        let result = hasher.finalize();

        // Verify it starts with sha384-
        assert!(result.starts_with("sha384-"));
    }

    #[test]
    fn test_sha512_streaming() {
        let mut hasher = Sha512Hasher::new();
        hasher.update(b"hello world");
        let result = hasher.finalize();

        // Verify it starts with sha512-
        assert!(result.starts_with("sha512-"));
    }

    #[test]
    fn test_bytes_processed() {
        let mut hasher = Sha256Hasher::new();
        assert_eq!(hasher.bytes_processed(), 0);

        hasher.update(b"hello");
        assert_eq!(hasher.bytes_processed(), 5);

        hasher.update(b" world");
        assert_eq!(hasher.bytes_processed(), 11);
    }

    #[test]
    fn test_empty_input() {
        let hasher = Sha256Hasher::new();
        let result = hasher.finalize();
        // SHA-256 of empty string
        assert_eq!(result, "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=");
    }
}

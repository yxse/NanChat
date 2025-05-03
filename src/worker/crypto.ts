import argon2 from "argon2-browser/dist/argon2-bundled.min.js";

// Crypto Versioning Support with Extensible Encryption Mechanisms

enum CryptoVersion {
  V1 = 1, // Initial version with PBKDF2 and AES-CBC
  V2 = 2, // Version with Argon2 and AES-GCM
}

enum KdfAlgorithm {
  PBKDF2_SHA256 = 1,
  ARGON2ID = 2,
}

enum EncryptionAlgorithm {
  AES_CBC = 1,
  AES_GCM = 2,
}

interface CryptoConfig {
  version: CryptoVersion;
  kdfAlgorithm: KdfAlgorithm;
  encryptionAlgorithm: EncryptionAlgorithm;
  iterations: number;
  saltLength: number;
  ivLength: number;
  memoryCost?: number;
  parallelism?: number;
}

const DEFAULT_CONFIGS: Record<CryptoVersion, CryptoConfig> = {
  [CryptoVersion.V1]: {
    version: CryptoVersion.V1,
    kdfAlgorithm: KdfAlgorithm.PBKDF2_SHA256,
    encryptionAlgorithm: EncryptionAlgorithm.AES_CBC,
    iterations: 600000,
    saltLength: 16,
    ivLength: 16,
  },
  [CryptoVersion.V2]: {
    version: CryptoVersion.V2,
    kdfAlgorithm: KdfAlgorithm.ARGON2ID,
    encryptionAlgorithm: EncryptionAlgorithm.AES_GCM,
    iterations: 1,
    saltLength: 32,
    ivLength: 12,
    memoryCost: 47104, // 46 MB
    parallelism: 1,
  },
};

interface Payload {
  seed?: string;
  password: string;
  encryptedMasterSeed?: string | Uint8Array;
  version?: CryptoVersion;
}

interface MessageEvent {
  data: {
    action: string;
    payload: Payload;
  };
}

interface WorkerResponse {
  result?: string | Uint8Array;
  error?: string;
}

class CryptoHandler {
  private static async deriveKeyPBKDF2(
    password: string, 
    salt: Uint8Array, 
    config: CryptoConfig
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      { 
        name: "PBKDF2", 
        salt, 
        iterations: config.iterations, 
        hash: "SHA-512" 
      },
      keyMaterial,
      { 
        name: config.encryptionAlgorithm === EncryptionAlgorithm.AES_CBC 
          ? "AES-CBC" 
          : "AES-GCM", 
        length: 256 
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  private static async deriveKeyArgon2(
    password: string, 
    salt: Uint8Array, 
    config: CryptoConfig
  ): Promise<Uint8Array> {
    const result = await argon2.hash({
      pass: password,
      salt: salt,
      time: config.iterations,
      mem: config.memoryCost,
      hashLen: 32, // 256 bits
      parallelism: config.parallelism,
      type: argon2.ArgonType.Argon2id
    });

    return result.hash;
  }

  private static async deriveKey(
    password: string, 
    salt: Uint8Array, 
    config: CryptoConfig
  ): Promise<CryptoKey | Uint8Array> {
    switch (config.kdfAlgorithm) {
      case KdfAlgorithm.PBKDF2_SHA256:
        return this.deriveKeyPBKDF2(password, salt, config);
      case KdfAlgorithm.ARGON2ID:
        return this.deriveKeyArgon2(password, salt, config);
      default:
        throw new Error('Unsupported KDF Algorithm');
    }
  }

  static async encryptPair(
    seed: string, 
    password: string, 
    version: CryptoVersion = CryptoVersion.V1
  ): Promise<Uint8Array> {
    const config = DEFAULT_CONFIGS[version];
    const encoder = new TextEncoder();
    const seedData = encoder.encode(seed);

    const salt = crypto.getRandomValues(new Uint8Array(config.saltLength));
    const derivedKey = await this.deriveKey(password, salt, config);
    
    const iv = crypto.getRandomValues(new Uint8Array(config.ivLength));
    
    let encryptedData: ArrayBuffer;
    if (config.kdfAlgorithm === KdfAlgorithm.PBKDF2_SHA256) {
      const encryptOptions = config.encryptionAlgorithm === EncryptionAlgorithm.AES_CBC
        ? { name: "AES-CBC", iv }
        : { name: "AES-GCM", iv };

      encryptedData = await crypto.subtle.encrypt(
        encryptOptions,
        derivedKey as CryptoKey,
        seedData
      );
    } else {
      // For Argon2, we need to use AES manually since Web Crypto requires a CryptoKey
      const key = await crypto.subtle.importKey(
        "raw", 
        derivedKey as Uint8Array, 
        { name: "AES-GCM" }, 
        false, 
        ["encrypt"]
      );

      encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        seedData
      );
    }

    // Construct result with version, salt, iv, and encrypted data
    const encryptedResult = new Uint8Array(
      1 + config.saltLength + config.ivLength + encryptedData.byteLength
    );
    
    // First byte is the version
    encryptedResult[0] = version;
    encryptedResult.set(salt, 1);
    encryptedResult.set(iv, 1 + config.saltLength);
    encryptedResult.set(
      new Uint8Array(encryptedData), 
      1 + config.saltLength + config.ivLength
    );

    return encryptedResult;
  }

  static async decryptMasterSeed(
    encryptedMasterSeed: string | Uint8Array, 
    password: string
  ): Promise<string> {
    const data = typeof encryptedMasterSeed === "string"
      ? new Uint8Array(Buffer.from(encryptedMasterSeed, "hex"))
      : encryptedMasterSeed;

    // First byte is the version
    const version = data[0] as CryptoVersion;
    const config = DEFAULT_CONFIGS[version];

    const salt = data.slice(1, 1 + config.saltLength);
    const iv = data.slice(
      1 + config.saltLength, 
      1 + config.saltLength + config.ivLength
    );
    const encryptedData = data.slice(1 + config.saltLength + config.ivLength);

    const derivedKey = await this.deriveKey(password, salt, config);
    
    let decryptedData: ArrayBuffer;
    if (config.kdfAlgorithm === KdfAlgorithm.PBKDF2_SHA256) {
      const decryptOptions = config.encryptionAlgorithm === EncryptionAlgorithm.AES_CBC
        ? { name: "AES-CBC", iv }
        : { name: "AES-GCM", iv };

      decryptedData = await crypto.subtle.decrypt(
        decryptOptions,
        derivedKey as CryptoKey,
        encryptedData
      );
    } else {
      // For Argon2, we need to use AES manually since Web Crypto requires a CryptoKey
      const key = await crypto.subtle.importKey(
        "raw", 
        derivedKey as Uint8Array, 
        { name: "AES-GCM" }, 
        false, 
        ["decrypt"]
      );

      decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedData
      );
    }

    return new TextDecoder().decode(decryptedData);
  }
}

export async function encrypt(
  seed: string, 
  password: string, 
  version: CryptoVersion = CryptoVersion.V2
) {
  console.time("encrypt");
  const encryptedResult = await CryptoHandler.encryptPair(seed, password, version);
  console.timeEnd("encrypt");
  return Buffer.from(encryptedResult).toString("hex");
}

export async function decrypt(
  seedEncrypted: string | Uint8Array, 
  password: string
) {
  const decryptedResult = await CryptoHandler.decryptMasterSeed(seedEncrypted, password);
  return decryptedResult;
}

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;
  let result: WorkerResponse = {};
  try {
    if (action === "encrypt") {
      const encryptedResult = await CryptoHandler.encryptPair(
        payload.seed!, 
        payload.password, 
        payload.version
      );
      result.result = Buffer.from(encryptedResult).toString("hex");
    } else if (action === "decrypt") {
      const decryptedResult = await CryptoHandler.decryptMasterSeed(
        payload.encryptedMasterSeed!, 
        payload.password
      );
      result.result = decryptedResult;
    }
  } catch (err: any) {
    result.error = err.toString();
  }
  self.postMessage(result);
};
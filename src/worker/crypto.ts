// Really, please use the native API whenever possible.
// Don't even think of polyfilling node apis (sorry I do).
// No benchmark, but It got hella faster.

interface Payload {
  seed?: string;
  password: string;
  encryptedMasterSeed?: string | Uint8Array;
}

interface MessageEvent {
  // @ts-expect-error modifier
  data: {
    action: string;
    payload: Payload;
  };
}

interface WorkerResponse {
  result?: string | Uint8Array;
  error?: string;
}

const saltLength = 16;
const ivLength = 16;

const encryptPair = async (
  seed: string,
  password: string,
): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const seedData = encoder.encode(seed);

  const salt = crypto.getRandomValues(new Uint8Array(saltLength));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-512" },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    true,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    derivedKey,
    seedData,
  );

  const encryptedResult = new Uint8Array(
    saltLength + ivLength + encryptedData.byteLength,
  );
  encryptedResult.set(salt, 0);
  encryptedResult.set(iv, saltLength);
  encryptedResult.set(new Uint8Array(encryptedData), saltLength + ivLength);

  return encryptedResult;
};

const decryptMasterSeed = async (
  encryptedMasterSeed: string | Uint8Array,
  password: string,
): Promise<string> => {
  const data =
    typeof encryptedMasterSeed === "string"
      ? new Uint8Array(Buffer.from(encryptedMasterSeed, "hex"))
      : encryptedMasterSeed;
  const salt = data.slice(0, saltLength);
  const iv = data.slice(saltLength, saltLength + ivLength);
  const encryptedData = data.slice(saltLength + ivLength);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-512" },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    true,
    ["decrypt"],
  );

  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    derivedKey,
    encryptedData,
  );

  return new TextDecoder().decode(decryptedData);
};

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;
  let result: WorkerResponse = {};
  try {
    if (action === "encrypt") {
      const encryptedResult = await encryptPair(
        payload.seed!,
        payload.password,
      );
      result.result = Buffer.from(encryptedResult).toString("hex");
    } else if (action === "decrypt") {
      const decryptedResult = await decryptMasterSeed(
        payload.encryptedMasterSeed!,
        payload.password,
      );
      result.result = decryptedResult;
    }
  } catch (err: any) {
    result.error = err.toString();
  }
  self.postMessage(result);
};

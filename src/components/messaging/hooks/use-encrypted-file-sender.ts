import { useWallet } from "../../useWallet";
import { writeUint8ArrayToFile } from "../../../services/capacitor-chunked-file-writer";
import { getLocalFileName } from "../../../services/file-url";
import { getChatToken } from "../../../utils/storage";
import { clearUploadState, setUploadState } from "../../../services/upload-progress";

export const MAX_FILE_SIZE_MB = 100;

export type ExtraFileMeta = { duration?: number };

export type UploadStartInfo = {
    localId: string;
    previewUrl: string;
    name: string;
    type: string;
    size: number;
    imageDimensions?: { width: number; height: number };
    meta?: ExtraFileMeta;
};

export type UploadSuccessInfo = Omit<UploadStartInfo, "previewUrl"> & { url: string };

export const getImageDimensions = (file: Blob): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };
        img.src = url;
    });
};

// Encrypts files end-to-end for `accountTo` (the contact, or the group shared account) and uploads them.
// The message is shown in the chat right away (onUploadStart) and sent once the upload succeeds (onUploadSuccess).
export const useEncryptedFileSender = ({
    accountTo,
    onUploadStart,
    onUploadSuccess,
    onUploadCancel,
}: {
    accountTo: string | undefined;
    onUploadStart?: (file: UploadStartInfo) => void;
    onUploadSuccess?: (file: UploadSuccessInfo) => void;
    onUploadCancel?: (localId: string) => void;
}) => {
    const { activeAccount, activeAccountPk } = useWallet();

    const encryptInWorker = (fileUint8Array: Uint8Array, onWorker: (worker: Worker) => void): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL("../../../../src/worker/fileWorker.js", import.meta.url), { type: "module" });
            onWorker(worker);
            worker.onmessage = (e) => {
                worker.terminate();
                if (e.data.status === "success") resolve(e.data.encrypted);
                else reject(new Error(e.data.error || "Encryption failed"));
            };
            worker.onerror = (error) => {
                worker.terminate();
                reject(new Error(error.message || "Encryption failed"));
            };
            worker.postMessage({
                file: fileUint8Array,
                targetAccount: accountTo,
                decryptionKey: activeAccountPk,
                message: "file",
                type: "encrypt",
            });
        });
    };

    // XHR instead of fetch: fetch doesn't report upload progress
    const uploadWithProgress = (formData: FormData, token: string, onProgress: (p: number) => void, onXhr: (xhr: XMLHttpRequest) => void): Promise<any> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            onXhr(xhr);
            xhr.open("POST", import.meta.env.VITE_PUBLIC_BACKEND + "/upload/upload-encrypted-file");
            xhr.setRequestHeader("token", token);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded / e.total);
            };
            xhr.onload = () => {
                let data: any = {};
                try { data = JSON.parse(xhr.responseText); } catch (error) {}
                if (xhr.status >= 200 && xhr.status < 300 && !data.error) resolve(data);
                else reject(new Error(data.error || "Upload failed"));
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.onabort = () => reject(new Error("Upload cancelled"));
            xhr.send(formData);
        });
    };

    // getFileToUpload resolves the final file (eg. compressed image), the bubble shows progress meanwhile.
    const sendFile = async (originalFile: File, getFileToUpload: () => Promise<File | Blob> = async () => originalFile, meta?: ExtraFileMeta) => {
        const localId = "upload-" + Math.random().toString(36).slice(2);
        const isImage = originalFile.type.startsWith("image");
        let imageDimensions: { width: number; height: number } | undefined = undefined;
        if (isImage) {
            try {
                imageDimensions = await getImageDimensions(originalFile);
            } catch (error) {
                console.warn("Could not get image dimensions:", error);
            }
        }

        let cancelled = false;
        let worker: Worker | null = null;
        let xhr: XMLHttpRequest | null = null;
        const cancel = () => {
            cancelled = true;
            worker?.terminate();
            xhr?.abort();
            clearUploadState(localId);
            onUploadCancel?.(localId);
        };

        const run = async () => {
            setUploadState(localId, { stage: "preparing", progress: 0, error: undefined, retry: undefined });
            try {
                const result = await getFileToUpload();
                if (cancelled) return;
                // compressors may return a Blob (Compressor.js sets a name on it, adjusted when it changes the format)
                const file = result instanceof File ? result : new File([result], (result as any).name || originalFile.name, { type: result.type || originalFile.type });
                if (file.size / 1024 / 1024 >= MAX_FILE_SIZE_MB) {
                    throw new Error(`File must be smaller than ${MAX_FILE_SIZE_MB}MB`);
                }
                if (isImage && result !== originalFile) {
                    try {
                        imageDimensions = await getImageDimensions(file);
                    } catch (error) {}
                }

                setUploadState(localId, { stage: "encrypting" });
                const fileUint8Array = new Uint8Array(await file.arrayBuffer());
                const encrypted = await encryptInWorker(fileUint8Array, (w) => (worker = w));
                if (cancelled) return;

                const formData = new FormData();
                formData.append("file", new Blob([encrypted], { type: file.type }));
                formData.append("fileName", file.name);
                formData.append("fileType", file.type);
                formData.append("fileSize", String(file.size));
                if (imageDimensions) {
                    formData.append("imageHeight", String(imageDimensions.height));
                    formData.append("imageWidth", String(imageDimensions.width));
                }
                formData.append("account", activeAccount);

                setUploadState(localId, { stage: "uploading", progress: 0 });
                let lastPercent = 0;
                const data = await uploadWithProgress(formData, await getChatToken(activeAccountPk), (progress) => {
                    const percent = Math.floor(progress * 100);
                    if (percent === lastPercent) return; // avoid re-rendering on every chunk
                    lastPercent = percent;
                    setUploadState(localId, { progress });
                }, (x) => (xhr = x));
                if (cancelled) return;

                // save the file before sending, so the sender gets it instantly without decrypting it again
                const fileId = getLocalFileName(data.url); // same name MessageFile reads it back from
                if (fileId) {
                    await writeUint8ArrayToFile(fileId, fileUint8Array, { name: file.name, type: file.type });
                }

                onUploadSuccess?.({
                    localId,
                    url: data.url,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    imageDimensions,
                    meta,
                });
                clearUploadState(localId);
            } catch (error: any) {
                if (cancelled) return;
                console.error("File upload failed:", error);
                setUploadState(localId, { stage: "error", error: error.message, retry: run });
            }
        };

        setUploadState(localId, { stage: "preparing", progress: 0, cancel });
        onUploadStart?.({
            localId,
            previewUrl: URL.createObjectURL(originalFile),
            name: originalFile.name,
            type: originalFile.type,
            size: originalFile.size,
            imageDimensions,
            meta,
        });
        run();
    };

    return { sendFile };
};

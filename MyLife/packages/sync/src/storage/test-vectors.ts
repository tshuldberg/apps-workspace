import nacl from 'tweetnacl';
import type { EncodeBackupInput } from './backup-format';

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);

export const VECTOR_RECOVERY_KEY =
  'MKR1-000G4-0R40M-30E20-9185G-R38E1-W8124-GK2GA-HC5RR-34D1P-70X3R-FKV50';

export const VECTOR_RECOVERY_KEY_BYTES = Uint8Array.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
  0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
]);

export const VECTOR_SIGNING_SEED = Uint8Array.from([
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
  0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
  0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
]);

export const VECTOR_SEALED_RECOVERY_BUNDLE =
  'nB8rznZ98dO9991bmV8mB1XNkuP5v5de.4fvvrcR4BExezLN8T1zPAiOyEra1tpaM2R3j/kBq3tRUgmxK4pBANnhxojzXe27HzK4YNsocBbCeA2PyiCBys+PVvEEz0o4XgdT24B7aUznptGUC/jSSqB6q7TQ+WE1YuGTZ7WijtjUqemXBmAZnxLwKRU8jlc3tRzxeDHyXIJlMXW80jebBVTwJyRvYUX/gb/0rPBBC0doqPoRK3hdMveqgfoD94Vab9YWtPjQvWS3rKaOT1I2QFUazlwImJ5Zuw/upnjz8uv1pH4nn9KpyPTSPOLlEbe1LjVIZkI6ReRtczSZx2ZC24YghH5I+pjMKhM2UdWC+mSaCNX3C3XmPQMVc8kxleSvlRdCLbokN+m9m4Dcbn3xbBwkmZGkRzyLwsOeaTmvwnaENIDgV9PIyWxLCOdJXQnp6I8bL2JLYHy60n4U1KOQoYDSFKgjAhWLHmcVB3YfUXoHTidS6sCNNkGudD3EvxzypKIGgBfgJJtVnEIYJoaed5yQehEobOwxd5kq0tGl4lmH8nVOZZ7r6Tsj+ExmbBUVZgANvfxVV/hWwrgmfVw95xWhWddIZNzyq5kZU1nZ4RLoaROQXAh+vOg2LWuu2EnSgKEo=';

export function vectorNonceSource(index: number): Uint8Array {
  return Uint8Array.from(
    { length: nacl.secretbox.nonceLength },
    (_, byteIndex) => (0x40 + index * nacl.secretbox.nonceLength + byteIndex) & 0xff,
  );
}

const signingKeyPair = nacl.sign.keyPair.fromSeed(VECTOR_SIGNING_SEED);

export const VECTOR_DATABASE_CHUNKS = [
  utf8('vector sqlite snapshot chunk zero'),
  utf8('vector sqlite snapshot chunk one'),
] as const;

export const VECTOR_OBJECTS = [
  {
    objectId: 'cipher-object-0001',
    dataClass: 'attachment',
    chunks: [utf8('vector attachment chunk zero'), utf8('vector attachment chunk one')],
  },
  {
    objectId: 'cipher-object-0002',
    dataClass: 'library_object',
    chunks: [utf8('vector library object chunk zero')],
  },
] as const;

export const VECTOR_BACKUP_INPUT: EncodeBackupInput = {
  recoveryKey: VECTOR_RECOVERY_KEY,
  backupId: 'vector-backup-0001',
  createdAt: '2026-07-14T12:00:00.000Z',
  schemaVersion: 41,
  migrationVersion: 12,
  appVersion: '1.0.0-vector',
  dataClassVersions: {
    attachment: 7,
    database: 3,
    library_object: 2,
  },
  databaseChunks: VECTOR_DATABASE_CHUNKS,
  objects: VECTOR_OBJECTS,
  sealedRecoveryBundle: VECTOR_SEALED_RECOVERY_BUNDLE,
  signingIdentity: {
    deviceId: 'vector-device-0001',
    publicKey: signingKeyPair.publicKey,
    secretKey: signingKeyPair.secretKey,
  },
  nonceSource: vectorNonceSource,
};

export const BACKUP_V1_GOLDEN = {
  "backupRootKey": "33ece1ff8b4926157e20331b7187d9e6c856609cdeb9b673380b166299762d7a",
  "chunkKeys": {
    "manifest": "de4b88aea3453ec99500b575a5b21e13b9db8775659b1bb980cbfb63f8564c99",
    "database0": "d12ea6cf3977d3741d81de2650c500529d7357ceae4ed8a52eec7848b44acee2",
    "database1": "aae718edc2329956a543a77f64f1445b6ebf7025c45ec218869eb61aae61301b",
    "object0001Chunk0": "dd1d840364ec0049105368dd6bef5163f750dbb439984db0ba8e3c6356550f6a",
    "object0001Chunk1": "0b3ef6fdfc62f326b968809e8c4f48b208c2afd77a7eb3351ddb0cdca0ade215",
    "object0002Chunk0": "1643704913538869f0ac8560abb40e0d28a0400c2d122560edbfcd834b5356e0"
  },
  "ciphertextHashes": {
    "database": [
      "bf51a384e1e918652a249fb3ea97034b739bea653cf8fc83fd959d133a37fd9986cc766b65cac06a7ae6b2f4df3fe6a5e82b1af42b9ae2daeb48ad314cee258b",
      "a68eb5c76efeac2d55a6f63b01a5d54db6b1bd1d19f3442fa083b5f8c9ae791670e4212f6c329e02c5770bf44323ebf67cd933f829db386441cb3877bd631f26"
    ],
    "objects": [
      "f46c35ffbcb5d4b2d74c425d130ad61ed00b696a1000faf9efc003b1c6969406a31fd61a2022dee47bab2b0a2dac5c14749e10356d027cb2f097027186fa949c",
      "e486988bb8e046ca5360ee593f6531310da295cf4a4cd601639762f6afa53a9343259a51de3f038269c3af5857eee8677dd1ebb1aa42fee58f136af547483f7e",
      "2a539ec96507b2f4383616f1efe7ee2748d462722e91bb51c832908ac047ce2b4c6999ef0fd943414dace62057a6e913c4d7d3862ac8b7ecc2634624ac0af3e7"
    ]
  },
  "encryptedManifestHash": "ba32380d479cf3c99dd968bab69961e976d42d466571f592e5817f7e5f5481ecc4cce7cf715fb6d025a7db0c208dd26d0d34caafd05a1cf774cb01a503fbe568",
  "manifestSignature": "da741122905afd92cdcb8b3bca38d595ba504c07e81d9b3341d50fb24ea7a42ae2b5aa736e624f181b60ca0a9c57cf5c902d77ecf51af7f32b0ecb9e4459840f"
} as const;

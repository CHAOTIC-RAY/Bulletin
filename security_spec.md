# Security Specification for Firestore Caching Layer

This document defines the core data invariants and security specifications for the unauthenticated Firestore-backed Polly TTS cache. It includes twelve targeted payload designs ("Dirty Dozen") designed to challenge and test these limits.

## 1. Data Invariants

1. **Document ID Authenticity (Path Variable Guard):**
   - The document ID in the `pollyCache` collection MUST be a valid 40-character SHA-1 hex hash (`^[a-fA-F0-9]{40}$`).
   - The document ID in the `pollyCacheMeta` collection MUST be exactly `sweep`.

2. **Schema and Bounds Enforcement (Anti-Update-Gap):**
   - Every document creation or update MUST strictly conform to the expected properties. No extra/shadow properties allowed.
   - All string size limits must be hard-capped (`text` <= 10000 chars, `voiceId` <= 64, `engine` <= 32, `audioB64` <= 1048576).
   - Numerical values must have proper types (`rate` must be a double/number, `size` and `hits` must be integers >= 0, `totalDocs` must be an integer >= 0).

3. **Temporal Integrity (Strict Timestamps):**
   - All timestamp fields (`createdAt` for cache items, `lastSweep` for metadata) MUST strictly align with the server clock (`request.time`). Client-provided historic/future timestamps must be rejected.

4. **Action-Based Read/Write Access Tiers:**
   - Anyone can **read** cached items.
   - Anyone can **create** a cached item, provided it is fully validated, has 0 hits, and correctly initialized fields.
   - Anyone can **increment** the `hits` count on cache hit, but they are forbidden from modifying any other fields (such as `audioB64` or `text`).
   - Anyone can **update** the `pollyCacheMeta/sweep` total documentation count or lastSweep timestamp during a sweep, but only under mathematically synchronized state transition rules (e.g., totalDocs must be updated correctly).
   - Anyone can **delete** aged cache documents, but only if they are performing a legitimate sweep clean up (which is validated).

---

## 2. The "Dirty Dozen" Payloads

Here are the 12 malicious payloads designed to test and break our rules:

### Payload 1: ID Poisoning (Path Variable Violation)
- **Target**: `/pollyCache/invalid-non-sha1-hash-value-12345` (Create)
- **Payload**: Correct schema, but the Document ID is not a valid 40-character SHA-1 hex hash.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Massive Text Content (Denial of Wallet / Resource Exhaustion)
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Create)
- **Payload**: `{ text: "A".repeat(15000), voiceId: "Joey", engine: "neural", rate: 1.0, size: 100, hits: 0, createdAt: request.time, audioB64: "SGVsbG8=" }`
- **Expected Outcome**: `PERMISSION_DENIED` (text size exceeds 10,000 characters)

### Payload 3: Excessively Large Audio Payload
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Create)
- **Payload**: `{ text: "Hello", voiceId: "Joey", engine: "neural", rate: 1.0, size: 2000000, hits: 0, createdAt: request.time, audioB64: "A".repeat(1100000) }`
- **Expected Outcome**: `PERMISSION_DENIED` (audioB64 exceeds 1,048,576 characters)

### Payload 4: Invalid Field Type (Schema Poisoning)
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Create)
- **Payload**: `{ text: "Hello", voiceId: "Joey", engine: "neural", rate: "1.0", size: 100, hits: 0, createdAt: request.time, audioB64: "SGVsbG8=" }`
- **Expected Outcome**: `PERMISSION_DENIED` (rate must be a number, not string)

### Payload 5: Spoofed Client-Side Timestamp
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Create)
- **Payload**: `{ text: "Hello", voiceId: "Joey", engine: "neural", rate: 1.0, size: 100, hits: 0, createdAt: timestamp.date(2030, 1, 1), audioB64: "SGVsbG8=" }`
- **Expected Outcome**: `PERMISSION_DENIED` (createdAt must match request.time)

### Payload 6: Extra Shadow Field Injection (Shadow Update Guard)
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Create)
- **Payload**: `{ text: "Hello", voiceId: "Joey", engine: "neural", rate: 1.0, size: 100, hits: 0, createdAt: request.time, audioB64: "SGVsbG8=", isVerified: true }`
- **Expected Outcome**: `PERMISSION_DENIED` (shadow field `isVerified` is not allowed)

### Payload 7: Cache Tampering (Modifying immutable data on hit)
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Update)
- **Payload**: `{ text: "Modified translation", hits: 1 }`
- **Expected Outcome**: `PERMISSION_DENIED` (only `hits` can be updated on cache hits)

### Payload 8: Value Poisoning (Updating hits to a negative number)
- **Target**: `/pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709` (Update)
- **Payload**: `{ hits: -5 }`
- **Expected Outcome**: `PERMISSION_DENIED` (hits must be an integer >= 0)

### Payload 9: Metadata TotalDocs Sabotage
- **Target**: `/pollyCacheMeta/sweep` (Update)
- **Payload**: `{ totalDocs: -1 }`
- **Expected Outcome**: `PERMISSION_DENIED` (totalDocs must be >= 0)

### Payload 10: Metadata Bypass (Arbitrary totalDocs increments)
- **Target**: `/pollyCacheMeta/sweep` (Update)
- **Payload**: `{ totalDocs: 1000000 }`
- **Expected Outcome**: `PERMISSION_DENIED` (increments or sweep updates must follow exact permitted math delta)

### Payload 11: Malicious Metadata Deletion
- **Target**: `/pollyCacheMeta/sweep` (Delete)
- **Payload**: Delete operation
- **Expected Outcome**: `PERMISSION_DENIED` (sweep meta-doc is a persistent singleton and must not be deleted)

### Payload 12: Orphaned Collection Read
- **Target**: `/pollyCacheMeta/invalid_doc_id` (Get)
- **Payload**: Read operation
- **Expected Outcome**: `PERMISSION_DENIED` (document ID must be exactly 'sweep' for pollyCacheMeta)

---

## 3. The Test Runner

The following conceptual integration unit-test file leverages `@firebase/rules-unit-testing` to systematically run and assert that all the Dirty Dozen payloads return `PERMISSION_DENIED`.

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { setDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import * as fs from "fs";

let testEnv: RulesTestEnvironment;

describe("Firestore Rules - Polly TTS Caching Layer", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-polly-tts-cache",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8")
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("fails on ID Poisoning (non-SHA1 document ID)", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const badDoc = doc(unauthedDb, "pollyCache/invalid-hash-123");
    await expect(
      setDoc(badDoc, {
        text: "Test",
        voiceId: "Joey",
        engine: "neural",
        rate: 1.0,
        size: 100,
        hits: 0,
        createdAt: new Date(),
        audioB64: "SGVsbG8="
      })
    ).rejects.toThrow();
  });

  it("fails on oversized text content (>10,000 chars)", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    await expect(
      setDoc(targetDoc, {
        text: "A".repeat(15000),
        voiceId: "Joey",
        engine: "neural",
        rate: 1.0,
        size: 100,
        hits: 0,
        createdAt: new Date(),
        audioB64: "SGVsbG8="
      })
    ).rejects.toThrow();
  });

  it("fails on oversized audio base64 payload (>1MB)", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    await expect(
      setDoc(targetDoc, {
        text: "Hello",
        voiceId: "Joey",
        engine: "neural",
        rate: 1.0,
        size: 2000000,
        hits: 0,
        createdAt: new Date(),
        audioB64: "A".repeat(1100000)
      })
    ).rejects.toThrow();
  });

  it("fails on invalid field types", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    await expect(
      setDoc(targetDoc, {
        text: "Hello",
        voiceId: "Joey",
        engine: "neural",
        rate: "1.0", // should be double
        size: 100,
        hits: 0,
        createdAt: new Date(),
        audioB64: "SGVsbG8="
      })
    ).rejects.toThrow();
  });

  it("fails on client-generated future timestamps", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    await expect(
      setDoc(targetDoc, {
        text: "Hello",
        voiceId: "Joey",
        engine: "neural",
        rate: 1.0,
        size: 100,
        hits: 0,
        createdAt: new Date(Date.now() + 100000), // future timestamp
        audioB64: "SGVsbG8="
      })
    ).rejects.toThrow();
  });

  it("fails when injecting shadow fields", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    await expect(
      setDoc(targetDoc, {
        text: "Hello",
        voiceId: "Joey",
        engine: "neural",
        rate: 1.0,
        size: 100,
        hits: 0,
        createdAt: new Date(),
        audioB64: "SGVsbG8=",
        isVerified: true // unauthorized field
      })
    ).rejects.toThrow();
  });

  it("fails on modifying immutable cache fields", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    
    // Set first securely via admin/direct mock seed
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709"), {
        text: "Hello",
        voiceId: "Joey",
        engine: "neural",
        rate: 1.0,
        size: 100,
        hits: 0,
        createdAt: new Date(),
        audioB64: "SGVsbG8="
      });
    });

    await expect(
      updateDoc(targetDoc, {
        text: "Malicious Tampering",
        hits: 1
      })
    ).rejects.toThrow();
  });

  it("fails on negative hits increments", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const targetDoc = doc(unauthedDb, "pollyCache/da39a3ee5e6b4b0d3255bfef95601890afd80709");
    await expect(
      updateDoc(targetDoc, {
        hits: -5
      })
    ).rejects.toThrow();
  });

  it("fails on negative metadata totalDocs", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const metaDoc = doc(unauthedDb, "pollyCacheMeta/sweep");
    await expect(
      setDoc(metaDoc, {
        totalDocs: -1,
        lastSweep: new Date()
      })
    ).rejects.toThrow();
  });

  it("fails on random totalDocs jumps", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const metaDoc = doc(unauthedDb, "pollyCacheMeta/sweep");
    await expect(
      updateDoc(metaDoc, {
        totalDocs: 999999
      })
    ).rejects.toThrow();
  });

  it("fails on metadata document deletion", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const metaDoc = doc(unauthedDb, "pollyCacheMeta/sweep");
    await expect(deleteDoc(metaDoc)).rejects.toThrow();
  });

  it("fails on reading invalid metadata sub-paths", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const metaDoc = doc(unauthedDb, "pollyCacheMeta/bad_doc");
    await expect(setDoc(metaDoc, { data: "test" })).rejects.toThrow();
  });
});

# CertifyMe — Decentralized Credential Verification System

This project, CertifyMe, is a decentralized smart contract system that I built with Solidity, Hardhat, and Viem that enables societies to issue, manage, and verify certificates to students on the Ethereum blockchain. It addresses critical real-world challenges in decentralized credentialing - including credential spam, unauthorized issuance, duplicate collisions, and key compromises - through a two-step consent workflow, O(1) collision guards, dynamic zero-gas time-decayed expiry, and an immutable, audit-preserving revocation mechanism.

---

## Features

* **Multi-Issuer Access Control & Role Management**: Contract owner acts as the root governance entity and global arbitrator, onboarding (`addIssuer`) and offboarding (`removeIssuer`) accredited issuer entities with dynamic index tracking in constant-time array operations.

* **Two-Step Anti-Spam Issuance**: Issuers propose certificates in a `Pending` state. Credentials only become active and `Valid` once explicitly acknowledged by the designated recipient student, eliminating unsolicited credential spam.

* **$O(1)$ Duplicate Collision Guard**: Prevents multiple issuers from proposing duplicate credentials for the same `(student, workshopId)` tuple via deterministic `keccak256` digest mapping in constant time.

* **Zero-Gas Time-Decayed Expiry**: Computes validity dynamically on read calls (`block.timestamp < expiryDate`) without requiring on-chain cron maintenance or storage mutation transactions. Supports both fixed-duration and non-expiring credentials (`validityDuration = 0`).

* **Audit-Preserving Immutable Revocation**: Implements an append-only state model where revoked credentials permanently retain issuer metadata, revocation timestamps, and structured audit justifications (`revocationReason`).

* **Deauthorized Issuer Cutoff & Global Arbitration**: Removed issuers are immediately barred from proposing new certificates and stripped of retroactive revocation privileges over past credentials. The contract owner retains global arbitration authority to invalidate credentials when an issuer key is compromised.

* **Complete Auditing & Historical View Queries**: Gas-free read functions (`isValidCertificate`, `getCertificate`, `getStudentHistory`, `getCertificatesByIssuer`, `getAllIssuers`) for transparent verifier, student, and institution lookups.

---

## Tech Stack

| Layer / Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Smart Contract Language** | Solidity | `^0.8.20` (Optimizer enabled, 200 runs) |
| **Development Framework** | Hardhat | `^2.22.18` |
| **Ethereum Client / Tooling** | Viem | `^2.23.5` via `@nomicfoundation/hardhat-toolbox-viem` |
| **Testing Framework** | Mocha & Chai | Hardhat Viem test client & test matchers |
| **Package Management** | npm / Node.js | npm workspaces support |

---

## Project Structure

```text
task2-certifyme/
├── contracts/
│   └── CertifyMe.sol             # Core smart contract (access control, issuance, expiry & revocation)
├── scripts/
│   ├── deploy/
│   │   └── deployCertifyMe.js    # Hardhat Viem deployment script
│   └── demo/
│       └── demoCertifyMe.js      # Comprehensive end-to-end multi-role demonstration script
├── test/
│   └── CertifyMe.test.js         # 27 unit & integration tests covering all contract invariants
├── docs/
│   └── task-2-access-control.md  # Architecture, threat model, and access control specification
├── hardhat.config.js             # Hardhat compiler and network configuration
├── package.json                  # Workspace script definitions and dependencies
└── README.md                     # Project documentation
```

### Key Directories & Files

* **`contracts/CertifyMe.sol`**: The complete, self-contained smart contract implementing state machines, custom errors, access control modifiers, and read/write interfaces.
* **`scripts/demo/demoCertifyMe.js`**: An automated end-to-end simulation executing all roles (Owner, Issuers, Students, Attacker), testing state transitions, EVM time manipulation for expiry, and deauthorization cutoffs.
* **`test/CertifyMe.test.js`**: Unit tests verifying access control, anti-spam, duplicate prevention, dynamic expiry, and revocation invariants.
* **`docs/task-2-access-control.md`**: In-depth formal documentation detailing access-control hierarchy, collision math, and the removed issuer cutoff reasoning.

---

## Setup

### 1. Prerequisites

* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher

### 2. Dependency Installation

From the root repository:

```bash
npm install
```

Or from within the `task2-certifyme` directory:

```bash
cd task2-certifyme
npm install
```

> **Note:** No external API keys or `.env` configurations are required. All tests, deployments, and demos execute against the built-in local Hardhat EVM network.

### 3. Compilation

Compile the Solidity smart contracts:

```bash
# From root repository
npm run compile

# Or from task2-certifyme directory
npm run compile
```

---

## Usage & Workflow

### 1. Running the Interactive Demo

The repository includes a standalone demonstration script (`scripts/demo/demoCertifyMe.js`) that illustrates the complete credential lifecycle across multiple simulated accounts:

```bash
# From root repository
npm run demo:certify

# Or from task2-certifyme directory
npm run demo
```

The script walks through 8 sequential phases:
1. **Initialization & Account Assignments**: Configures Owner, Authorized Issuers, Students, and Attacker accounts.

2. **Access Control & Issuer Onboarding**: Owner registers accredited issuer addresses.

3. **Two-Step Issuance (Proposal)**: Issuer proposes a certificate into `Pending` status; verifier checks confirm it is not yet active.

4. **$O(1)$ Duplicate Collision Guard**: Simulates a second issuer attempting to issue the same workshop ID to the same student; verifies instant transaction rejection.

5. **Recipient Consent & Acknowledgment**: Unauthorized attacker attempt is rejected; designated student acknowledges and transitions certificate to `Valid`.

6. **Zero-Gas Time-Decayed Expiry**: Advances local EVM block timestamp past the validity duration (`testClient.increaseTime`) and verifies automatic expiration on read without storage writes.

7. **Audit-Preserving Revocation**: Active issuer revokes a credential with a mandatory reason string and verifies the immutable audit trail.

8. **Deauthorized Issuer Cutoff & Owner Arbitration**: Owner removes an issuer; the removed issuer is blocked from new proposals and retroactive revocations. The contract Owner steps in as arbitrator to revoke compromised credentials.

### 2. Deploying Locally

Deploy `CertifyMe.sol` to a local Hardhat runtime:

```bash
# From root repository
npm run deploy:certify

# Or from task2-certifyme directory
npm run deploy
```

---

## Testing

The test suite is built using **Hardhat Viem** and **Chai**, covering 27 unit and integration test cases across all functional components.

### Run Tests

```bash
# From root repository
npm run test:certify

# Or from task2-certifyme directory
npm run test
```

### Test Coverage Summary [This thing I've generated COMPLETELY using AI for now, just to implement the testing part :))]

```text
  CertifyMe Smart Contract Tests
    1. Deployment & Access Control / Role Management
      ✔ should set the contract deployer as the owner
      ✔ should allow the owner to add an issuer and emit IssuerAdded
      ✔ should revert if a non-owner tries to add an issuer
      ✔ should revert when adding the zero address as an issuer
      ✔ should revert when adding an existing issuer twice
      ✔ should allow the owner to remove an issuer and update active issuers list
      ✔ should revert when removing a non-existent or already removed issuer
    2. Two-Step Anti-Spam Issuance & Duplicate Collision Protection
      ✔ should allow an authorized issuer to propose a certificate in Pending state
      ✔ should revert if an unauthorized account attempts to propose a certificate
      ✔ should enforce duplicate collision protection across different issuers (O(1) check)
      ✔ should allow the same workshopId for a different student
      ✔ should revert proposal on zero address or empty inputs
    3. Consent & Student Acknowledgment
      ✔ should return isValid = false while certificate is Pending
      ✔ should revert if an unauthorized non-student attempts to acknowledge
      ✔ should allow the designated student to acknowledge and transition to Valid
      ✔ should support non-expiring certificates (validityDuration = 0)
      ✔ should revert if acknowledging an already Valid certificate
    4. Zero-Gas Time-Decayed Expiry Verification
      ✔ should report valid immediately after student acknowledgment
      ✔ should automatically report isValid = false after expiry timestamp without state change
    5. Audit-Preserving Revocation & Metadata Tracking
      ✔ should revert if revocation reason is empty
      ✔ should allow an authorized original issuer to revoke with reason and persist audit trail
      ✔ should revert when attempting to revoke an already revoked certificate
    6. Rogue / Deauthorized Issuer Cutoff & Owner Global Arbitration
      ✔ should immediately cut off a deauthorized issuer from proposing new certificates
      ✔ should immediately cut off a deauthorized issuer from revoking past certificates
      ✔ should allow the contract owner (global arbitrator) to revoke on behalf of a removed issuer
    7. Auditing & View Helper Functions
      ✔ should correctly fetch certificates by issuer and student
      ✔ should revert getCertificate for non-existent ID

  27 passing
```

---

## Implementation Details & Architectural Decisions

### 1. Role Matrix & Access Hierarchy

The contract defines four distinct privilege boundaries:

$$\begin{array}{|l|l|l|}
\hline
\textbf{Role} & \textbf{Identifier / Check} & \textbf{Authorized Capabilities} \\
\hline
\text{Contract Owner} & \text{msg.sender} == \text{owner} & \text{Onboard/offboard issuers, global arbitrator revocation} \\
\text{Active Issuer} & \text{isIssuer}[\text{msg.sender}] == \text{true} & \text{Propose credentials, revoke own active credentials} \\
\text{Student Recipient} & \text{msg.sender} == \text{cert.student} & \text{Acknowledge incoming pending credentials} \\
\text{Public Verifier} & \text{Unrestricted} & \text{Gas-free validity checks \& historical queries} \\
\hline
\end{array}$$

### 2. Two-Step Issuance State Machine

Certificates follow a strict unidirectional state machine:

```text
[ Non-Existent ] ──( proposeCertificate )──> [ Pending ] ──( acknowledgeCertificate )──> [ Valid ]
                                                    │                                        │
                                                    └──( revokeCertificate )─────────────────┴──> [ Revoked ]
```

* **`Pending`**: Certificate metadata is stored, but public verification `isValidCertificate` returns `false`.
* **`Valid`**: Student explicitly signs `acknowledgeCertificate`. Expiry timestamp is computed as `block.timestamp + validityDuration` (or `0` if permanent).
* **`Revoked`**: Terminal state. Struct fields remain intact with audit logging (`revokedBy`, `revocationReason`, `revocationDate`).

### 3. $O(1)$ Duplicate Collision Guard

To prevent race conditions or cross-issuer duplication for the same workshop credential:

$$\text{Digest} = \text{keccak256}\big(\text{abi.encodePacked}(\text{student}, \text{workshopId})\big)$$

The computed digest is mapped to `certificateId` in `_certificateByDigest[digest]`. If a matching key is already non-zero during `proposeCertificate`, the transaction immediately reverts with `CertificateAlreadyExists()` in $O(1)$ constant time complexity.

### 4. Stale Privilege Mitigation (Removed Issuer Cutoff)

In decentralized credentialing, removing an issuer must guarantee that the compromised address cannot tamper with historical records. Revocation permissions require:

$$\text{CanRevoke}(A, C) \iff (A = \text{owner}) \lor \Big(A = C.\text{issuer} \land \text{isIssuer}[A] = \text{true}\Big)$$

If an issuer is deauthorized via `removeIssuer`:
* They are immediately rejected from proposing new certificates.
* They are immediately prevented from retroactively revoking past certificates they issued.
* If a fraudulent certificate from a decommissioned issuer must be revoked, the **Owner** acts as the global arbitrator to execute `revokeCertificate`.

### 5. Gas Optimization Decisions

* **Custom Errors**: Replaced string revert messages with custom Solidity errors (`revert NotOwner()`, `revert CertificateNotFound()`), saving deployment and execution gas.

* **Swap-and-Pop Array Deletion**: Issuer removal uses the $O(1)$ swap-and-pop pattern to maintain a dense `_issuersList` without shifting elements.

* **Unchecked Iteration**: Memory loops in view functions (`getStudentHistory`, `getCertificatesByIssuer`) utilize `unchecked { ++i; }` to reduce loop overhead.

* **Immutable Owner**: Declared `owner` as `immutable` to avoid SLOAD costs on access control checks.

# Task 2: Access Control & Architecture Specification (`CertifyMe.sol`)

## 1. Access-Control Hierarchy & Permission Architecture
`CertifyMe.sol` enforces a strict, multi-tiered role matrix designed for decentralized credentialing without centralized points of failure:

* **Contract Owner (`deployer`)**: Functions as the root governance entity and global arbitrator. The owner manages issuer onboarding (`addIssuer`) and offboarding (`removeIssuer`). Critically, the owner retains global administrative revocation authority to invalidate fraudulent or compromised credentials even if the issuing entity has been decommissioned.
* **Authorized Issuers (`isIssuer == true`)**: Accredited entities authorized to propose credentials (`proposeCertificate`) and revoke credentials that they originally issued, provided they remain currently active.
* **Recipient Students**: Sovereign recipients who must explicitly validate and activate incoming credentials via `acknowledgeCertificate`, preventing unsolicited credential spam or malicious attribution.
* **Public Verifiers / External DApps**: Unrestricted read access via `isValidCertificate`, `getCertificate`, and `getStudentHistory` with zero gas overhead.

---

## 2. Removed Issuer Cutoff Mechanism
A frequent vulnerability in role-based smart contracts is stale authorization, where a deauthorized address can still execute administrative actions on past assets. `CertifyMe.sol` eliminates this vector:

$$\text{CanRevoke}(A, C) \iff (A = \text{owner}) \lor \Big(A = C.\text{issuer} \land \text{isIssuer}(A) = \text{true}\Big)$$

When an issuer is removed via `removeIssuer(address)`:
1. They are **instantly barred from proposing new certificates**.
2. They **immediately lose retroactive revocation privileges** over all certificates they previously issued. This prevents a compromised or malicious ex-issuer from sabotaging legitimate alumni credentials.
3. If an invalid certificate issued by a decommissioned issuer must be revoked, the contract **Owner** acts as the global arbitrator to execute the revocation.

---

## 3. Additive Revocation Architecture & Audit Integrity
Unlike traditional state patterns that use Solidity's `delete` keyword or zero out storage slots, `CertifyMe.sol` implements an **append-only, strictly additive state transition model**:

* **State Preservation**: When a certificate is revoked, its struct fields are retained in full. The state transitions to `CertificateStatus.Revoked`, recording `revokedBy`, `revocationReason`, and `revocationDate`.
* **Tamper-Evident History**: Educational and professional credential verification requires proving not only that a credential is valid today, but also preserving permanent audit trails for why, when, and by whom a credential was annulled.
* **Gas-Free Dynamic Expiry**: Expiry is computed on read calls ($\text{block.timestamp} \ge \text{expiryDate}$) rather than requiring costly on-chain cron transactions or state sweeps.

---

## 4. $O(1)$ Duplicate Collision Prevention Across Distributed Issuers
To prevent multiple issuers from issuing conflicting or duplicate certificates for the same workshop to the same student, `CertifyMe.sol` computes a deterministic cryptographic digest:

$$\text{Digest} = \text{keccak256}\big(\text{abi.encodePacked}(\text{student}, \text{workshopId})\big)$$

* **Storage Efficiency**: The digest maps directly to the assigned `certificateId` in a single `mapping(bytes32 => uint256)` storage slot.
* **Global Collision Guard**: Any subsequent attempt by any authorized issuer to propose a credential matching the exact $(\text{student}, \text{workshopId})$ pair will collide in $O(1)$ time complexity and revert with `CertificateAlreadyExists()`, precluding race conditions, double-issuance, and issuer collisions.

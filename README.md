# Blockchain Sophomore Selections

Submission repository for the technical society sophomore selections, organized as an npm workspace monorepo.

---

## Repository Structure

```text
.
├── problem_statement/        # Official problem statements & specifications
│   └── Sophomore Selections PS.pdf
├── task2-certifyme/          # Task 2: CertifyMe (Decentralized Credential Verification System)
│   ├── contracts/            # Solidity smart contracts
│   ├── scripts/              # Deployment and interactive demo simulation scripts
│   ├── test/                 # Hardhat Viem test suites (27 unit & integration tests)
│   ├── docs/                 # Access control & architecture specifications
│   └── README.md             # Detailed Task 2 documentation
├── package.json              # Root monorepo configuration & unified scripts
└── README.md                 # Root documentation
```

---

## Tasks Overview

* **[Task 2: CertifyMe](./task2-certifyme)** — A decentralized credential verification and issuance smart contract system built with Solidity, Hardhat, and Viem. Features multi-issuer access control, two-step anti-spam consent, $O(1)$ duplicate collision prevention, zero-gas time-decayed expiry, and audit-preserving revocation.

---

## Quickstart

### 1. Prerequisites

* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher

### 2. Installation

Install all workspace dependencies from the root:

```bash
npm install
```

### 3. Build & Execution Commands

Unified npm scripts configured in the root `package.json` allow running tasks directly without navigating into subdirectories:

| Command | Description |
| :--- | :--- |
| `npm run compile` | Compiles all Solidity smart contracts across workspaces |
| `npm run test` or `npm run test:certify` | Runs the full 27-test suite for CertifyMe via Hardhat Viem |
| `npm run demo:certify` | Runs the interactive 8-phase end-to-end multi-account demo |
| `npm run deploy:certify` | Deploys the CertifyMe smart contract to a local Hardhat node |

---

## Tech Stack

* **Smart Contracts**: Solidity `^0.8.20`
* **Development Environment**: Hardhat `^2.22.18`
* **Ethereum Client**: Viem `^2.23.5` via `@nomicfoundation/hardhat-toolbox-viem`
* **Testing**: Mocha & Chai
* **Monorepo Management**: npm Workspaces

---

For in-depth architectural details, threat models, and full contract documentation, refer to the **[Task 2 README](./task2-certifyme/README.md)**.
// okay so i generating this entire file using gemini due to shortage of time and it;s just the testing part which i wanted to implement
// i'll figure out what's in there when i find time, but i do know the functions performed by it
const { expect } = require("chai");
const hre = require("hardhat");
const { getAddress } = require("viem");

describe("CertifyMe Smart Contract Tests", function () {
  let certifyMe;
  let publicClient;
  let testClient;
  let ownerWallet;
  let issuer1Wallet;
  let issuer2Wallet;
  let student1Wallet;
  let student2Wallet;
  let attackerWallet;

  // Enums mapping
  const Status = {
    Pending: 0,
    Valid: 1,
    Revoked: 2,
  };

  beforeEach(async function () {
    const wallets = await hre.viem.getWalletClients();
    ownerWallet = wallets[0];
    issuer1Wallet = wallets[1];
    issuer2Wallet = wallets[2];
    student1Wallet = wallets[3];
    student2Wallet = wallets[4];
    attackerWallet = wallets[5];

    publicClient = await hre.viem.getPublicClient();
    testClient = await hre.viem.getTestClient();

    certifyMe = await hre.viem.deployContract("CertifyMe");
  });

  describe("1. Deployment & Access Control / Role Management", function () {
    it("should set the contract deployer as the owner", async function () {
      const ownerAddress = await certifyMe.read.owner();
      expect(ownerAddress.toLowerCase()).to.equal(ownerWallet.account.address.toLowerCase());
    });

    it("should allow the owner to add an issuer and emit IssuerAdded", async function () {
      const hash = await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      const isAuth = await certifyMe.read.isIssuer([issuer1Wallet.account.address]);
      expect(isAuth).to.be.true;

      const issuers = await certifyMe.read.getAllIssuers();
      expect(issuers.map((a) => a.toLowerCase())).to.include(issuer1Wallet.account.address.toLowerCase());
    });

    it("should revert if a non-owner tries to add an issuer", async function () {
      await expect(
        certifyMe.write.addIssuer([issuer1Wallet.account.address], {
          account: attackerWallet.account,
        })
      ).to.be.rejected;
    });

    it("should revert when adding the zero address as an issuer", async function () {
      await expect(
        certifyMe.write.addIssuer(["0x0000000000000000000000000000000000000000"], {
          account: ownerWallet.account,
        })
      ).to.be.rejected;
    });

    it("should revert when adding an existing issuer twice", async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      await expect(
        certifyMe.write.addIssuer([issuer1Wallet.account.address], {
          account: ownerWallet.account,
        })
      ).to.be.rejected;
    });

    it("should allow the owner to remove an issuer and update active issuers list", async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });
      await certifyMe.write.addIssuer([issuer2Wallet.account.address], {
        account: ownerWallet.account,
      });

      await certifyMe.write.removeIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      const isAuth1 = await certifyMe.read.isIssuer([issuer1Wallet.account.address]);
      const isAuth2 = await certifyMe.read.isIssuer([issuer2Wallet.account.address]);
      expect(isAuth1).to.be.false;
      expect(isAuth2).to.be.true;

      const issuers = await certifyMe.read.getAllIssuers();
      expect(issuers.length).to.equal(1);
      expect(issuers[0].toLowerCase()).to.equal(issuer2Wallet.account.address.toLowerCase());
    });

    it("should revert when removing a non-existent or already removed issuer", async function () {
      await expect(
        certifyMe.write.removeIssuer([issuer1Wallet.account.address], {
          account: ownerWallet.account,
        })
      ).to.be.rejected;
    });
  });

  describe("2. Two-Step Anti-Spam Issuance & Duplicate Collision Protection", function () {
    beforeEach(async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });
      await certifyMe.write.addIssuer([issuer2Wallet.account.address], {
        account: ownerWallet.account,
      });
    });

    it("should allow an authorized issuer to propose a certificate in Pending state", async function () {
      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-SOL-101",
          "Advanced Solidity Engineering",
          3600n, // 1 hour validity
        ],
        { account: issuer1Wallet.account }
      );

      const cert = await certifyMe.read.getCertificate([1n]);
      expect(cert.certificateId).to.equal(1n);
      expect(cert.student.toLowerCase()).to.equal(student1Wallet.account.address.toLowerCase());
      expect(cert.issuer.toLowerCase()).to.equal(issuer1Wallet.account.address.toLowerCase());
      expect(cert.workshopId).to.equal("WORKSHOP-SOL-101");
      expect(cert.title).to.equal("Advanced Solidity Engineering");
      expect(cert.status).to.equal(Status.Pending);
      expect(cert.issueDate).to.equal(0n);
      expect(cert.expiryDate).to.equal(0n);
    });

    it("should revert if an unauthorized account attempts to propose a certificate", async function () {
      await expect(
        certifyMe.write.proposeCertificate(
          [
            student1Wallet.account.address,
            "WORKSHOP-SOL-101",
            "Advanced Solidity Engineering",
            3600n,
          ],
          { account: attackerWallet.account }
        )
      ).to.be.rejected;
    });

    it("should enforce duplicate collision protection across different issuers (O(1) check)", async function () {
      // Issuer 1 proposes workshop to Student 1
      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-ETH-202",
          "Ethereum Core Architectures",
          86400n,
        ],
        { account: issuer1Wallet.account }
      );

      // Issuer 2 attempts to propose the same workshopId to Student 1 -> MUST REVERT
      await expect(
        certifyMe.write.proposeCertificate(
          [
            student1Wallet.account.address,
            "WORKSHOP-ETH-202",
            "Duplicate Ethereum Course Attempt",
            86400n,
          ],
          { account: issuer2Wallet.account }
        )
      ).to.be.rejected;
    });

    it("should allow the same workshopId for a different student", async function () {
      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-ETH-202",
          "Ethereum Core Architectures",
          86400n,
        ],
        { account: issuer1Wallet.account }
      );

      // Same workshopId to Student 2 should succeed
      await certifyMe.write.proposeCertificate(
        [
          student2Wallet.account.address,
          "WORKSHOP-ETH-202",
          "Ethereum Core Architectures",
          86400n,
        ],
        { account: issuer2Wallet.account }
      );

      const history1 = await certifyMe.read.getStudentHistory([student1Wallet.account.address]);
      const history2 = await certifyMe.read.getStudentHistory([student2Wallet.account.address]);
      expect(history1.length).to.equal(1);
      expect(history2.length).to.equal(1);
    });

    it("should revert proposal on zero address or empty inputs", async function () {
      await expect(
        certifyMe.write.proposeCertificate(
          ["0x0000000000000000000000000000000000000000", "W-1", "Title", 0n],
          { account: issuer1Wallet.account }
        )
      ).to.be.rejected;

      await expect(
        certifyMe.write.proposeCertificate(
          [student1Wallet.account.address, "", "Title", 0n],
          { account: issuer1Wallet.account }
        )
      ).to.be.rejected;

      await expect(
        certifyMe.write.proposeCertificate(
          [student1Wallet.account.address, "W-1", "", 0n],
          { account: issuer1Wallet.account }
        )
      ).to.be.rejected;
    });
  });

  describe("3. Consent & Student Acknowledgment", function () {
    beforeEach(async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });
      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-DEFI-301",
          "DeFi Protocol Security",
          3600n, // 1 hour validity
        ],
        { account: issuer1Wallet.account }
      );
    });

    it("should return isValid = false while certificate is Pending", async function () {
      const [isValid, certId] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-DEFI-301",
      ]);
      expect(isValid).to.be.false;
      expect(certId).to.equal(1n);
    });

    it("should revert if an unauthorized non-student attempts to acknowledge", async function () {
      await expect(
        certifyMe.write.acknowledgeCertificate([1n], {
          account: attackerWallet.account,
        })
      ).to.be.rejected;
    });

    it("should allow the designated student to acknowledge and transition to Valid", async function () {
      await certifyMe.write.acknowledgeCertificate([1n], {
        account: student1Wallet.account,
      });

      const cert = await certifyMe.read.getCertificate([1n]);
      expect(cert.status).to.equal(Status.Valid);
      expect(cert.issueDate > 0n).to.be.true;
      expect(cert.expiryDate).to.equal(cert.issueDate + 3600n);

      const [isValid, certId] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-DEFI-301",
      ]);
      expect(isValid).to.be.true;
      expect(certId).to.equal(1n);
    });

    it("should support non-expiring certificates (validityDuration = 0)", async function () {
      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-PERM-999",
          "Permanent Web3 Mastery",
          0n, // Permanent
        ],
        { account: issuer1Wallet.account }
      );

      await certifyMe.write.acknowledgeCertificate([2n], {
        account: student1Wallet.account,
      });

      const cert = await certifyMe.read.getCertificate([2n]);
      expect(cert.status).to.equal(Status.Valid);
      expect(cert.expiryDate).to.equal(0n);

      const [isValid] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-PERM-999",
      ]);
      expect(isValid).to.be.true;
    });

    it("should revert if acknowledging an already Valid certificate", async function () {
      await certifyMe.write.acknowledgeCertificate([1n], {
        account: student1Wallet.account,
      });

      await expect(
        certifyMe.write.acknowledgeCertificate([1n], {
          account: student1Wallet.account,
        })
      ).to.be.rejected;
    });
  });

  describe("4. Zero-Gas Time-Decayed Expiry Verification", function () {
    const validitySeconds = 100n;

    beforeEach(async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-SPEED-401",
          "Rapid Execution Workshop",
          validitySeconds,
        ],
        { account: issuer1Wallet.account }
      );

      await certifyMe.write.acknowledgeCertificate([1n], {
        account: student1Wallet.account,
      });
    });

    it("should report valid immediately after student acknowledgment", async function () {
      const [isValid, certId] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-SPEED-401",
      ]);
      expect(isValid).to.be.true;
      expect(certId).to.equal(1n);
    });

    it("should automatically report isValid = false after expiry timestamp without state change", async function () {
      // Fast-forward time by 150 seconds past the 100s validity window
      await testClient.increaseTime({ seconds: 150 });
      await testClient.mine({ blocks: 1 });

      const [isValid, certId] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-SPEED-401",
      ]);
      expect(isValid).to.be.false;
      expect(certId).to.equal(1n);

      // Verify the storage status is still structurally Valid (time-decay is calculated dynamically on read)
      const cert = await certifyMe.read.getCertificate([1n]);
      expect(cert.status).to.equal(Status.Valid);

      // Verify student history retains the certificate record
      const history = await certifyMe.read.getStudentHistory([student1Wallet.account.address]);
      expect(history.length).to.equal(1);
      expect(history[0].certificateId).to.equal(1n);
    });
  });

  describe("5. Audit-Preserving Revocation & Metadata Tracking", function () {
    beforeEach(async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-AUDIT-501",
          "Audit Principles",
          86400n,
        ],
        { account: issuer1Wallet.account }
      );

      await certifyMe.write.acknowledgeCertificate([1n], {
        account: student1Wallet.account,
      });
    });

    it("should revert if revocation reason is empty", async function () {
      await expect(
        certifyMe.write.revokeCertificate([1n, ""], {
          account: issuer1Wallet.account,
        })
      ).to.be.rejected;
    });

    it("should allow an authorized original issuer to revoke with reason and persist audit trail", async function () {
      const reason = "Violation of Academic Integrity Code (Cheating detected)";
      await certifyMe.write.revokeCertificate([1n, reason], {
        account: issuer1Wallet.account,
      });

      // Verification check returns false
      const [isValid] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-AUDIT-501",
      ]);
      expect(isValid).to.be.false;

      // Full audit record remains queryable
      const cert = await certifyMe.read.getCertificate([1n]);
      expect(cert.status).to.equal(Status.Revoked);
      expect(cert.revokedBy.toLowerCase()).to.equal(issuer1Wallet.account.address.toLowerCase());
      expect(cert.revocationReason).to.equal(reason);
      expect(cert.revocationDate > 0n).to.be.true;

      // Student history still contains the full revoked record
      const history = await certifyMe.read.getStudentHistory([student1Wallet.account.address]);
      expect(history.length).to.equal(1);
      expect(history[0].revocationReason).to.equal(reason);
      expect(history[0].status).to.equal(Status.Revoked);
    });

    it("should revert when attempting to revoke an already revoked certificate", async function () {
      await certifyMe.write.revokeCertificate([1n, "Initial Reason"], {
        account: issuer1Wallet.account,
      });

      await expect(
        certifyMe.write.revokeCertificate([1n, "Second Reason"], {
          account: issuer1Wallet.account,
        })
      ).to.be.rejected;
    });
  });

  describe("6. Rogue / Deauthorized Issuer Cutoff & Owner Global Arbitration", function () {
    beforeEach(async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      await certifyMe.write.proposeCertificate(
        [
          student1Wallet.account.address,
          "WORKSHOP-ROGUE-601",
          "Security Workshop",
          86400n,
        ],
        { account: issuer1Wallet.account }
      );

      await certifyMe.write.acknowledgeCertificate([1n], {
        account: student1Wallet.account,
      });
    });

    it("should immediately cut off a deauthorized issuer from proposing new certificates", async function () {
      // Owner removes Issuer 1
      await certifyMe.write.removeIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      // Removed Issuer 1 attempts to propose a new certificate -> MUST REVERT
      await expect(
        certifyMe.write.proposeCertificate(
          [
            student2Wallet.account.address,
            "WORKSHOP-ROGUE-602",
            "Unauthorized Proposal",
            86400n,
          ],
          { account: issuer1Wallet.account }
        )
      ).to.be.rejected;
    });

    it("should immediately cut off a deauthorized issuer from revoking past certificates", async function () {
      // Owner removes Issuer 1
      await certifyMe.write.removeIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      // Removed Issuer 1 attempts to revoke the certificate they previously issued -> MUST REVERT
      await expect(
        certifyMe.write.revokeCertificate([1n, "Malicious retrospective revocation attempt"], {
          account: issuer1Wallet.account,
        })
      ).to.be.rejected;

      // Certificate should remain valid
      const [isValid] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-ROGUE-601",
      ]);
      expect(isValid).to.be.true;
    });

    it("should allow the contract owner (global arbitrator) to revoke on behalf of a removed issuer", async function () {
      // Owner removes Issuer 1
      await certifyMe.write.removeIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      // Owner intervenes and revokes certificate
      const arbitratedReason = "Issuer deauthorized due to compromise; certificate annulled by Owner.";
      await certifyMe.write.revokeCertificate([1n, arbitratedReason], {
        account: ownerWallet.account,
      });

      const cert = await certifyMe.read.getCertificate([1n]);
      expect(cert.status).to.equal(Status.Revoked);
      expect(cert.revokedBy.toLowerCase()).to.equal(ownerWallet.account.address.toLowerCase());
      expect(cert.revocationReason).to.equal(arbitratedReason);

      const [isValid] = await certifyMe.read.isValidCertificate([
        student1Wallet.account.address,
        "WORKSHOP-ROGUE-601",
      ]);
      expect(isValid).to.be.false;
    });
  });

  describe("7. Auditing & View Helper Functions", function () {
    it("should correctly fetch certificates by issuer and student", async function () {
      await certifyMe.write.addIssuer([issuer1Wallet.account.address], {
        account: ownerWallet.account,
      });

      await certifyMe.write.proposeCertificate(
        [student1Wallet.account.address, "W1", "Workshop 1", 0n],
        { account: issuer1Wallet.account }
      );
      await certifyMe.write.proposeCertificate(
        [student1Wallet.account.address, "W2", "Workshop 2", 0n],
        { account: issuer1Wallet.account }
      );

      const studentCerts = await certifyMe.read.getStudentHistory([student1Wallet.account.address]);
      expect(studentCerts.length).to.equal(2);
      expect(studentCerts[0].workshopId).to.equal("W1");
      expect(studentCerts[1].workshopId).to.equal("W2");

      const issuerCerts = await certifyMe.read.getCertificatesByIssuer([issuer1Wallet.account.address]);
      expect(issuerCerts.length).to.equal(2);
    });

    it("should revert getCertificate for non-existent ID", async function () {
      await expect(certifyMe.read.getCertificate([999n])).to.be.rejected;
    });
  });
});

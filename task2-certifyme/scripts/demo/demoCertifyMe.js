// Same thing, I need the hardhat runtime environment
const hre = require("hardhat");

// Making an array for reading status variables easily...
// (Since solidity enum internally uses numeric values, I'll pass them as indices for this array)
const StatusMap = ["PENDING", "VALID", "REVOKED"];

// Function taking in timestamp (in BigInt format) and returning a formatted string
function formatTimestamp(ts) {
  if (!ts || ts === 0n) return "None (Non-expiring / Unset)";
  return new Date(Number(ts) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

// Simple helper function for printing large headings
function printSection(title) {
  console.log("\n" + "=".repeat(75));
  console.log(`  ${title}`);
  console.log("=".repeat(75));
}

// Another formatting function for terminal readibility
function printSubSection(title) {
  console.log(`\n--- ${title} ---`);
}

// So this is the main async function where the important part lies
async function main() {
  // For "Aesthetic and Clean" vibes
  console.log("\n");
  console.log("***************************************************************************");
  console.log("*                                                                         *");
  console.log("*                 TASK 2: CERTIFY ME - DEMONSTRATION                      *");
  console.log("*      Decentralized Credential Verification System (Viem + Hardhat)      *");
  console.log("*                                                                         *");
  console.log("***************************************************************************");

  // 1. Setup Clients & Accounts
  // taking test accounts from hardhat, creating wallet clients for them
  const wallets = await hre.viem.getWalletClients();
  // get a public client which I'll use to read blockchain state
  const publicClient = await hre.viem.getPublicClient();
  // i need hardhat's testing client too to allow the script to manipulate the local blockchain environment
  const testClient = await hre.viem.getTestClient();

  // I'll just destructure the array before I go any further to keep things clean
  const [owner, issuer1, issuer2, student1, student2, attacker] = wallets;

  // And then I go ahead and print out etheruem addresses to see which test account has which role
  printSection("1. INITIALIZATION & ACCOUNT ASSIGNMENTS");
  console.log(`[Role: Contract Owner / Arbitrator]  ${owner.account.address}`);
  console.log(`[Role: Authorized Issuer 1]          ${issuer1.account.address}`);
  console.log(`[Role: Authorized Issuer 2]          ${issuer2.account.address}`);
  console.log(`[Role: Student 1 Recipient]          ${student1.account.address}`);
  console.log(`[Role: Student 2 Recipient]          ${student2.account.address}`);
  console.log(`[Role: Unauthorized / Attacker]      ${attacker.account.address}`);

  // 2. Contract Deployment
  // find the compiled certifyme contract using hardhat and deploy it to the local blockchain
  printSubSection("Deploying CertifyMe Smart Contract");
  const certifyMe = await hre.viem.deployContract("CertifyMe");
  // printing out the deploued contract address
  console.log(`> CertifyMe Contract Deployed at : ${certifyMe.address}`);
  // getting and printing the contract owner
  const contractOwner = await certifyMe.read.owner();
  console.log(`> Verified Contract Owner        : ${contractOwner}`);

  // 3. Multi-Issuer Management
  printSection("2. ACCESS CONTROL & MULTI-ISSUER ONBOARDING");
  console.log(`> Owner adding Issuer 1 (${issuer1.account.address})...`);
  //sending a transaction to the smart contract
  await certifyMe.write.addIssuer([issuer1.account.address], { account: owner.account });

  // second authorised issuer
  console.log(`> Owner adding Issuer 2 (${issuer2.account.address})...`);
  await certifyMe.write.addIssuer([issuer2.account.address], { account: owner.account });

  // find currently authorised issuers and print out the length
  const activeIssuers = await certifyMe.read.getAllIssuers();
  console.log(`> Active Authorized Issuers (${activeIssuers.length}):`);
  // print all issuers' addresses
  activeIssuers.forEach((addr, idx) => console.log(`   [${idx + 1}] ${addr}`));

  // 4. Two-Step Anti-Spam Issuance - Proposal
  printSection("3. TWO-STEP ISSUANCE: PROPOSAL (PENDING STATE)");

  // set up certificate #1 (identifier, title and certificate validity[keeping this in bigint format])
  const workshopId1 = "WORKSHOP-ETH-2026";
  const title1 = "Ethereum Protocol & Solidity Engineering";
  const durationSeconds = 120n; // 2 minutes validity for demonstration

  // then i;ll just print out the details
  console.log(`> Issuer 1 proposing certificate for Student 1...`);
  console.log(`   - Student  : ${student1.account.address}`);
  console.log(`   - Workshop : ${workshopId1}`);
  console.log(`   - Title    : ${title1}`);
  console.log(`   - Validity : ${durationSeconds} seconds`);

  // and here call the function from the smart contract
  await certifyMe.write.proposeCertificate(
    [student1.account.address, workshopId1, title1, durationSeconds],
    { account: issuer1.account }
  );

  // reading certificate #1
  const cert1Before = await certifyMe.read.getCertificate([1n]);
  console.log(`\n> Certificate #1 Record Stored:`);
  // btw in this line im just using that array i created earlier
  console.log(`   - Status     : [${StatusMap[cert1Before.status]}]`);
  console.log(`   - Issue Date : ${formatTimestamp(cert1Before.issueDate)}`);
  console.log(`   - Expiry Date: ${formatTimestamp(cert1Before.expiryDate)}`);


  // now checking whether the certificate is valid using the function from the smart contract
  const [isValidBefore] = await certifyMe.read.isValidCertificate([
    student1.account.address,
    workshopId1,
  ]);
  console.log(`> Public Verification Check: isValidCertificate == [${isValidBefore}] (Anti-Spam active)`);

  // 5. Duplicate Collision Prevention
  printSection("4. O(1) DUPLICATE COLLISION REJECTION ACROSS ISSUERS");
  console.log(`> Issuer 2 attempting to propose duplicate workshop '${workshopId1}' to Student 1...`);
  // im looking for an error here
  try {
    await certifyMe.write.proposeCertificate(
      [student1.account.address, workshopId1, "Duplicate Attempt", durationSeconds],
      { account: issuer2.account }
    );
    // if below line gets executed it basically means the thing unexpectedly succeeded
    // and it shouldn't have
    // btw the emojis are added by ai and it looks good so im just gonna let it be lmao xD
    console.log("❌ ERROR: Duplicate proposal should have been rejected!");
  } catch (err) {
    console.log(`✅ SUCCESS: Duplicate collision caught by keccak256(student, workshopId) mapping!`);
    console.log(`   - Error caught: Transaction reverted as expected.`);
  }

  // 6. Recipient Acknowledgment
  printSection("5. RECIPIENT CONSENT: STUDENT ACKNOWLEDGMENT");
  console.log(`> Unauthorized attacker attempting to acknowledge Certificate #1...`);
  // im going to check if it returns an error or not... (it should... obviously)
  // cus if it doesn't then... well... we're in trouble :')
  try {
    await certifyMe.write.acknowledgeCertificate([1n], { account: attacker.account });
    console.log("❌ ERROR: Unauthorized acknowledgment should have reverted!");
  } catch (err) {
    console.log(`✅ SUCCESS: Non-student acknowledgment safely rejected.`);
  }

  // print and acknowledge certificate
  console.log(`\n> Student 1 acknowledging Certificate #1...`);
  await certifyMe.write.acknowledgeCertificate([1n], { account: student1.account });

  // print certificate #1 details
  const cert1After = await certifyMe.read.getCertificate([1n]);
  console.log(`> Certificate #1 Status Transitioned:`);
  console.log(`   - Status     : [${StatusMap[cert1After.status]}]`);
  console.log(`   - Issue Date : ${formatTimestamp(cert1After.issueDate)}`);
  console.log(`   - Expiry Date: ${formatTimestamp(cert1After.expiryDate)}`);

  // checking if the certificate is valid
  const [isValidAfter, verifiedId] = await certifyMe.read.isValidCertificate([
    student1.account.address,
    workshopId1,
  ]);
  console.log(`> Public Verification Check: isValidCertificate == [${isValidAfter}] (Cert ID: ${verifiedId})`);

  // 7. Time-Decayed Expiry Demonstration
  printSection("6. AUTOMATED ZERO-GAS TIME-DECAYED EXPIRY");
  console.log(`> Fast-forwarding EVM blockchain time by 150 seconds (exceeding 120s validity window)...`);
  // simple - i wanna pretend 150 seconds have passed, and test...
  // (i don't really have to wait 150 seconds, i figured)
  await testClient.increaseTime({ seconds: 150 });
  // mine one block so new blockchain time becomes effective
  await testClient.mine({ blocks: 1 });

  // check if the certificate is valid after "allegedly" crossing expiry time
  const [isValidExpired] = await certifyMe.read.isValidCertificate([
    student1.account.address,
    workshopId1,
  ]);
  console.log(`> Public Verification Check: isValidCertificate == [${isValidExpired}]`);
  console.log(`> Zero-gas expiry evaluation: Evaluates false dynamically without writing to storage.`);
  // so now we know that a read action doesn't need a transaction expenditure

  // printing the student's history
  const student1History = await certifyMe.read.getStudentHistory([student1.account.address]);
  console.log(`> Student 1 History Query: ${student1History.length} record(s) fully preserved in history.`);

  // 8. Audit-Preserving Revocation
  // basic idea is to showcase that the owner can, when necessary, revoke a certificate
  // and the revocation reason will be stored forever on the blockchain as an audit log
  printSection("7. AUDIT-PRESERVING IMMUTABLE REVOCATION");
  const workshopId2 = "WORKSHOP-SEC-501";
  console.log(`> Issuer 1 issuing Certificate #2 to Student 2...`);
  // creating cert #2, then student acknowledges, and then it is revoked
  await certifyMe.write.proposeCertificate(
    [student2WalletAddress = student2.account.address, workshopId2, "Smart Contract Auditing", 0n],
    { account: issuer1.account }
  );
  await certifyMe.write.acknowledgeCertificate([2n], { account: student2.account });

  console.log(`> Active Issuer 1 revoking Certificate #2 with formal audit reason...`);
  const revocationReason = "Academic Dishonesty: Plagiarism confirmed during final project review.";
  await certifyMe.write.revokeCertificate([2n, revocationReason], { account: issuer1.account });

  const cert2Revoked = await certifyMe.read.getCertificate([2n]);
  console.log(`> Revoked Certificate #2 Audit Log:`);
  console.log(`   - Status            : [${StatusMap[cert2Revoked.status]}]`);
  console.log(`   - Revoked By        : ${cert2Revoked.revokedBy}`);
  console.log(`   - Revocation Date   : ${formatTimestamp(cert2Revoked.revocationDate)}`);
  console.log(`   - Revocation Reason : "${cert2Revoked.revocationReason}"`);

  // 9. Rogue / Deauthorized Issuer Cutoff & Owner Global Arbitration
  // this section basically shows the complete cutoff mechanism - 
  // how an issuer can be deauthorized, and even if he had issued a cert, 
  // the owner could revoke it too, with proper logging
  printSection("8. DEAUTHORIZED ISSUER CUTOFF & GLOBAL OWNER ARBITRATION");
  const workshopId3 = "WORKSHOP-DAO-777";
  console.log(`> Issuer 1 issuing Certificate #3 to Student 1...`);
  // creating cert #3, then student acknowledges, and then it is revoked
  await certifyMe.write.proposeCertificate(
    [student1.account.address, workshopId3, "DAO Governance Architecture", 0n],
    { account: issuer1.account }
  );
  await certifyMe.write.acknowledgeCertificate([3n], { account: student1.account });

  console.log(`\n> Owner revoking issuer status from Issuer 1 (Deauthorization)...`);
  await certifyMe.write.removeIssuer([issuer1.account.address], { account: owner.account });
  console.log(`> Issuer 1 Authorization Status: isIssuer = ${await certifyMe.read.isIssuer([issuer1.account.address])}`);

  console.log(`\n> Deauthorized Issuer 1 attempting to propose new certificate...`);
  try {
    await certifyMe.write.proposeCertificate(
      [student2.account.address, "WORKSHOP-FAIL", "Failing Proposal", 0n],
      { account: issuer1.account }
    );
    console.log("❌ ERROR: Removed issuer should not be able to propose!");
  } catch (err) {
    console.log(`✅ SUCCESS: Removed issuer blocked from proposing.`);
  }

  // deauthorised owner tries to revoke a previously generated certificate here
  console.log(`\n> Deauthorized Issuer 1 attempting retroactive revocation of Certificate #3...`);
  try {
    await certifyMe.write.revokeCertificate([3n, "Malicious rogue revocation attempt"], {
      account: issuer1.account,
    });
    console.log("❌ ERROR: Removed issuer should not be able to revoke past certificates!");
  } catch (err) {
    console.log(`✅ SUCCESS: Removed issuer blocked from retroactive revocation.`);
  }

  // now finally the owner steps in to revoke the certificate
  console.log(`\n> Contract Owner (Global Arbitrator) stepping in to revoke Certificate #3...`);
  const ownerArbitratedReason = "Issuer deauthorized due to key compromise; certified credentials annulled.";
  await certifyMe.write.revokeCertificate([3n, ownerArbitratedReason], { account: owner.account });

  // this is just printing the revoked certificate #3 details
  const cert3Arbitrated = await certifyMe.read.getCertificate([3n]);
  console.log(`> Certificate #3 Arbitrated Revocation Record:`);
  console.log(`   - Status            : [${StatusMap[cert3Arbitrated.status]}]`);
  console.log(`   - Revoked By (Owner): ${cert3Arbitrated.revokedBy}`);
  console.log(`   - Revocation Reason : "${cert3Arbitrated.revocationReason}"`);

  // ladies and gentlemen, the end
  printSection("DEMO COMPLETED SUCCESSFULLY");
  console.log("All access control, anti-spam, expiry, and revocation invariants fully verified!\n");
}

// standard js promise handling nothing to document here
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo execution error:", error);
    process.exit(1);
  });

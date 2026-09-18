// So first I'm going to import the hardhat runtime environment (hre)
const hre = require("hardhat");

// All the stuff I want during deployment goes into this asynchronous function below
async function main() {
  // Just a heading for the formatting part lol
  console.log("====================================================");
  console.log("  CertifyMe Deployment (Viem / Hardhat)");
  console.log("====================================================");

  // So I'm getting the deployer account and the public client here
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // And now I'm just printing the deployer account and its balance
  // Just to know what's going on...
  console.log(`Deployer Account : ${deployer.account.address}`);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Deployer Balance : ${balance.toString()} wei\n`);

  // I'm gonna go ahead and deploy the contract with a print message
  console.log("Deploying CertifyMe contract...");
  const certifyMe = await hre.viem.deployContract("CertifyMe");

  // Here's the contract address 
  console.log(`\n>>> CertifyMe deployed successfully! <<<`);
  console.log(`Contract Address : ${certifyMe.address}`);

  // And here's the contract owner
  const owner = await certifyMe.read.owner();
  console.log(`Contract Owner   : ${owner}`);
  console.log("====================================================");

  // Returning the contract address for future use
  return certifyMe.address;
}

// And here the standard js promise handling part
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

// So apparently a specific module is required here
// Gemini ended up putting it in package.json
// So I'm just gonna go ahead and import it into this hardhat project
require("@nomicfoundation/hardhat-toolbox-viem");

// Coming to configure hardhat, but I don't really understand this
// Just gonna leave it here for now, I'll bother about learning it later
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

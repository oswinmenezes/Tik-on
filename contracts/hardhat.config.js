require("@nomicfoundation/hardhat-toolbox");

// To deploy, set these environment variables:
//   PRIVATE_KEY       — deployer wallet private key
//   POLYGONSCAN_KEY   — (optional) for contract verification on Polygonscan

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: {
      polygon: POLYGONSCAN_KEY,
      polygonAmoy: POLYGONSCAN_KEY,
    },
  },
};

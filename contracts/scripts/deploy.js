const hre = require("hardhat");

async function main() {
  const baseURI = "https://tik-on.example.com/metadata/";

  console.log("Deploying PropertyNFT...");
  const PropertyNFT = await hre.ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy(baseURI);
  await propertyNFT.waitForDeployment();

  const address = await propertyNFT.getAddress();
  console.log(`PropertyNFT deployed to: ${address}`);
  console.log(`Network: ${hre.network.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "ethers";

// ── After deploying, paste your contract address here ──────────────
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// Minimal ABI — only the functions the frontend needs
export const PROPERTY_NFT_ABI = [
  "function mintBatch(address to, uint256 n) external",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "event BatchMinted(address indexed to, uint256 startTokenId, uint256 count)",
];

// Polygon chain IDs
export const POLYGON_MAINNET_CHAIN_ID = "0x89";    // 137
export const POLYGON_AMOY_CHAIN_ID    = "0x13882"; // 80002

// Which network to target (switch to POLYGON_MAINNET_CHAIN_ID for production)
export const TARGET_CHAIN_ID = POLYGON_AMOY_CHAIN_ID;

/**
 * Returns an ethers.Contract instance connected to the given signer.
 */
export function getContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, PROPERTY_NFT_ABI, signer);
}

/**
 * Prompt MetaMask to switch to Polygon. If the network isn't added yet,
 * offer to add it automatically.
 */
export async function switchToPolygon(provider) {
  const targetId = TARGET_CHAIN_ID;
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: targetId }]);
  } catch (err) {
    // 4902 = chain not added
    if (err.code === 4902 || err?.data?.originalError?.code === 4902) {
      const isAmoy = targetId === POLYGON_AMOY_CHAIN_ID;
      await provider.send("wallet_addEthereumChain", [
        {
          chainId: targetId,
          chainName: isAmoy ? "Polygon Amoy Testnet" : "Polygon Mainnet",
          nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
          rpcUrls: isAmoy
            ? ["https://rpc-amoy.polygon.technology"]
            : ["https://polygon-rpc.com"],
          blockExplorerUrls: isAmoy
            ? ["https://amoy.polygonscan.com"]
            : ["https://polygonscan.com"],
        },
      ]);
    } else {
      throw err;
    }
  }
}

/**
 * Mint `n` property NFTs to `walletAddr`.
 * Returns the transaction receipt.
 */
export async function mintNFTs(signer, walletAddr, n) {
  const contract = getContract(signer);
  const tx = await contract.mintBatch(walletAddr, n);
  const receipt = await tx.wait();
  return { tx, receipt };
}

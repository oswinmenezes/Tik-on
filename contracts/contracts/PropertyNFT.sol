// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PropertyNFT
 * @notice ERC-721 contract for tokenizing real-estate properties on Polygon.
 *         The owner can mint N NFTs to any wallet in a single transaction.
 */
contract PropertyNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    /// @notice Emitted when a batch of NFTs is minted.
    event BatchMinted(address indexed to, uint256 startTokenId, uint256 count);

    constructor(
        string memory baseURI
    ) ERC721("TikOn Property", "TIKPROP") Ownable(msg.sender) {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Mint `n` NFTs to the specified wallet address.
     * @param to       The recipient wallet address.
     * @param n        The number of NFTs to mint (must be >= 1 and <= 50).
     */
    function mintBatch(address to, uint256 n) external onlyOwner {
        require(n >= 1 && n <= 50, "PropertyNFT: n must be 1-50");
        require(to != address(0), "PropertyNFT: mint to zero address");

        uint256 startId = _nextTokenId;

        for (uint256 i = 0; i < n; i++) {
            _safeMint(to, _nextTokenId);
            _nextTokenId++;
        }

        emit BatchMinted(to, startId, n);
    }

    /**
     * @notice Returns the total number of minted tokens.
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @notice Update the base URI for token metadata.
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PropertyNFT", function () {
  let propertyNFT, owner, recipient;

  beforeEach(async function () {
    [owner, recipient] = await ethers.getSigners();
    const PropertyNFT = await ethers.getContractFactory("PropertyNFT");
    propertyNFT = await PropertyNFT.deploy("https://example.com/meta/");
    await propertyNFT.waitForDeployment();
  });

  it("should mint a single NFT", async function () {
    await propertyNFT.mintBatch(recipient.address, 1);
    expect(await propertyNFT.balanceOf(recipient.address)).to.equal(1);
    expect(await propertyNFT.ownerOf(0)).to.equal(recipient.address);
  });

  it("should mint N NFTs in a batch", async function () {
    const n = 5;
    const tx = await propertyNFT.mintBatch(recipient.address, n);
    const receipt = await tx.wait();

    expect(await propertyNFT.balanceOf(recipient.address)).to.equal(n);
    expect(await propertyNFT.totalSupply()).to.equal(n);

    // Verify each token belongs to recipient
    for (let i = 0; i < n; i++) {
      expect(await propertyNFT.ownerOf(i)).to.equal(recipient.address);
    }
  });

  it("should emit BatchMinted event", async function () {
    await expect(propertyNFT.mintBatch(recipient.address, 3))
      .to.emit(propertyNFT, "BatchMinted")
      .withArgs(recipient.address, 0, 3);
  });

  it("should reject n = 0", async function () {
    await expect(
      propertyNFT.mintBatch(recipient.address, 0)
    ).to.be.revertedWith("PropertyNFT: n must be 1-50");
  });

  it("should reject n > 50", async function () {
    await expect(
      propertyNFT.mintBatch(recipient.address, 51)
    ).to.be.revertedWith("PropertyNFT: n must be 1-50");
  });

  it("should reject mint to zero address", async function () {
    await expect(
      propertyNFT.mintBatch(ethers.ZeroAddress, 1)
    ).to.be.revertedWith("PropertyNFT: mint to zero address");
  });

  it("should only allow owner to mint", async function () {
    const nonOwner = propertyNFT.connect(recipient);
    await expect(
      nonOwner.mintBatch(recipient.address, 1)
    ).to.be.revertedWithCustomError(propertyNFT, "OwnableUnauthorizedAccount");
  });

  it("should increment token IDs across batches", async function () {
    await propertyNFT.mintBatch(recipient.address, 3);
    await propertyNFT.mintBatch(owner.address, 2);

    expect(await propertyNFT.totalSupply()).to.equal(5);
    expect(await propertyNFT.ownerOf(3)).to.equal(owner.address);
    expect(await propertyNFT.ownerOf(4)).to.equal(owner.address);
  });
});

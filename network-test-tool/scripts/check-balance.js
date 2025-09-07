const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await deployer.getBalance();
  
  const tokenSymbol = network.chainId === 167012 ? 'KAS' : 'ETH';
  
  console.log(`📡 Network: Chain ${network.chainId}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Current Balance: ${ethers.utils.formatEther(balance)} ${tokenSymbol}`);
  
  // If this is Kasplex, calculate difference from the previous balance shown
  if (network.chainId === 167012) {
    const previousBalance = ethers.utils.parseEther("213.55235657800065346");
    const spent = previousBalance.sub(balance);
    console.log(`💸 Amount Spent Since Test: ${ethers.utils.formatEther(spent)} KAS`);
    console.log(`💵 That's approximately $${(parseFloat(ethers.utils.formatEther(spent)) * 0.20).toFixed(2)} USD (@ $0.20/KAS)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing Kasplex V2 connectivity...");
  
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  
  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  
  try {
    console.log("📝 Deploying simple ERC20 token...");
    const Token = await hre.ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Test Token", "TEST", 18, hre.ethers.utils.parseEther("1000000"));
    
    console.log("⏳ Waiting for deployment...");
    await token.deployed();
    
    console.log(`✅ Token deployed at: ${token.address}`);
    console.log(`🔗 Explorer: https://explorer.testnet.kasplextest.xyz/address/${token.address}`);
    
    // Test a simple transaction
    console.log("💸 Testing token transfer...");
    const tx = await token.transfer(deployer.address, hre.ethers.utils.parseEther("100"));
    await tx.wait();
    
    console.log(`✅ Transfer successful: ${tx.hash}`);
    console.log(`🔗 Explorer: https://explorer.testnet.kasplextest.xyz/tx/${tx.hash}`);
    
    console.log("🎉 Kasplex V2 test completed successfully!");
    
  } catch (error) {
    console.error("❌ Kasplex test failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
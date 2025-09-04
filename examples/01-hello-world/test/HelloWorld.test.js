const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HelloWorld Contract", function () {
  let HelloWorld;
  let helloWorld;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    // Get test accounts
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy HelloWorld contract before each test
    HelloWorld = await ethers.getContractFactory("HelloWorld");
    helloWorld = await HelloWorld.deploy();
    await helloWorld.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      // Check initial message
      expect(await helloWorld.getMessage()).to.equal("Hello Kasplex!");
      
      // Check owner is set correctly
      expect(await helloWorld.owner()).to.equal(owner.address);
      
      // Check initial message count is 0
      expect(await helloWorld.messageCount()).to.equal(0);
    });

    it("Should have the correct initial state", async function () {
      const stats = await helloWorld.getStats();
      
      expect(stats.currentMessage).to.equal("Hello Kasplex!");
      expect(stats.totalChanges).to.equal(0);
      expect(stats.contractOwner).to.equal(owner.address);
    });
  });

  describe("Message Management", function () {
    it("Should allow anyone to change the message", async function () {
      const newMessage = "Hello Ethereum!";
      
      await helloWorld.connect(addr1).setMessage(newMessage);
      
      expect(await helloWorld.getMessage()).to.equal(newMessage);
      expect(await helloWorld.messageCount()).to.equal(1);
    });

    it("Should increment message count on each change", async function () {
      await helloWorld.setMessage("Message 1");
      expect(await helloWorld.messageCount()).to.equal(1);
      
      await helloWorld.setMessage("Message 2");
      expect(await helloWorld.messageCount()).to.equal(2);
      
      await helloWorld.setMessage("Message 3");
      expect(await helloWorld.messageCount()).to.equal(3);
    });

    it("Should emit MessageChanged event", async function () {
      const newMessage = "Test message with event";
      
      await expect(helloWorld.connect(addr1).setMessage(newMessage))
        .to.emit(helloWorld, "MessageChanged")
        .withArgs(newMessage, addr1.address);
    });

    it("Should handle empty string messages", async function () {
      await helloWorld.setMessage("");
      
      expect(await helloWorld.getMessage()).to.equal("");
      expect(await helloWorld.messageCount()).to.equal(1);
    });

    it("Should handle very long messages", async function () {
      const longMessage = "A".repeat(1000);
      
      await helloWorld.setMessage(longMessage);
      
      expect(await helloWorld.getMessage()).to.equal(longMessage);
      expect(await helloWorld.messageCount()).to.equal(1);
    });
  });

  describe("Multiple Users", function () {
    it("Should allow multiple users to change messages", async function () {
      // Owner sets message
      await helloWorld.connect(owner).setMessage("Owner message");
      expect(await helloWorld.messageCount()).to.equal(1);
      
      // Addr1 sets message
      await helloWorld.connect(addr1).setMessage("Addr1 message");
      expect(await helloWorld.messageCount()).to.equal(2);
      expect(await helloWorld.getMessage()).to.equal("Addr1 message");
      
      // Addr2 sets message
      await helloWorld.connect(addr2).setMessage("Addr2 message");
      expect(await helloWorld.messageCount()).to.equal(3);
      expect(await helloWorld.getMessage()).to.equal("Addr2 message");
    });

    it("Should emit correct sender in events", async function () {
      await expect(helloWorld.connect(addr1).setMessage("From addr1"))
        .to.emit(helloWorld, "MessageChanged")
        .withArgs("From addr1", addr1.address);
        
      await expect(helloWorld.connect(addr2).setMessage("From addr2"))
        .to.emit(helloWorld, "MessageChanged")
        .withArgs("From addr2", addr2.address);
    });
  });

  describe("View Functions", function () {
    it("Should return correct stats after multiple changes", async function () {
      await helloWorld.setMessage("First change");
      await helloWorld.setMessage("Second change");
      await helloWorld.setMessage("Final message");
      
      const stats = await helloWorld.getStats();
      
      expect(stats.currentMessage).to.equal("Final message");
      expect(stats.totalChanges).to.equal(3);
      expect(stats.contractOwner).to.equal(owner.address);
    });

    it("Should have consistent state across all getters", async function () {
      const testMessage = "Consistency test";
      await helloWorld.setMessage(testMessage);
      
      // Check all getter functions return consistent data
      expect(await helloWorld.getMessage()).to.equal(testMessage);
      expect(await helloWorld.message()).to.equal(testMessage);
      
      const stats = await helloWorld.getStats();
      expect(stats.currentMessage).to.equal(testMessage);
      expect(stats.totalChanges).to.equal(1);
    });
  });

  describe("Gas Usage", function () {
    it("Should use reasonable gas for deployment", async function () {
      // This test helps track gas usage across networks
      const HelloWorldFactory = await ethers.getContractFactory("HelloWorld");
      const deployTx = await HelloWorldFactory.getDeployTransaction();
      
      // Estimate gas for deployment
      const gasEstimate = await owner.estimateGas(deployTx);
      
      // Gas should be reasonable (less than 500k for this simple contract)
      expect(gasEstimate).to.be.below(500000);
      
      console.log(`      📊 Deployment gas estimate: ${gasEstimate.toString()}`);
    });

    it("Should use reasonable gas for message changes", async function () {
      const newMessage = "Gas test message";
      
      // Estimate gas for setMessage
      const gasEstimate = await helloWorld.setMessage.estimateGas(newMessage);
      
      // Gas should be reasonable (less than 100k for simple state change)
      expect(gasEstimate).to.be.below(100000);
      
      console.log(`      📊 setMessage gas estimate: ${gasEstimate.toString()}`);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle special characters in messages", async function () {
      const specialMessage = "Hello! 🚀 Ñoño café 中文 العربية";
      
      await helloWorld.setMessage(specialMessage);
      expect(await helloWorld.getMessage()).to.equal(specialMessage);
    });

    it("Should maintain owner immutability", async function () {
      // Owner should never change, even after message changes
      const originalOwner = await helloWorld.owner();
      
      await helloWorld.connect(addr1).setMessage("Message from addr1");
      await helloWorld.connect(addr2).setMessage("Message from addr2");
      
      expect(await helloWorld.owner()).to.equal(originalOwner);
      expect(await helloWorld.owner()).to.equal(owner.address);
    });
  });
});

/*
🧪 TEST COVERAGE SUMMARY:

✅ Deployment verification
✅ Initial state validation  
✅ Message setting functionality
✅ Event emission testing
✅ Multi-user interactions
✅ Gas usage monitoring
✅ Edge case handling
✅ State consistency checks

🚀 RUNNING TESTS:

Local testing:
  npm test

Network-specific testing:
  npx hardhat test --network kasplex
  npx hardhat test --network sepolia
  
Gas reporting:
  REPORT_GAS=true npm test

💡 NOTES:
- These exact tests work on Ethereum, Kasplex, and any EVM network
- Gas estimates will vary by network but functionality is identical
- Kasplex tests run much faster due to 10-second finality vs Ethereum's 12+ minutes
*/
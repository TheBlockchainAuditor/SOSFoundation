const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  timeLimit,
  Snapshot,
  swapTokens,
  buyFeeRemainder, sellFeeRemainder,
  getAmountOut,
  tokens, ether, usdt,
  formatSOS, formatUSDT
} = require("./helpers");


describe("SOS Test Suite", () => {

  let owner, trader1, trader2, trader3, trader4, community, jackpot, deadAddress;
  let router, factory;
  let sos, usd, eth, lpPair;

  const snapshot = new Snapshot();

  before("Deployment", async () => {

    let signers = await ethers.getSigners();
    owner = signers[0];
    trader1 = signers[1];
    trader2 = signers[2];
    trader3 = signers[4];
    trader4 = signers[5];
    community = signers[6];
    jackpot = signers[7];

    const traders = [trader1, trader2, trader3, trader4];

    const FACTORY = await ethers.getContractFactory("UniswapV2Factory");
    factory = await FACTORY.deploy(owner.address);
    await factory.deployed();

    const ETH = await ethers.getContractFactory("WETH9");
    eth = await ETH.deploy();
    await eth.deployed();

    await owner.sendTransaction({
      to: eth.address,
      value: ether("500")
    });

    const ROUTER = await ethers.getContractFactory('UniswapV2Router02');
    router = await ROUTER.deploy(factory.address, eth.address);
    await router.deployed();

    const USDT = await ethers.getContractFactory("USDT");
    usd = await USDT.deploy(owner.address, usdt("5000000"));
    await usd.deployed();

    let SOS = await ethers.getContractFactory("SOS");
    sos = await SOS.deploy(router.address, community.address, jackpot.address, usd.address);
    await sos.deployed();

    // add liquidity to SOS/USDT pool
    await usd.approve(router.address, usdt("100000"));
    await sos.approve(router.address, tokens("950000000"));
    await router.connect(owner).addLiquidity(sos.address, usd.address, tokens("950000000"), usdt("100000"), tokens("1000000000"), usdt("100000"), owner.address, timeLimit(3600));

    let usd_sos_pair = await factory.getPair(sos.address, usd.address);
    lpPair = await ethers.getContractAt('UniswapV2Pair', usd_sos_pair);

    // give traders some USDT
    for (let t = 0; t < 4; t++) {
      await usd.transfer(traders[t].address, usdt("10000"));
    }

    await snapshot.snapshot();
  });


  afterEach("Revert", async () => {
    await snapshot.revert();
  });

  describe("Deployment", () => {

    it("should be called SOS", async () => {
      expect(await sos.name()).equal("SOSFOUNDATION.io");
    });

    it("should have 9 decimals", async () => {
      expect(await sos.decimals()).equal(9);
    });

    it("should be symbolized by SOS", async () => {
      expect(await sos.symbol()).equal("SOS");
    });

    it("should have a total supply of 1 billion", async () => {
      expect(await sos.totalSupply()).equal(tokens("1000000000"))
    });

    it("should have two holders at deployment", async () => {
      expect(await sos.holders()).equal(2);
    });

    it("community fees should be 2.5% buy 2.5% sell with passed community address", async () => {
      expect(await sos._communityBuyFeePct()).equal(250);
      expect(await sos._communitySellFeePct()).equal(250);
      expect(await sos._communityAddress()).equal(community.address);
    });

    it("jackpot feeds should be 2.5% buy 2% sell with passed jackpot address", async () => {
      expect(await sos._jackpotBuyFeePct()).equal(250);
      expect(await sos._jackpotSellFeePct()).equal(200);
      expect(await sos._jackpotAddress()).equal(jackpot.address);
    });

  });

  describe("Configuring tokenomics", async () => {

    beforeEach("Configuration", async () => {
      await sos.setCommunity(community.address, 300, 300);
      await sos.setJackpot(jackpot.address, 100, 100);
      await sos.setHolderMinBalance(tokens("2"));
    });

    it("community fees should now be 3% buy 3% sell with same community address", async () => {
      expect(await sos._communityBuyFeePct()).equal(300);
      expect(await sos._communitySellFeePct()).equal(300);
      expect(await sos._communityAddress()).equal(community.address);
    });

    it("jackpot feeds should be 1% buy 1% sell with same jackpot address", async () => {
      expect(await sos._jackpotBuyFeePct()).equal(100);
      expect(await sos._jackpotSellFeePct()).equal(100);
      expect(await sos._jackpotAddress()).equal(jackpot.address);
    });

    it("allows owner to set the minimum balance required to be a holder", async () => {
      expect(await sos._holderMinBalance()).equal(tokens("2"));
    });

    it("owner can set the router to a different address", async () => {
      await sos.setRouter(trader1.address);
      expect(await sos._router()).equal(trader1.address);
    });

    it("owner can change the lp sell percent fee", async () => {
      await sos.setLP(100);
      expect(await sos._lpSellFeePct()).equal(100);
    });

    it("owner can set the buy max amount", async () => {
      await sos.setBuyMaxAmount(tokens("10"));
      expect(await sos._buyMaxAmount()).equal(tokens("10"));
    });

    it("owner can set the sell max amount", async () => {
      await sos.setSellMaxAmount(tokens("10"));
      expect(await sos._sellMaxAmount()).equal(tokens("10"));
    });

  });

  describe("Miscellaneous Functions", () => {

    it("included account SOS holders can use reflect() to burn a specified amount of their holdings", async () => {
      let initialFees = await sos.totalFees();
      await expect(sos.reflect(tokens("10000000"))).revertedWith("Excluded addresses cannot call this function");
      await sos.transfer(trader1.address, tokens("100"));
      await sos.connect(trader1).reflect(tokens("100"));
      expect(await sos.balanceOf(trader1.address)).equal(tokens("0"));
      expect(await sos.totalFees()).equal(initialFees.add(tokens("100")));
    });
    
    it("reflectionFromToken", async () => {
      await sos.transfer(trader1.address, tokens("100"));
      expect(await sos.reflectionFromToken(tokens("0"))).equal("0")
      // console.log("reflectFromToken", formatSOS(await sos.reflectionFromToken(tokens("100"))));
    });

    it("can increase and decrease someone's allowance", async () => {
      await sos.increaseAllowance(trader1.address, tokens("10"));
      await sos.decreaseAllowance(trader1.address, tokens("5"));
      expect(await sos.allowance(owner.address, trader1.address)).equal(tokens("5"));
    });

    it("owner can include previously excluded accounts", async () => {
      await sos.includeAccount(sos.address);
      expect(await sos.isExcluded(sos.address)).equal(false);
    });

  });

  describe("Trading Fees", () => {

    it("understanding the USDT price of the first SOS token", async () => {
      // get SOS amount before fee
      reserves = await lpPair.getReserves();
      sosReserves = reserves._reserve0; // sos
      usdtReserves = reserves._reserve1; // usdt

      // console.log("SOS Reserves:", formatSOS(sosReserves));
      // console.log("USDT Reserves", formatUSDT(usdtReserves));

      let amountOut = await router.getAmountOut(tokens("1"), usdtReserves, sosReserves);
      let oneToken = await router.getAmountIn(amountOut, usdtReserves, sosReserves);
      // console.log("USDT expected to get for one SOS token", formatUSDT(amountOut));
      // console.log(`expecting to get ${formatSOS(oneToken)} SOS if we spend ${formatUSDT(amountOut)} USDT`);
      // console.log("1 SOS Token for reference", formatSOS(tokens("1")));
    });

    it("should not apply fee when token holders trade amongst themselves", async () => {
      await sos.transfer(trader1.address, tokens("1000"));
      expect(await sos.balanceOf(trader1.address)).equal(tokens("1000"));
      await sos.connect(trader1).transfer(trader2.address, tokens("500"));
      expect(await sos.balanceOf(trader1.address)).equal(tokens("500"));
      expect(await sos.balanceOf(trader2.address)).equal(tokens("500"));
    });
    
    it("should apply a 2.5% community 2.0% jackpot 0.5% lp 4% holder & 1% burn fee when selling SOS tokens", async () => {

      // Send trader1  some SOS
      await sos.transfer(trader1.address, tokens("10000"));
      let amount = tokens("10000");

      // Calculate sell fees
      let communityFee = amount.mul(250).div(10000);
      let jackpotFee = amount.mul(200).div(10000);
      let lpFee = amount.mul(50).div(10000);
      let burnFee = amount.mul(100).div(10000);
      let holderRewardFee = amount.mul(400).div(10000);
      let totalFee = communityFee.add(jackpotFee).add(lpFee).add(burnFee).add(holderRewardFee);
      let remainder = amount.sub(totalFee);

      let reserves = await lpPair.getReserves();
      let sosReserves = reserves._reserve0; // sos
      let usdtReserves = reserves._reserve1; // usdt
      let expectedIncrease = await router.getAmountOut(remainder, sosReserves, usdtReserves); 

      // Swap Tokens
      await sos.connect(trader1).approve(router.address, tokens("10000"));
      await expect(router.connect(trader1).swapExactTokensForTokensSupportingFeeOnTransferTokens(tokens("10000"), 0, [sos.address, usd.address], trader1.address, timeLimit(60)))
        .to.emit(sos, 'SellFees')
        .withArgs(communityFee, jackpotFee, lpFee, burnFee.add(holderRewardFee));

    });

    it("should apply a 2.5% community fee and 2.5% jackpot fee when buying SOS tokens", async () => {

      let reserves, sosReserves, usdtReserves;
      let amountOut, communityFee, jackpotFee, lpFee, burnFee, holderRewardFee, totalFee, remainder;

      /* 
        First Holder
      */

      // Give trader1 5000 usdt
      await usd.transfer(trader1.address, usdt("500"));

      // get SOS amount before fee
      reserves = await lpPair.getReserves();
      sosReserves = reserves._reserve0; // sos
      usdtReserves = reserves._reserve1; // usdt

      amountOut = await router.getAmountOut(usdt("500"), usdtReserves, sosReserves);

      // calculate buy fees
      communityFee = amountOut.mul(250).div(10000);
      jackpotFee = amountOut.mul(250).div(10000);
      totalFee = communityFee.add(jackpotFee);
      remainder = amountOut.sub(totalFee);

      // console.log(formatSOS(remainder));

      // Swap Tokens
      await usd.connect(trader1).approve(router.address, usdt("500"));
      await expect(router.connect(trader1).swapExactTokensForTokensSupportingFeeOnTransferTokens(usdt("500"), 0, [usd.address, sos.address], trader1.address, timeLimit(60)))
        .to.emit(sos, 'BuyFees')
        .withArgs(communityFee, jackpotFee);

      expect(await sos.balanceOf(trader1.address)).equal(remainder);

    });

  });

  describe("Simple Trading Simulation", () => {

    it("testing buyTokens function", async () => {
      // Give trader1 5000 usdt
      let amountSold = usdt("500");
      await usd.transfer(trader1.address, amountSold);
      let amountOut = await getAmountOut(lpPair, router, amountSold);
      let remainder = buyFeeRemainder(amountOut);
      await swapTokens(amountSold, usd, sos, router, trader1);
      expect(await sos.balanceOf(trader1.address)).equal(remainder);
    });

    it("testing sellTokens function", async () => {
      let sellAmount = tokens("100");
      await sos.transfer(trader1.address, sellAmount);
      let remainder = sellFeeRemainder(sellAmount);
      await swapTokens(sellAmount, sos, usd, router, trader1);
      expect(await sos.balanceOf(trader1.address)).equal(tokens("0"));
    });

    it("Three Buys followed by One Sell", async () => {

      let reserves, sosReserves, usdtReserves;
      let amountOut, communityFee, jackpotFee, lpFee, burnFee, holderRewardFee, totalFee, remainder;

      /* 
        First Holder
      */

      // buy function right here

      // Give trader1 5000 usdt
      await usd.transfer(trader1.address, usdt("50"));

      // get SOS amount before fee
      reserves = await lpPair.getReserves();
      sosReserves = reserves._reserve0; // sos
      usdtReserves = reserves._reserve1; // usdt
      amountOut = await router.getAmountOut(usdt("50"), usdtReserves, sosReserves);

      // calculate buy fees
      communityFee = amountOut.mul(250).div(10000);
      jackpotFee = amountOut.mul(250).div(10000);
      totalFee = communityFee.add(jackpotFee);
      remainder = amountOut.sub(totalFee);

      // Swap Tokens
      await usd.connect(trader1).approve(router.address, usdt("50"));
      await expect(router.connect(trader1).swapExactTokensForTokensSupportingFeeOnTransferTokens(usdt("50"), 0, [usd.address, sos.address], trader1.address, timeLimit(60)))
        .to.emit(sos, 'BuyFees')
        .withArgs(communityFee, jackpotFee);

      expect(await sos.balanceOf(trader1.address)).equal(remainder);

      /* 
        Second Holder
      */

      // Give trader1 5000 usdt
      await usd.transfer(trader2.address, usdt("50"));

      // get SOS amount before fee
      reserves = await lpPair.getReserves();
      sosReserves = reserves._reserve0; // sos
      usdtReserves = reserves._reserve1; // usdt

      amountOut = await router.getAmountOut(usdt("50"), usdtReserves, sosReserves);

      // calculate buy fees
      communityFee = amountOut.mul(250).div(10000);
      jackpotFee = amountOut.mul(250).div(10000);
      totalFee = communityFee.add(jackpotFee);
      remainder = amountOut.sub(totalFee);

      // Swap Tokens
      await usd.connect(trader2).approve(router.address, ether("50"));
      await expect(router.connect(trader2).swapExactTokensForTokensSupportingFeeOnTransferTokens(ether("50"), 0, [usd.address, sos.address], trader2.address, timeLimit(60)))
        .to.emit(sos, 'BuyFees')
        .withArgs(communityFee, jackpotFee);

      expect(await sos.balanceOf(trader2.address)).equal(remainder);

      /* 
        Third Holder 
      */

      // Give trader1 5000 usdt
      await usd.transfer(trader3.address, ether("50"));

      // get SOS amount before fee
      reserves = await lpPair.getReserves();
      sosReserves = reserves._reserve0; // sos
      usdtReserves = reserves._reserve1; // usdt

      amountOut = await router.getAmountOut(ether("50"), usdtReserves, sosReserves);

      // calculate buy fees
      communityFee = amountOut.mul(250).div(10000);
      jackpotFee = amountOut.mul(250).div(10000);
      totalFee = communityFee.add(jackpotFee);
      remainder = amountOut.sub(totalFee);

      // Swap Tokens
      await usd.connect(trader3).approve(router.address, ether("50"));
      await expect(router.connect(trader3).swapExactTokensForTokensSupportingFeeOnTransferTokens(ether("50"), 0, [usd.address, sos.address], trader3.address, timeLimit(60)))
        .to.emit(sos, 'BuyFees')
        .withArgs(communityFee, jackpotFee);

      expect(await sos.balanceOf(trader3.address)).equal(remainder);
      let sellAmount = await sos.balanceOf(trader1.address);

      /*
        First Holder takes profit by selling all his tokens owned
      */

      // Calculate sell fees
      communityFee = sellAmount.mul(250).div(10000);
      jackpotFee = sellAmount.mul(200).div(10000);
      lpFee = sellAmount.mul(50).div(10000);
      burnFee = sellAmount.mul(100).div(10000);
      holderRewardFee = sellAmount.mul(400).div(10000);
      totalFee = communityFee.add(jackpotFee).add(lpFee).add(burnFee).add(holderRewardFee);
      remainder = sellAmount.sub(totalFee);

      // Swap Tokens
      await sos.connect(trader1).approve(router.address, sellAmount);
      await expect(router.connect(trader1).swapExactTokensForTokensSupportingFeeOnTransferTokens(sellAmount, 0, [sos.address, usd.address], trader1.address, timeLimit(60)))
        .to.emit(sos, 'SellFees')
        .withArgs(communityFee, jackpotFee, lpFee, burnFee.add(holderRewardFee));

      
      // checking balances
      const data = await sos.balanceOfHolders(0, 1000);
      for (let i = 0; i < data[0].length; i++) {
        expect(await sos.balanceOf(data[0][i])).equal(data[1][i]);
      }

    });

  });

});

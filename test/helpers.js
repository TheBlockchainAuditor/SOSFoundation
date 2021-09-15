const { ethers } = require("ethers");

const ZeroAddress = ethers.constants.AddressZero;
const maxInt = ethers.constants.MaxUint256;

function ether(n) {
    return ethers.utils.parseEther(n);
}

function tokens(n) {
    return ethers.utils.parseUnits(n, 9);
}

function usdt(n) {
    return ethers.utils.parseUnits(n, 18);
}

async function increaseTime(n) {

    await hre.network.provider.request({
        method: "evm_increaseTime",
        params: [n]
    });

    await hre.network.provider.request({
        method: "evm_mine",
        params: []
    });

}

function timeLimit(n) {
    return Math.floor((Date.now() / 1000) + n);
}

class Snapshot {
    constructor() {
        this.snapshotId = 0;
    }

    async revert() {
        await network.provider.send('evm_revert', [this.snapshotId]);
        return this.snapshot();
    }

    async snapshot() {
        this.snapshotId = await network.provider.send('evm_snapshot', []);
    }
}

function buyFeeRemainder(amountOut) {
    // calculate buy fees
    let communityFee = amountOut.mul(250).div(10000);
    let jackpotFee = amountOut.mul(250).div(10000);
    let totalFee = communityFee.add(jackpotFee);
    return amountOut.sub(totalFee);
}

async function swapTokens(amountSold, tokenSold, tokenBought, router, trader) {
    await tokenSold.connect(trader).approve(router.address, amountSold);
    await router.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(amountSold, 0, [tokenSold.address, tokenBought.address], trader.address, timeLimit(60));
}

function sellFeeRemainder(sellAmount) {
    communityFee = sellAmount.mul(250).div(10000);
    jackpotFee = sellAmount.mul(200).div(10000);
    lpFee = sellAmount.mul(50).div(10000);
    burnFee = sellAmount.mul(100).div(10000);
    holderRewardFee = sellAmount.mul(400).div(10000);
    totalFee = communityFee.add(jackpotFee).add(lpFee).add(burnFee).add(holderRewardFee);
    return sellAmount.sub(totalFee);
}

async function getAmountOut(lpPair, router, amountIn) {
    let reserves = await lpPair.getReserves();
    let sosReserves = reserves._reserve0; // sos
    let usdtReserves = reserves._reserve1; // usdt
    let amountOut = await router.getAmountOut(amountIn, usdtReserves, sosReserves);
    return amountOut;
}

let clamp = function(value, min, max) {
    return Math.floor(Math.min(Math.max(value, min), max));
}

let formatSOS = (n) => {
    return ethers.utils.formatUnits(n.toString(), 9);
}

let formatUSDT = (n) => {
    return ethers.utils.formatUnits(n.toString(), 18);
}

module.exports = {
    clamp, 
    maxInt, ZeroAddress,
    sellFeeRemainder, buyFeeRemainder, getAmountOut,
    swapTokens, tokens,
    ether, usdt,
    increaseTime, timeLimit,
    Snapshot,
    formatSOS, formatUSDT
};
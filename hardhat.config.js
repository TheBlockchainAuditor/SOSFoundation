require("@nomiclabs/hardhat-waffle");
require('hardhat-dependency-compiler');
require("solidity-coverage");
require("hardhat-gas-reporter");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    hardhat: {
      hardfork: "berlin",
      accounts: {
        count: 250,
      }
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true
          }
        }
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          } 
        }
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          } 
        }
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          } 
        }
      },
      {
        version: "0.4.18",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          } 
        }
      }
    ]
  },
  dependencyCompiler: {
    paths: [
      '@uniswap/v2-core/contracts/UniswapV2Factory.sol',
      '@uniswap/v2-core/contracts/UniswapV2Pair.sol',
      '@uniswap/v2-core/contracts/UniswapV2ERC20.sol',
      '@uniswap/v2-periphery/contracts/UniswapV2Router02.sol',
    ],
    keep: false
  },
  mocha: {
    timeout: 0,
  },
  gasReporter: {
    currency: 'US',
    gasPrice: 50,
    enabled: true,
  }
};

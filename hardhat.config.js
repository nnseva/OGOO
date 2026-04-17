//import { task } from "hardhat/config"
require('dotenv').config();
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("@atixlabs/hardhat-time-n-mine");
const ethers = require("ethers");

task = require("hardhat/config").task;

// const { API_URL, PRIVATE_KEY } = process.env;

task("accounts", "Prints the list of predefined accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners()
  accounts.forEach((account) => {
    console.log(account.address)
  })
})

task("balances", "Prints the list of predefined account balances", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  for(const account of accounts){
    const balance = await hre.ethers.provider.getBalance(
        account.address
    );
    console.log(`${account.address} has balance ${balance.toString()}`);
  }
})

task("balance", `Prints a single account balance ${ethers.EtherSymbol}`)
.addPositionalParam("account", "Account address", undefined, types.string)
.setAction(async (args, hre) => {
    const balance = await hre.ethers.provider.getBalance(
        args.account
    );
    console.log(`${args.account} has balance ${ Number(balance / (ethers.WeiPerEther / 1000000n)) / 1000000. }`);
})

task("create-sample-accounts", "Create/Update a list of test determenistic accounts")
.addPositionalParam("count", "Count of accounts created/updated", undefined, types.int)
.addOptionalPositionalParam("amount", `Amount to send to every new account created (${ethers.EtherSymbol})`, 0, types.float)
.addOptionalParam("start", "Start the deterministic account from index, (start + count) <= 256", 0, types.int)
.addOptionalParam("signer", "Predefined signer who will send funds to the created account", 0, types.int)
.setAction(async (args, hre) => {
    if( args.count <= 0 ) {
        console.error('Count should be positive');
        return;
    }
    if( args.start + args.count > 256 ) {
        console.error('No more than 256 accounts');
        return;
    }
    const accounts = await hre.ethers.getSigners();
    if( args.signer >= accounts.length ) {
        console.error('Signer index too high');
    }
    // known mnemonic
    var begin_mnemonic = ethers.Mnemonic.fromPhrase('test test test test test test test test test test test absent');
    var bytes = Array.from(Buffer.from(begin_mnemonic.entropy.slice(2), 'hex'))
    for(var i=0; i < args.count; i++) {
        bytes[bytes.length - 1] = i + args.start;
        var buffer = Buffer.from(bytes);
        var wallet = ethers.Wallet.fromPhrase(ethers.Mnemonic.fromEntropy(buffer).phrase, hre.ethers.provider);
        console.log('Account:');
        console.log('      Address:', wallet.address);
        console.log('     Mnemonic:', wallet.mnemonic.phrase);
        console.log('  Private key:', wallet.privateKey);
        if( args.amount > 0 ) {
            await (await accounts[args.signer].sendTransaction({to:wallet.address, value: BigInt(Math.round(args.amount * Number(ethers.WeiPerEther)))})).wait();
        }
        console.log(`     Fund (${ethers.EtherSymbol}):`, Number((await hre.ethers.provider.getBalance(wallet.address)) / (ethers.WeiPerEther / 1000000n)) / 1000000.);
    }
});

console.log("Use LOCAL_PORT for local network, or HARDHATNODE_PORT for hardhat node if necessary");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      modelChecker: {
        targets: [
            "assert",
            "underflow",
            "overflow",
            "divByZero",
            "constantCondition",
            "popEmptyArray",
            "outOfBounds",
            "balance"
        ]
      },
      outputSelection: {
        "*": {
            "*": [
              "metadata",
              "evm.bytecode",
              "evm.bytecode.sourceMap"
            ]
        }
      }
    },
  },
  defaultNetwork: "hardhat",
//  networks: {
//      hardhat: {},
//      sepolia: {
//         url: API_URL,
//         accounts: [`0x${PRIVATE_KEY}`]
//      }
//   }
  networks: {
    local: {
      url: 'http://127.0.0.1:' + (process.env.LOCAL_PORT || 32003), // Kurtosis port from the config or output
      // These are private keys associated with prefunded test accounts created by the eth-network-package
      //https://github.com/kurtosis-tech/ethereum-package/blob/main/src/prelaunch_data_generator/genesis_constants/genesis_constants.star
      accounts: [
        "bcdf20249abf0ed6d944c0288fad489e33f66b3960d9e6229c1cd214ed3bbe31",
        "53321db7c1e331d93a11a41d16f004d7ff63972ec8ec7c25db329728ceeb1710",
        "ab63b23eb7941c1251757e24b3d2350d2bc05c3c388d06f8fe6feafefb1e8c70",
        "5d2344259f42259f82d2c140aa66102ba89b57b4883ee441a8b312622bd42491",
        "27515f805127bebad2fb9b183508bdacb8c763da16f54e0678b16e8f28ef3fff",
        "7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856",


        "39725efee3fb28614de3bacaffe4cc4bd8c436257e2c8bb887c4b5c4be45e76d",
        "3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899",
        "bb1d0f125b4fb2bb173c318cdead45468474ca71474e2247776b2b4c0fa2d3f5",
        "850643a0224065ecce3882673c21f56bcf6eef86274cc21cadff15930b59fc8c",
        "94eb3102993b41ec55c241060f47daa0f6372e2e3ad7e91612ae36c364042e44",
        "daf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7",
        "eaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23",
        "3fd98b5187bf6526734efaa644ffbb4e3670d66f5d0268ce0323ec09124bff61",
        "5288e2f440c7f0cb61a9be8afdeb4295f786383f96f5e35eb0c94ef103996b64",
        "f296c7802555da2a5a662be70e078cbd38b44f96f8615ae529da41122ce8db05",
        "bf3beef3bd999ba9f2451e06936f0423cd62b815c9233dd3bc90f7e02a1e8673",
        "6ecadc396415970e91293726c3f5775225440ea0844ae5616135fd10d66b5954",
        "a492823c3e193d6c595f37a18e3c06650cf4c74558cc818b16130b293716106f",
        "c5114526e042343c6d1899cad05e1c00ba588314de9b96929914ee0df18d46b2",
        "04b9f63ecf84210c5366c66d68fa1f5da1fa4f634fad6dfc86178e4d79ff9e59",
      ],
    },
    hardhatnode: {
      url: 'http://127.0.0.1:' + (process.env.HARDHATNODE_PORT || 8545),
    },
    // mainnet config...
    // testnet config...
  },
  mocha: {
    timeout: 6000000
  }
};

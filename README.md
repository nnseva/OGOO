# Open Group Open Offer (OGOO)

## 🗐 Documentation Pages

- [README](README.md) ⏴ *this page*
- [OGOO Contract](OGOOContract.md)
- [Offer Definition](OfferDefinition.md)
- [Offer Contract API](OfferContractAPI.md)
- [How To Test](HOWTOTEST.md)
- [User Guide](html/USER-GUIDE.en.md) [ru](html/USER-GUIDE.ru.md)

## ⚠️ Disclaimer

**This software is in an early beta stage. Use it at your own risk.**

## 📖 Introduction

Open Group Open Offer (**OGOO**) is a fully blockchain-based, decentralized, and free-to-use platform for creating impact funds governed by the community.

- **Anyone** can create an Offer and invite the community to contribute to the impact fund.
- **Anyone** can contribute to the impact fund, thereby gaining the ability to collectively govern it through voting mechanisms.
- **Anyone** can solve the problem described in the Offer and receive the collected funds after community voting.
- **The creator does not retain exclusive rights**—once an Offer is approved, control shifts entirely to the community.

Each Offer includes a **description** that defines its purpose—specifically, the problem that needs to be solved. The description becomes **immutable** after the Offer is approved. Once created, the impact fund associated with the Offer collects contributions from the community to incentivize problem-solving. If a contender successfully solves the described problem, the community votes to determine the winner. Once sufficient votes are gathered, the funds are transferred to the winner's account, and the Offer is marked as **completed**.

## 🏗️ Software Structure

The project consists of two main components:

### 1️⃣ OGOO Contract
A [Solidity smart contract](OGOOContract.md) that implements all impact fund mechanics, including:
- Offer creation and configuration
- Contribution collection and accounting
- Anti-fraud protection
- Community-driven voting
- Reward transfer

The contract operates **entirely on-chain** and does not require a GUI—its full functionality is accessible through direct smart contract calls.

### 2️⃣ OGOO Web GUI
A **web-based interface** that provides a user-friendly way to interact with the contract. It enables users to:
- Deploy and manage Offers
- Contribute to and participate in the governance of impact funds
- Vote on winners using an intuitive interface

## 🚀 Deployment Guide

### Prerequisites
To use the **OGOO Web GUI**, you must have an **Ethereum wallet** extension installed in your browser.  
**Tested wallet**: MetaMask.

### Pre-build Steps
Before running the application, execute the following commands:

```sh
npm install --no-root
npx solt pp templates/ogoo.solt -o contracts/ogoo.sol
npx hardhat compile
```

### Running the Web GUI
The **OGOO Web GUI** operates in **static mode**. After completing the pre-build steps, open `'html/index.html'` in any browser using a static HTTP server.

You can use the **OGOO Web GUI** instance deployed at [ogoo.io](https://ogoo.io).

> **Note:** The list of deployed contracts is stored locally in your browser. All contract data resides on the blockchain. Make sure to save the addresses of your contracts to avoid losing access to them.

### Smart Contract Deployment
The [OGOO Contract](OGOOContract.md) can be deployed on any **Ethereum-compatible network**.

⚠️ **Warning:** Avoid deploying to a live Ethereum network unless you fully understand the implications.

The **OGOO Web GUI** includes an option to deploy a contract instance. However, experienced users may choose to deploy manually and interact directly with the contract instance **without using the GUI**. For further details, refer to the contract source code.

## 📦 Dependencies

All [OGOO Contract](OGOOContract.md) development dependencies are listed in the [package.json](package.json) file. Key dependencies include:

- [Hardhat](https://github.com/NomicFoundation/hardhat) – An Ethereum development framework.
- [SOLT](https://github.com/nnseva/solt) – A Solidity preprocessing and templating tool.

The **OGOO Web GUI** uses the following CDN-based libraries:

- [Bootstrap 5](https://getbootstrap.com/)
- [jQuery](https://jquery.com/)
- [ethers.js](https://docs.ethers.io/v5/)
- [Remarkable](https://github.com/jonschlinkert/remarkable)
- [Bootstrap Icons](https://icons.getbootstrap.com/)
- [Font Awesome](https://fontawesome.com/)
- [Luxon](https://moment.github.io/luxon/)
- [jQuery QR Code](https://github.com/jeromeetienne/jquery-qrcode)
- [QR Code Scanner](https://github.com/nimiq/qr-scanner)

## 🛠️ Contributions

### 🐞 Beta Testing

Use the [brief testing manual](HOWTOTEST.md) to set up your testing environment and experiment with the OGOO application. Submit issues to the repository.

### 💡 Ideas

Contributions to improve the project are welcome. Feel free to open an issue and describe your ideas to extend the functionality of the [OGOO Contract](OGOOContract.md) or the **OGOO Web GUI**.

### 🔨 Pull Requests

You are encouraged to propose improvements or submit fixes via pull requests.

### 🧩 Related Projects

If your project uses the [OGOO Contract](OGOOContract.md) or provides additional services for it, please create an issue or a pull request to reference your project.

### 📜 Public Relations

Share your success stories or current deployments using this project by opening an issue or submitting a pull request.

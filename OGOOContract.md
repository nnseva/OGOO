# OGOO Contract

## 🗐 Documentation Pages

- [README](README.md)
- [OGOO Contract](OGOOContract.md) ⏴ *this page*
- [Offer Definition](OfferDefinition.md)
- [Offer Contract API](OfferContractAPI.md)
- [How To Test](HOWTOTEST.md)
- [User Guide](html/USER-GUIDE.en.md) [ru](html/USER-GUIDE.ru.md)

## 📖 Introduction

The OGOO Contract is a **Solidity smart contract** that implements all impact fund mechanics, including:
- Offer creation and configuration
- Contribution collection and accounting
- Anti-fraud protection
- Community-driven voting
- Reward distribution

The contract operates **entirely on-chain** and does not require a GUI—its full functionality is accessible through direct smart contract calls.

Anyone who can make requests to the Ethereum network may deploy and use the OGOO Contract using [Offer Contract API](OfferContractAPI.md).

## 💸 The Offer

An **Offer** is an instance of the OGOO Contract, serving as an **impact fund** that collects contributions from the community. The Offer includes an [offer definition](OfferDefinition.md), a structure containing all contract parameters, including a full human-readable description of the problem that needs to be solved.

The existence of an Offer and the funds collected within it incentivize the resolution of the described problem. Anyone capable of solving the problem can become a **contender** and claim the funds collected in the impact fund.

Any user can contribute to the impact fund by transferring funds directly to the Offer's contract account. Once a contribution is made, the user becomes a **contributor** and gains the ability to vote for a contender who successfully solves the problem.

During the contract setup phase, the **creator** of the Offer designates a list of **observers** interested in the problem’s resolution. Observers play a key role in **anti-fraud protection**, as they vote for contenders **independently** from contributors. The contract is completed and funds are transferred only if the **votes of contributors and observers align**.

## 🔄 Offer Lifecycle

### 1️⃣ Setup Phase
The Offer is created by a user who becomes the **contract owner**.  
The owner configures all necessary parameters, including the list of observers.

### 2️⃣ Fund Collection
Once the owner **approves** the Offer, its parameters—including the observer list—become **immutable**.  
Contributors can then transfer funds into the impact fund.  
The collected funds and number of contributors must exceed predefined thresholds specified in the contract.

### 3️⃣ Problem Solving
Anyone capable of solving the described problem may attempt to do so and publicly declare their **account** outside the contract scope, thereby becoming a **contender**.

### 4️⃣ Voting
Contributors and observers independently discover the contender's account outside the contract scope and vote.  
Voting results from **contributors and observers must match** for the contract to be completed.  

Each time a vote is cast, the system re-evaluates whether **winning conditions** have been met.  
Once these conditions are satisfied, the full **fund balance** is transferred to the **winning contender's** account.

## 💰 Contributors

### 📮 Making Contributions
Any contribution equal to or greater than the **minimum threshold** specified in the Offer parameters is accepted.  
The contributor transfers funds directly to the Offer's account.

### ✋ Voting
All contributions from a single account are aggregated.  
A contributor may vote for a contender at any time after the **fund collection threshold** is met.

Votes are calculated using **two methods**:

- **By contributor count** – the number of contributors who voted for a specific contender, relative to the total number of contributors.
- **By contribution amount** – the total contributions made by contributors who voted for a specific contender, relative to the total funds in the impact fund.

For the contract to be completed, the **votes from observers must align** with one or both of these methods.

### ⏎ Refund Mechanism
Contributors may request a refund, but not instantly. The refund process requires **two steps**:

1. **Initial request** – Marks the contributor for refund processing and starts the **unlock timeout**. Voting rights are suspended until the contributor reclaims the contribution.
2. **Final request** – After the timeout expires, the contributor may reclaim all of their contributions in a single transaction.

## 👁 Observers

The observer list is configured during the **setup phase** and becomes **immutable** after the Offer is approved.

Observers vote for contenders **independently** of contributors.  
For the contract to be completed, **the votes of observers must align** with one or both of the contributor voting calculation methods.

# Offer Contract API Reference

## 🗐 Documentation Pages

- [README](README.md)
- [OGOO Contract](OGOOContract.md)
- [Offer Definition](OfferDefinition.md)
- [Offer Contract API](OfferContractAPI.md) ⏴ *this page*
- [How To Test](HOWTOTEST.md)
- [User Guide](html/USER-GUIDE.en.md) [ru](html/USER-GUIDE.ru.md)

## 📖 Introduction

This document provides a comprehensive reference for all public API endpoints of the Offer smart contract.

## 🏗️ Offer Definition Structure

```solidity
struct OfferDefinition {
    string caption;
    string description;
    string full_details;
    uint contribution_unlock_timeout;
    uint contribution_min_balance;
    uint voting_start_balance;
    uint voting_start_count;
    uint voting_start_timeout;
    uint voting_fail_timeout;
    uint16 observers_vote_percent;
    uint16 contributors_vote_percent;
    uint16 contributors_vote_fund_percent;
}
```

The [`OfferDefinition`](OfferDefinition.md) structure defines all configurable parameters for an Offer instance. These parameters are used during initialization and remain mutable until the Offer is approved.

## 🔄 Offer State Enum

```solidity
enum OfferState {
    INITIAL,
    APPROVED,
    COMPLETED,
    FAILED
}
```

This enum represents the lifecycle status of an Offer:
- `INITIAL` – Assigned immediately after deployment.
- `APPROVED` – Assigned when the Offer owner confirms the offer; from that moment, all parameters and the observer list become immutable.
- `COMPLETED` – Assigned when a contender is successfully selected and all funds have been transferred.
- `FAILED` – Assigned if any failure condition is triggered.

## 📢 Events

```solidity
event OfferCreated();
event OfferDefinitionUpdated(OfferDefinition offer_definition);
event ObserverCreated(address payable indexed observer);
event ObserverRemoved(address payable indexed observer);
event OfferApproved();
event ContributionCreated(address payable indexed contributor);
event ContributionUpdated(address payable indexed contributor, uint amount);
event ContributionCancelation(address payable indexed contributor);
event ContributionCanceled(address payable indexed contributor);
event OfferCompleted(address payable winner, uint amount);
event ContributorVote(address payable indexed contributor, address payable contender, bool failure);
event ObserverVote(address payable indexed observer, address payable contender, bool failure);
event OfferFailed();
```

- `OfferCreated()` – Emitted when a new Offer is created.
- `OfferDefinitionUpdated(OfferDefinition offer_definition)` – Emitted when the Offer definition is updated.
- `ObserverCreated(address payable indexed observer)` – Emitted when an observer is added.
- `ObserverRemoved(address payable indexed observer)` – Emitted when an observer is removed.
- `OfferApproved()` – Emitted when the Offer is approved by the owner.
- `ContributionCreated(address payable indexed contributor)` – Emitted when a new contributor joins.
- `ContributionUpdated(address payable indexed contributor, uint amount)` – Emitted when an existing contributor increases their contribution; reflects the total contributed amount.
- `ContributionCancelation(address payable indexed contributor)` – Emitted when a contributor initiates a refund request.
- `ContributionCanceled(address payable indexed contributor)` – Emitted when a contributor receives a refund after the unlock timeout expires.
- `OfferCompleted(address payable winner, uint amount)` – Emitted when the Offer is successfully completed and funds are transferred to the contender.
- `ContributorVote(address payable indexed contributor, address payable contender, bool failure)` – Emitted when a contributor casts a vote.
- `ObserverVote(address payable indexed observer, address payable contender, bool failure)` – Emitted when an observer casts a vote.
- `OfferFailed()` – Emitted when the Offer fails.

## 🛡️ Modifiers

Modifiers restrict access to contract methods based on roles and the current Offer state.

```solidity
modifier sender_origin() {...}
modifier owner_only() {...}
modifier contributor_only() {...}
modifier observer_only() {...}
modifier started_only() {...}
modifier not_completed_only() {...}
modifier prepared_only() {...}
modifier running_only() {...}
modifier voting_started() {...}
```

- `sender_origin` – Ensures that the message `sender` matches the transaction `origin`; restricts calls to EOAs (Externally Owned Accounts).
- `owner_only` – Limits method calls strictly to the Offer owner.
- `contributor_only` – Restricts method calls to registered contributors.
- `observer_only` – Restricts method calls to registered observers.
- `started_only` – Requires the Offer to be active (not completed or failed).
- `not_completed_only` – Ensures that the Offer is not in a completed state.
- `prepared_only` – Requires the Offer to be in the `INITIAL` state.
- `running_only` – Requires the Offer to be in the `APPROVED` state.
- `voting_started` – Confirms that voting thresholds have been met.

## 🏗️ Contract Constructor

```solidity
constructor(OfferDefinition memory offer_definition) sender_origin()
```

The constructor initializes a new Offer with the provided [`OfferDefinition`](OfferDefinition.md). Only an EOA can deploy an Offer and becomes its owner. The owner has exclusive rights to update parameters and manage observers until approval. Once the owner calls `approve()`, the Offer transitions to the `APPROVED` state, and all parameters along with the observer list become immutable.

## ✏️ Definition Update Method

```solidity
function definition_update(OfferDefinition memory offer_definition) external prepared_only() owner_only()
```

This method allows the owner to update the Offer parameters while the Offer is in the `INITIAL` state.

## 👁️ Observer Create Method

```solidity
function observer_create(address payable observer_account) external prepared_only() owner_only()
```

This method allows the owner to add an observer while the Offer is in the `INITIAL` state.

## ❌ Observer Remove Method

```solidity
function observer_remove(address payable observer_account) external prepared_only() owner_only()
```

This method allows the owner to remove an observer while the Offer is in the `INITIAL` state.

## ✅ Approve Method

```solidity
function approve() external prepared_only() owner_only()
```

Calling `approve()` transitions the Offer to the `APPROVED` state. After approval, all parameters and the observer list are locked.

## 💸 Receiving Contributions

```solidity
receive() external payable sender_origin()
```

Any EOA can contribute funds. The first contribution from a new contributor must meet the [minimum contribution](OfferDefinition.md#-contribution-minimal-balance) requirement; subsequent contributions may be any amount.

## 🔙 Cancel Contribution Method

```solidity
function contribution_cancel() external not_completed_only() contributor_only() sender_origin()
```

Contributors can request a refund via a two-step process:
1. **Initial request** – Marks the contributor for refund processing and starts the [unlock timeout](OfferDefinition.md#-contribution-unlock-timeout). Voting rights are suspended until the contributor reclaims the contribution.
2. **Final request** – After the timeout expires, the contributor may reclaim all of their contributions in a single transaction.

## 🗳️ Contributor Voting Methods

```solidity
function contributor_vote(address payable voice) external started_only() contributor_only() sender_origin()
```
```solidity
function contributor_vote_failure() external started_only() contributor_only() sender_origin()
```

Contributors can vote for a contender or indicate Offer failure. Votes may be changed until the Offer is finalized.

## 🗳️ Observer Voting Methods

```solidity
function observer_vote(address payable voice) external started_only() observer_only()
```
```solidity
function observer_vote_failure() external started_only() observer_only()
```

Observers can vote for a contender or indicate Offer failure, with the option to change their vote until the Offer is finalized.

## 📊 Public Variables

Public variables are accessible as view functions that provide real-time Offer state information.

### 👤 Owner

```solidity
address payable public owner
```

The immutable address of the Offer owner, established during contract creation.

### 🔄 State

```solidity
OfferState public state = OfferState.INITIAL
```

The current state of the Offer, initially set to `INITIAL` and transitioning through `APPROVED`, `COMPLETED`, or `FAILED`.

### 🏆 Winner

```solidity
address payable public winner
```

The address of the contender who wins the Offer. This variable is set when the Offer is successfully completed.

### ⏰ Approve Timestamp

```solidity
uint public approved_at
```

The block timestamp when the Offer is approved.

### 🏁 Complete Timestamp

```solidity
uint public completed_at
```

The block timestamp when the Offer is successfully completed and funds are transferred.

### ❗ Failure Timestamp

```solidity
uint public failed_at
```

The block timestamp when the Offer fails.

## ℹ️ Informational Functions

These view functions provide detailed insights into the Offer state and contributor information.

## 🗳️ Current Voting Status Return Value

Some functions return the **current voting status** as an unsigned 256-bit integer.

A special constant indicates a vote for Offer failure:

```javascript
const CONTRACT_FAILED = 1n << 255n;
```

- A return value of `0n` means that no vote has been cast.
- A return value equal to `CONTRACT_FAILED` means a vote for Offer failure.
- Any other value represents the address of a contender, encoded in the lower 160 bits of the integer.

To interpret the result using `ethers.js`:

```javascript
var failure = voting == CONTRACT_FAILED;
var contender = ethers.toBeHex(failure ? 0n : voting, 20);
```
This extracts the contender’s address as a hexadecimal string, or returns `0x00...00` if the vote was for failure.

### 👁 Origin Observer Status

Returns whether the transaction origin is a registered observer and, if so, provides the current voting status of that observer.

```solidity
function origin_observer_status() external view sender_origin() returns(bool is_observer, uint observer_voting)
```

- `is_observer` – `true` if the origin is a registered observer; otherwise, `false`.
- `observer_voting` – the vote cast by the observer, represented as a 256-bit integer (see [🗳️ Current Voting Status Return Value](#%EF%B8%8F-current-voting-status-return-value)).

### 👥 Origin Contributor Status

Returns whether the transaction origin is a registered contributor and, if so, provides details about their current voting and contribution state.

```solidity
function origin_contributor_status() external view sender_origin() returns(
    bool is_contributor,
    uint contributor_voting,
    uint contribution_amount,
    uint canceled_at,
    uint contribution_cancelation_timeout
)
```

- `is_contributor` – `true` if the origin is a registered contributor; otherwise, `false`.
- `contributor_voting` – the vote cast by the contributor, represented as a 256-bit integer (see [🗳️ Current Voting Status Return Value](#%EF%B8%8F-current-voting-status-return-value)).
- `contribution_amount` – the total amount of funds contributed by this address, in `wei`.
- `canceled_at` – the block timestamp of the cancellation request, or `0` if no request has been made.
- `contribution_cancelation_timeout` – time in seconds remaining until the contributor can reclaim their funds. Returns `0` if no cancellation request exists or if the timeout has already expired.

### 👁 Observers List

Returns the complete list of registered observer addresses.

```solidity
function observers() external view returns(address[] memory)
```

The observer list is initialized during the setup phase and becomes immutable after the Offer is approved.

### 📊 Voting Statistics

Provides the current voting status and detailed breakdown of voting power distributions among observers and contributors.

```solidity
function voting_statistics() external view returns(
    uint total_observers_count,
    uint total_contributors_count,
    uint total_contributors_fund,
    uint voted_observers_percent,
    uint voted_contributors_percent,
    uint voted_contributors_fund_percent,
    uint[2][] memory sorted_observers_leaders,
    uint[2][] memory sorted_contributors_leaders,
    uint[2][] memory sorted_contributors_fund_leaders
)
```

- `total_observers_count` – the number of registered observers.
- `total_contributors_count` – the number of contributors with an active vote.
- `total_contributors_fund` – the combined contribution balances of actively voting contributors.
- `voted_observers_percent` – percentage (in basis points) of observers who have cast a vote.
- `voted_contributors_percent` – percentage (in basis points) of contributors who have cast a vote.
- `voted_contributors_fund_percent` – percentage (in basis points) of funds from contributors who have cast a vote.
- `sorted_observers_leaders` – sorted descending list of `[voice, count]` pairs representing observer votes.
- `sorted_contributors_leaders` – sorted descending list of `[voice, count]` pairs representing contributor votes by count.
- `sorted_contributors_fund_leaders` – sorted descending list of `[voice, amount]` pairs representing contributor votes by total fund weight.

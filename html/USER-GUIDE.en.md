# OGOO - A Decentralized Impact Fund Platform

An impact fund is an offer to complete a specific task, backed by money pooled by the community.

The platform lets users create an impact fund that accumulates contributions from supporters and turns them into a reward for whoever completes the task. The larger the reward pool, the more likely it is that someone will be willing to complete the task, which increases the chance that the task will actually get done.

An impact fund is governed by its participants. They decide whether the task has been completed and who deserves the reward.

Once the participants reach a joint decision, the reward is sent automatically to the recipient chosen by the community.

## How the Fund Works

### Fund Participants

An impact fund has two types of participants: *contributors* and *observers*.

*Contributors* are users who have made at least the minimum contribution defined when the fund was created.

*Observers* are added during the initial setup period. They monitor the fund's progress and confirm the contributors' decision about awarding the prize.

### User Identification

Contributors, observers, the fund creator (owner), and the prize recipient are all identified by their wallet addresses.

Participants and the fund creator (owner) may exercise their rights only through wallet addresses they control directly. Such wallets are called EOAs (Externally Owned Accounts). The use of intermediary contracts (proxy contracts) to manage the fund is not allowed, in order to prevent manipulation by proxy providers.

The prize recipient may designate either their own EOA or any other address to receive the prize, including, for example, the address of a proxy contract, so that the fund can transfer the reward to that address.

### Fund Creator

The fund creator defines the task parameters, the participation rules for contributors and observers, and the list of observers.
After the *approval* procedure is complete, the creator fully loses control over the fund and hands its future over to the participants.

### Performer

The potential reward recipient is the performer — the person who believes they have achieved the goal defined by the fund. The performer notifies the fund participants in any way they consider appropriate. The platform itself does not provide communication tools between a potential recipient and the fund participants.

Participants are free to vote for whichever performer they consider worthy. Based on the voting results, a winner is determined and the reward is sent to that person.

### Participant Voting

Contributors and observers vote separately.

For contributors, the results are also counted in two separate ways:
- by contributor count, where each contributor has one vote
- by contributed amount, where voting weight is proportional to the amount contributed

For a vote to succeed, the observers' voting result must match at least one of the contributors' voting results.

### Special Vote for Failure

Contributors and observers may vote to fail an offer before the voting failure deadline expires. The rules for voting for failure are the same as the rules for voting for a specific candidate — failure is simply one of the available voting options.

If enough contributors and observers vote for failure, the offer moves to the failed state. In that state, contributors may withdraw their contributions immediately.

### Contribution Withdrawal

Any contributor may cancel their contribution. A contributor who requests cancellation loses voting rights from the moment the cancellation request is submitted.
At that same moment, the contribution cancellation timeout defined when the fund was created begins to run for that contributor. Once the timeout has passed, the contributor can withdraw the contribution by calling the cancellation function again.

## User Application

The user application provides the main features needed by contributors, observers, fund creators, and other interested users.

Each user maintains their own list of offers by adding contract addresses.

The application's home page, the "Dashboard", contains four cards. Each card opens a filtered list of added offers for a specific user role.

The application menu provides the same functions as the Dashboard cards.

### User Data

Your list of offers is stored in your browser and tied to the website where you access the user application.
Usually this is `ogoo.io`, but it can also be your own website if you have deployed your own copy of the application.
All interactions with the Ethereum network are handled through your wallet, regardless of which copy of the application you use to access it. The application does not store any data on its own server. Your data lives in two places: your browser, which stores your personal offer list, and the Ethereum network, which stores the offers themselves and their current state.

The only way to identify an offer is by its contract address. Save the contract addresses you work with. Keep in mind that clearing browser data for `ogoo.io` will erase the personal offer list you use on that site in that browser.

Your access to the Ethereum network and to an offer smart contract is determined by your wallet's current address.
The smart contract assigns your rights based on that address. In other words, your wallet address determines whether the contract sees you as the owner, a contributor, an observer, or just someone interested in the offer.

### Adding an Offer Address

If you receive an offer address from any source, you can view that offer by adding its address to your offer list.

Open the Add Offer dialog in one of the following ways:
- Choose "Offers" -> "Add by Address" from the menu
- Click the "Add by Address" button in the full offer list

The Add Offer dialog lets you paste or enter an Ethereum offer address manually
(a string that starts with `0x` and consists of 20 pairs of hexadecimal digits). If your browser has access to the camera, you can also add the address with the QR code scanner by clicking the camera button to the right of the address field.

### Dashboard

The "Dashboard" contains four cards, each of which opens a filtered list of the offers you have added for a specific user role.

The "Create Offer" button on the Dashboard also gives you quick access to creating a new offer.

Each card shows the number of offers in the corresponding list.

The "All Offers" card shows every offer you have added to your offer list.

The "My Contributions" card shows only the offers from your list where you have a contribution.

The "Managed by Me" card shows only the offers from your list that you created and own.

The "Observing" card shows only the offers from your list where you were added as an observer.

Each card shows the total number of offers in that category. Clicking the card button opens the corresponding list.

### All Offers List

The All Offers page can be opened either from the "All Offers" card or from the menu: "Offers" -> "All Offers".

The page contains an "Add by Address" button and a set of cards for all offer addresses you have added.

Each card shows the offer name, the contract address, the contract balance, and these action buttons:

- Contribute - make a new contribution or add more to your existing contribution
- Share - copy the contract address or share it as a QR code
- Remove - remove the offer from the list

The offer address line on the card opens the offer details page.

The icons in the upper-left corner of the card show your relationship to the offer and the offer's status:

- copyright icon - you are the creator (owner) of the offer
- eye icon - you are an observer of the offer
- money-hand icon - you are a contributor to this offer's fund

Offer statuses:
- wrench icon - the offer is under construction
- gear icon - the offer has been approved and is active
- checkmark icon - the offer has been completed successfully and the reward has been paid out
- slashed-circle icon - the offer has failed and contributors may withdraw their funds

In the upper-right corner of the card, the status is also shown as text:
- Under Construction - the offer is still being created
- Running - the offer has been approved and is active
- Completed - the offer has been completed successfully and the reward has been paid out
- Failed - the offer has failed and contributors may withdraw their funds

### Contributions List

The Contributions page can be opened either from the "My Contributions" card or from the menu: "Contributions" -> "My Contributions".

The page contains a "Create Contribution" button and a set of cards for all added offers where you have a contribution.

Each card shows the offer name, contract address, your contribution amount, the contract balance, and these action buttons:
- the `+` icon next to the amounts - increase your contribution
- Vote - vote as a contributor
- Cancel - start the contribution cancellation process, or finish a previously started cancellation after the timeout period has expired
- Share - copy the contract address or share it as a QR code

The offer address line on the card opens the offer details page.

The icons in the upper-left corner show the offer's status.

Offer statuses:
- wrench icon - the offer is under construction
- gear icon - the offer has been approved and is running
- checkmark icon - the offer has been completed successfully and the reward has been paid out
- slashed-circle icon - the offer has failed and contributors may withdraw their funds

In the upper-right corner of the card, the status is also shown as text:
- Under Construction - the offer is still being created
- Running - the offer has been approved and is active
- Completed - the offer has been completed successfully and the reward has been paid out
- Failed - the offer has failed and contributors may withdraw their funds

### Managed Offers List

The Managed Offers page can be opened either from the "Managed by Me" card or from the menu: "Management" -> "Managed by Me".

The page contains a "Create Offer" button and a set of cards for all offers you created.

Each card shows the offer name, contract address, contract balance, and these action buttons:
- Edit - change any offer parameters until the offer is approved
- Approve - approve the offer, after which it becomes active and can no longer be changed
- Share - copy the contract address or share it as a QR code

The offer address line on the card opens the offer details page.

The icons in the upper-left corner show the offer's status.

Offer statuses:
- wrench icon - the offer is under construction
- gear icon - the offer has been approved and is running
- checkmark icon - the offer has been completed successfully and the reward has been paid out
- slashed-circle icon - the offer has failed and contributors may withdraw their funds

In the upper-right corner of the card, the status is also shown as text:
- Under Construction - the offer is still being created
- Running - the offer has been approved and is active
- Completed - the offer has been completed successfully and the reward has been paid out
- Failed - the offer has failed and contributors may withdraw their funds

### Observed Offers List

The Observed Offers page can be opened either from the "Observing" card or from the menu: "Observing" -> "Observer Offers".

The page contains a set of cards for all offers where you are listed as an observer.

Each card shows the offer name, contract address, contract balance, and these action buttons:
- Vote - vote as an observer
- Share - copy the contract address or share it as a QR code

The offer address line on the card opens the offer details page.

The icons in the upper-left corner show the offer's status.

Offer statuses:
- wrench icon - the offer is under construction
- gear icon - the offer has been approved and is running
- checkmark icon - the offer has been completed successfully and the reward has been paid out
- slashed-circle icon - the offer has failed and contributors may withdraw their funds

In the upper-right corner of the card, the status is also shown as text:
- Under Construction - the offer is still being created
- Running - the offer has been approved and is active
- Completed - the offer has been completed successfully and the reward has been paid out
- Failed - the offer has failed and contributors may withdraw their funds

### Creating an Offer Fund

Each fund is created as a separate smart contract with its own set of parameters.

Go to the "Create Offer" page in one of the following ways:
- Click the "Create Offer" button on the application Dashboard
- Click the "Create Offer" button above the list of offers you manage
- Choose "Management" -> "Create Offer" from the menu

On the page that opens, fill in all fields with the required values.

After entering all fields, click the "Create Offer" button at the bottom of the page.

You will see a confirmation dialog showing all the data you entered. Click the "Create Offer" button at the bottom of that dialog.

Your wallet will then prompt you to submit the contract creation transaction.

**WARNING** Creating a contract, like any operation on Ethereum, requires paying a network fee.
The fee for creating an offer depends on the amount of initial data and on some network parameters.
Your wallet will estimate the required fee and ask you to confirm it. The cost of contract creation increases with the size of the contract data, including its text fields.

#### Entering Amounts

When creating or editing an offer, all amounts can be entered with up to 3 decimal places by selecting one of the available units.
Supported amount units:
- w - ${Wei}=10^{-18}Ξ$
- Kw - ${KiloWei}=10^{-15}Ξ$
- Mw - ${MegaWei}=10^{-12}Ξ$
- Gw - ${GigaWei}=10^{-9}Ξ$
- mkΞ - ${MicroEther}=10^{-6}Ξ$
- mΞ - ${MilliEther}=10^{-3}Ξ$
- Ξ - ${Ether}=1Ξ$ - the default choice
- KΞ - ${KiloEther}=10^{3}Ξ$
- MΞ - ${MegaEther}=10^{6}Ξ$
- GΞ - ${GigaEther}=10^{9}Ξ$
- TΞ - ${TeraEther}=10^{12}Ξ$

#### Entering Time Periods

When creating or editing an offer, all time values can be entered with up to 1 decimal place by selecting one of the available units.
Supported time units:
- sec - seconds (the fractional part is ignored)
- min - minutes
- hour - hours
- days - days
- weeks - weeks

#### Entering Percentages

When creating or editing an offer, all percentage-based parameters can be entered with up to 3 decimal places, in the range from 0 to 100.

### Offer Text Fields

**WARNING** Text fields affect the total size of the contract's initial data and therefore also affect the deployment fee.

#### Caption

The caption is the fund's one-line title. It appears in offer lists and on offer cards.

#### Description

The description is a multi-line field that supports Markdown formatting. It appears below the title on the offer details page.

#### Full Details

Full Details is a separate multi-line document that supports Markdown formatting. It appears on a separate tab on the offer details page.

#### Contributor Limits and Thresholds

##### Min Contribution

This is the minimum contribution amount. To become a contributor to the fund being created, a user must make a one-time contribution of at least this amount.

This parameter prevents a malicious participant from splitting funds into many tiny contributions in order to artificially increase their influence in voting.

##### Cancel Timeout

The cancel timeout defines the cooling-off period before a contributor can withdraw their contribution after first requesting cancellation.

This parameter prevents contribution-based manipulation, where a malicious contributor repeatedly contributes and immediately cancels.

#### Voting Start Conditions

The voting start conditions define when vote results are allowed to affect the fund's decision-making process.

After the offer is approved, voting begins once the thresholds defined by these conditions have been reached together.

Once the threshold has been reached, later fluctuations caused by canceled contributions no longer affect the fund's ability to make a decision through voting.

These parameters are intended to prevent manipulation through premature voting by malicious contributors.

##### Voting Start Balance

To start voting, the total amount of collected contributions must exceed this threshold.

##### Voting Start Count

To start voting, the number of contributors must exceed this threshold.

#### Failure Timeouts

Failure timeouts define when an offer must fail if the required conditions have not been met by certain cutoff times.

##### Voting Start Timeout

Voting must start — that is, the voting start conditions must be reached — before the specified time has passed after the offer is approved.

If voting has not started by that time, the next transaction will move the offer into the failed state.

In the failed state, contributors can immediately reclaim their contributions.

##### Voting Failure Timeout

Sooner or later, the fund participants must make a decision about the reward. If no such decision is made within the specified time after the offer is approved, the next transaction will move the offer into the failed state.

#### Quorum Criteria

Quorum defines the minimum share of *cast* votes relative to the *total available* votes required for a vote to produce a decision.

The *total available* votes are all votes that *could take part* in the voting process.

The *cast* votes are the votes that *actually took part* in the voting process.

Quorum parameters are set as percentages. If a quorum parameter is 0, the votes required for a decision are measured against the total number of votes. If a quorum parameter is not 0, the votes required for a decision are measured against the number of votes actually cast.

##### Observer Quorum

Observer quorum is the percentage of all observers who must participate in the vote for a decision to be valid.

##### Contributor Quorum

Contributor quorum is the percentage of all contributors, excluding those who have submitted a cancellation request, who must participate in the vote for a decision to be valid.

##### Contribution Quorum

Contribution quorum is the percentage of the total contributed amount, excluding contributions for which a cancellation request has been submitted, that must participate in the vote for a decision to be valid.

#### Voting Success Criteria

Voting success criteria define the thresholds participants must reach in order for their chosen candidate to win.

A candidate is considered the winner only when the observers' voting result matches one of the contributors' voting results
(either by contributor count or by contributed amount).

##### Observer Percentage

The percentage of observers who voted for a specific candidate.

##### Contributor Percentage

The percentage of contributors who voted for a specific candidate.

##### Contribution Percentage

The percentage of contributed funds represented by contributors who voted for a specific candidate.

### Editing a Fund

After creating a fund, you are taken to the fund editing page. You can also open the same page later from the list of offers you manage.

The editing page differs from the creation page only by adding a field for the list of fund observers. All other fields have the same meaning as they do during creation.

At any time before approval, you can return to the editing page from the list of offers you manage. On the offer card, click the "Edit" button.

#### Editing the Observer List

Observers are people who care about the outcome of the offer and whose judgment trustworthy contributors can rely on. Having observers helps prevent manipulation of contributor voting. When a fund has observers, a reward decision can be made only if the contributors' result matches the observers' result. An observer may or may not also be a contributor.

The observer list is simply a list of Ethereum wallet addresses. The fund creator may add and remove addresses from that list. Like the other offer fields, the observer list can be edited only until the offer is approved by its creator.

Add observers using the `+` button in the observer list field.

The Add Observer dialog is an Ethereum address entry dialog. You can copy a wallet address from any source and paste it into the input field. You can also enter an address using the QR code scanner.

Add only EOA (Externally Owned Account) addresses to the observer list. When an address is added, the contract cannot verify on its own whether that address is an EOA. At the same time, the fund can authorize observer actions only if they are performed directly from an EOA.

After confirming the Add Observer dialog, the application will initiate the add-observer transaction, which requires wallet confirmation and a small network fee.

Addresses already added to the list have an `x` button after the address. You can remove an observer from the list using that button.

After the remove confirmation dialog, the application will initiate the remove-observer transaction, which also requires wallet confirmation and a small network fee.

Changing the observer list does not require updating the rest of the offer data.

### Approving an Offer

Once all offer fields have been filled in, the owner may approve the offer.

**WARNING** After approval, the creator permanently loses all control over the offer, while still remaining its formal owner.

In the list of offers you manage, click the "Approve" button for the selected offer.

A special confirmation dialog will appear, warning you again that this status change is irreversible. After you confirm, your wallet will show its own confirmation dialog.

### Contributor Voting

A contributor can click the "Vote" button on an offer card in the Contributions list.

The voting dialog includes a wallet address field for the candidate the contributor is voting for.

A contributor may also vote for the offer to fail. To do this, click the slashed-circle button to the right of the address field in the voting dialog. After entering an address or choosing the failure option, clicking the "Vote" button will submit and save the contributor's vote.

### Observer Voting

An observer can click the "Vote" button on an offer card in the Observed Offers list.

The voting dialog includes a wallet address field for the candidate the observer is voting for.

An observer may also vote for the offer to fail. To do this, click the slashed-circle button to the right of the address field in the voting dialog. After entering an address or choosing the failure option, clicking the "Vote" button will submit and save the observer's vote.

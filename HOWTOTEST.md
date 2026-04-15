# How to Test the OGOO Software

## 🗐 Documentation Pages

- [README](README.md)
- [OGOO Contract](OGOOContract.md)
- [Offer Definition](OfferDefinition.md)
- [Offer Contract API](OfferContractAPI.md)
- [How To Test](HOWTOTEST.md) ⏴ *this page*

## Install a Wallet

The OGOO software requires a cryptocurrency wallet. We recommend [MetaMask](https://metamask.io/).

To install the MetaMask extension:

1. Open your web browser (Chrome, Firefox, Edge, or Brave).
2. Visit the [official MetaMask website](https://metamask.io/).
3. Click **Download** and select your browser.
4. Follow the prompts to add the MetaMask extension.
5. After installation, click the MetaMask icon in your browser toolbar to set up your wallet.

## Install a Local Test Cryptocurrency Network

This step is _optional_ if you want to use the software on a public Ethereum testnet or mainnet. Please note that you will **spend your tokens** on whichever network you use for testing.

We recommend starting a local HardHat test node. To do this, you need Node.js installed.

### Install Node.js

Node.js is required to run HardHat. To install Node.js:

1. Visit the [official Node.js website](https://nodejs.org/).
2. Download the **LTS** (Long Term Support) version for your operating system.
3. Run the installer and follow the setup instructions.
4. After installation, verify Node.js is installed by running the following commands in your terminal:

    ```sh
    node --version
    npm --version
    ```

Both commands should print version numbers, confirming a successful installation.

### Install HardHat

HardHat is a development environment for Ethereum smart contracts. To install it:

1. Create an empty folder.
2. Open your terminal in that folder.
3. Run the following command to install HardHat as a development dependency:

    ```sh
    npm install hardhat
    ```

4. After installation, initialize a new HardHat project by running:

    ```sh
    npx hardhat
    ```

5. Follow the prompts to set up your HardHat project. You can accept the default answers.

### Start the HardHat Node

Start the local test node with:

```sh
npx hardhat node
```

You will see a list of test accounts in the console output, for example:

```
> npx hardhat node
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========

WARNING: These accounts, and their private keys, are publicly known.
Any funds sent to them on Mainnet or any other live network WILL BE LOST.

Account #0: 0xf39...266 (10000 ETH)
Private Key: 0xac09...f80

Account #1: 0x709...9C8 (10000 ETH)
Private Key: 0x59c6...90d

...
```

For testing, you can use any of the listed accounts. They are pre-funded with test tokens.

**Note:** The HardHat node resets its blockchain state every time it restarts. All accounts and contracts will be reset.

## Go to the Site

The published version is available on the [OGOO site](https://ogoo.io).

A non-published version should be tested on *your own* site deployment.

### Local site preparation

Use `git` to clone the source of the package

```bash
git clone git@github.com:nnseva/OGOO.git
cd OGOO
```

Use `Node.js` to prepare a site.

```bash

npm install
npx solt pp templates/ogoo.solt -o contracts/ogoo.sol
npx hardhat compile
```

### Local site deployment

You can use Apache or Nginx to create your own site on the localhost. This site is totally static.

For example, the following config allowes to deploy a site locally on the Linux host using the Apache2 server:

`/etc/apache2/sites-available/003-ogoo.conf`
```
<VirtualHost *:80>
        ServerName ogoo.local

        ServerAdmin webmaster@localhost

        # Here should be an actual path to the OGOO/html subdirectory
        DocumentRoot /home/<username>/OGOO/html

        ErrorLog ${APACHE_LOG_DIR}/ogoo-error.log
        CustomLog ${APACHE_LOG_DIR}/ogoo-access.log combined
</VirtualHost>

# Use the same actual path to the OGOO/html subdirectory
<Directory /home/<username>/OGOO/html>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
</Directory>
```

Activate the site:
```bash
a2ensite 003-ogoo.conf
```

Reload the apache2 server:

```bash
systemctl reload apache2
```

You also need to have the `ogoo.local` hostname resolved. Add the following
row into your `/etc/hosts` file:

```
127.0.0.1 ogoo.local
```

### Browser hack for the local site

The local site is HTTP, not HTTPS. The modern browsers forbid using the camera on the HTTP site. The OGOO site may use the camera to scan QR codes with accounts.

You can hack the Chromium (probably the Chrome also) browser to allow using the camera on a selected set of HTTP sites.

Use the following URL:

[chrome://flags/#unsafely-treat-insecure-origin-as-secure](chrome://flags/#unsafely-treat-insecure-origin-as-secure)

Enable the feature.

Input `http://ogoo.local` into the input field.

## Open the site

The site will prompt you to connect your MetaMask wallet. Follow the instructions.

If everything is set up correctly, you will see your account number and ETH balance displayed under the site’s top menu. The wallet selector in the top right corner should show the MetaMask icon and name.

### Modern MetaMask testing network connection

On the modern versions of the MetaMask you will need to add and select the testing Ethereum network for the particular site (`ogoo.io` or `ogoo.local`).

Open the `ogoo.io` or `ogoo.local` site, and connect the MetaMask wallet if not yet. Open the MetaMask plugin and click the _application icon_ to the left of the menu switch in the top right corner of MetaMask.

You will see the site name (`ogoo.io` or `ogoo.local`) and an active (blue) link to the network directly below. Click this link.

You will see the "Network Management" list where all available networks are listed. The "Add Custom Network" button
should be present below the list. Click it if you don't see your custom network in a list yet, and input the
following values into the input fields:

    - **Network Name:** HardHat Localhost
    - **New RPC URL:** http://127.0.0.1:8545/
    - **Chain ID:** 31337
    - **Currency Symbol:** ETH
    - **Block Explorer URL:** (leave blank)

Ensure that the "HardHat Localhost" is an active element in the list.

### Older MetaMask testing network connection

On the older versions of the MetaMask you will need to add and select the testing Ethereum network for all sites.

1. Open MetaMask and click the network dropdown at the top.
2. Select **Add network** (or **Add network manually**).
3. Enter the following details:
    - **Network Name:** HardHat Localhost
    - **New RPC URL:** http://127.0.0.1:8545/
    - **Chain ID:** 31337
    - **Currency Symbol:** ETH
    - **Block Explorer URL:** (leave blank)
4. Click **Save**.

MetaMask will now use your local HardHat node as the network.

#### Import a Test Account into MetaMask

To use one of the HardHat test accounts in MetaMask:

1. In the HardHat node output, copy the **private key** of the account you want to use.
2. Open MetaMask and click your account icon (at the top center of the MetaMask interface).
3. Select **Add Account**.
4. Choose **From Private Key**.
5. Paste the copied private key into the field.
6. Click **Import**.

The test account will now appear in your MetaMask wallet, and you can use its pre-funded test ETH for transactions.

Make sure to select the _test network_ as your current network, and your _test account_ as your current account (dropdown at the top center of MetaMask). You should see your test account pre-funded with 10000 ETH. If the balance does not appear immediately, try switching networks in MetaMask.

- In the oldest versions of MetaMask, the _network_ is switched globally using dropdown in the top left corner of MetaMask
- In the modern versions of MetaMask, the _network_ is switched **individually** for the application, clicking the _application icon_ to the left of the menu switch in the top right corner of MetaMask.

## Offer Operations

### Creating an Offer

Create a new offer by clicking the **Create Offer** button on the home page or selecting the appropriate option from the application menu. Once the offer is created, it will appear in both the general offers list and your managed offers list. After confirming the transaction in MetaMask, you can continue editing the offer.

Try creating several different offers using various accounts.

### Adding Observers

After creating an offer, you’ll be taken to the offer editing page. You can also access this page from the Managed Offers List by clicking the **Edit** button.

On the offer editing page, add observers to your offer. You can use any pre-funded accounts generated by the HardHat test node as observers.

### Approving the Offer

Go to the Managed Offers list via the **Managed Offers** - **Managed by Me** menu. Approve the offer by clicking the **Approve** button.

### Checking Offer Status

Click the offer link (on the offer's address line) in any offer list to view its current status.

### Contributing to the Offer

Open the general offers list from the **Offers** - **All Offers** menu. Click the **Contribute** button and enter the amount you wish to contribute. You can view your contributions in the **Contributions** - **My Contributions** menu.

Try contributing from multiple accounts.

### Voting as a Contributor

Go to the contributions list via the **Contributions** - **My Contributions** menu. Click the **Vote** button and enter a contender’s address. You can use your camera to scan the Ethereum address. To vote for failure, use the **Failure** button (red slashed circle).

You may vote multiple times.

### Voting as an Observer

Switch to the observer account in MetaMask that you added during the [Adding Observers](#adding-observers) step.

Open the Observed Offers list from the **Observing** - **Observed Offers** menu. Click the **Vote** button and enter a contender’s address. You can use your camera to scan the Ethereum address. To vote for failure, use the **Failure** button (red slashed circle).

You may vote multiple times.

### Completing Voting and Verifying the Winner

Fulfill all the conditions required for the offer to be completed.

Check the offer status by clicking its link in any offer list. Confirm that the offer is completed and a winner has been determined.

Check the winner’s account in MetaMask to verify that their balance has increased.

### Cleaning Up test data stored by the MetaMask

To prevent MetaMask issues after restarting the HardHat node, clean up your test accounts’ activity.

Either delete all test accounts or, for each test account:

1. Select the test network and the account in MetaMask.
2. Go to the Activity tab for the account. If there are any actions listed, they should be cleared.
3. Use the **Settings** - **Advanced** - **Clear Activity** option in MetaMask (found in the top right menu).

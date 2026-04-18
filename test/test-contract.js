const { expect, should } = require("chai");

should();

// TODO: test revoting for correct change leaders state
// TODO: test CancelationInProgress

// Helper functions

var gas_price; // in Wei
var wei_price; // in dollars

// Get the real world price of wei and gas price from the open source price feed
async function fetchPrice() {
  if( typeof(gas_price) == 'undefined' || typeof(wei_price) == 'undefined' ) {
    var price_data = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd').then(response => response.json());
    wei_price = price_data.ethereum.usd / 10.**18; // Price of 1 wei in dollars
    var gas_data = await fetch('https://api.owlracle.info/v4/eth/gas?eip1559=false').then(response => response.json());
    var total_sum = 0;
    for(var k in gas_data.speeds) {
      total_sum += gas_data.speeds[k].gasPrice;
    }
    gas_price = BigInt(Math.floor(total_sum / Object.keys(gas_data.speeds).length * 10**9)); // Average gas price in wei
    console.debug("Fetched price data: Gas price (WEI):", gas_price,  "Wei price ($):", wei_price);
  }
}

function to$(wei) {
  return (hre.ethers.toNumber(wei / 10n**9n) * wei_price * 10.**9).toFixed(2);
}

function gasTo$ (gas) {
  return to$(gas * gas_price);
}

function extractData(ex) {
  var data = ex.data;
  if( typeof(data) == 'undefined' ) {
    return 'unknown';
  }
  if( typeof(data) != 'string') {
    return extractData(data);
  }
  return data;
}

const CONTRACT_FAILED = 1n << 255n;
const as_vote = function(voting) {
    // returns a structured vote object from combined voting value
    var failure = voting == CONTRACT_FAILED;
    return {
        contender: ethers.getAddress(ethers.toBeHex(failure ? 0n: voting, 20)),
        failure: failure,
    }
}

describe("Contract Tests", function () {
  beforeEach(async function () {
    await fetchPrice();
  });
  it("Test the contract life circle main path", async function () {
    console.log("Test the contract life circle main path");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 30000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var test_definition_values = [];
    for(var k in test_definition) {
        test_definition_values.push(test_definition[k]);
    }
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_observer = accounts[1]; // the account will be a signer to check an access from the observer
    var account_contributor = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var beginning_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account at the beginning:", beginning_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");
    // Calculate gas for deployment
    var deployment_gas_price = await account_owner.estimateGas(await Offer.getDeployTransaction(test_definition));
    console.debug("Projected deployment gas price:", deployment_gas_price, "Real world amount $:", gasTo$(deployment_gas_price));
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance, start_balance - beginning_balance);
    // Start deployment, returning a promise that resolves to a contract object

    // sample for the online event filter for the OfferCreated event when the address is not yet known
    var create_offer_filter = {
        topics: [
          ethers.id('OfferCreated()')
        ]
    }
    var offer_created_log;
    var create_offer_handler = (log) => {
        console.log('OfferCreated event for:', log.address);
        offer_created_log = log;
    }
    expect(offer_created_log).to.be.a('undefined');
    account_owner.provider.on(create_offer_filter, create_offer_handler);
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    await new Promise(resolve => setTimeout(resolve, 1000));
    account_owner.provider.off(create_offer_filter, create_offer_handler);
    expect(offer_created_log).to.not.be.a('undefined');
    console.info("Contract deployed to address:", offer.target);
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract owner is:", await offer.owner());

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the observer
    var observer_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_observer, // Observer account trying access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )
    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      var definition = await o.definition();
      expect(test_definition_values).to.have.deep.members(definition);
      await new Promise(resolve => setTimeout(resolve, 1000));
      // test updating the definition
      test_definition.contributors_vote_fund_percent = 9900n;
      var txod = await o.definition_update(test_definition);
      var txod_receipt = await txod.wait();
      await new Promise(resolve => setTimeout(resolve, 1000));
      definition = await o.definition();
      test_definition_values = [];
      for(var k in test_definition) {
        test_definition_values.push(test_definition[k]);
      }
      expect(test_definition_values).to.have.deep.members(definition);

      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor contribution_min_balance
      account_contributor.sendTransaction({to:offer.target, value:0n}).should.eventually.rejectedWith('reverted');
      account_contributor.sendTransaction({to:offer.target, value:20000000000000001n}).should.eventually.rejectedWith('reverted');

      // test the contributor created an account sending there enough amount
      await (await account_contributor.sendTransaction({to:offer.target, value:30000000000000001n})).wait();

      var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      var diff = start_balance_contributor - end_balance_contributor;
      console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      // test the contributor can increase the balance
      await (await account_contributor.sendTransaction({to:offer.target, value:10000000000000001n})).wait();

      end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      diff = start_balance_contributor - end_balance_contributor;
      console.debug("Contributor account after updating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after updating contribution:", end_balance_offer);

      var end_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account after creating contribution:", end_balance_owner);

      // test access to the origin's contribution
      var outside_contribution = (await outside_access.origin_contributor_status())[2];
      outside_contribution.should.be.equal(0n);

      var contributor_contribution = (await contributor_access.origin_contributor_status())[2];
      contributor_contribution.should.be.equal(40000000000000002n);

      // testing observers creation
      await (await o.observer_create(account_outside.address)).wait();
      console.log("Registered observer address to cancel:", account_outside.address);

      await (await o.observer_create(account_observer.address)).wait();
      console.log("Registered observer address to work with:", account_observer.address);

      // test observer's removing
      await (await o.observer_remove(account_outside.address)).wait();

      // test removing absent observer
      o.observer_remove(account_outside.address).should.eventually.rejectedWith('reverted');

      console.log('Going to approve the contract...');
      // try to approve by the outside account should lead to revert
      o.interface.parseError(extractData(await outside_access.approve().should.eventually.rejectedWith('reverted'))).name.should.be.equal('OwnerOnly');
      // approve and check the runtime event generation
      {
          var offer_approved_event;
          var offer_approved_event_outside;
          o.once('OfferApproved', (event) => {
            offer_approved_event = event;
          });
          outside_access.once('OfferApproved', (event) => {
            offer_approved_event_outside = event;
          });
          // Approve the contract to make it unmutable
          await (await o.approve()).wait();
          await new Promise(resolve => setTimeout(resolve, 1000));
          expect(offer_approved_event).to.not.be.a('undefined');
          expect(offer_approved_event_outside).to.not.be.a('undefined');
      }
      console.log('...the contract approved');
      // Trying to modify observers list should be failed
      o.interface.parseError(extractData(await o.observer_create(account_outside.address).should.eventually.rejectedWith('reverted'))).name.should.be.equal('PreparedOnly');
      o.interface.parseError(extractData(await o.observer_remove(account_outside.address).should.eventually.rejectedWith('reverted'))).name.should.be.equal('PreparedOnly');

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);
      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      state = await contender_access.state();
      console.log('State after contributor vote', state)
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await observer_access.observer_vote(account_contender.address)).wait();
      state = await contender_access.state();
      console.log('State after observer vote', state);
      state.should.be.equal(2n);
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.OfferDefinitionUpdated());
          events.length.should.be.equal(1);
          expect(events[0].args[0]).to.deep.equal(test_definition_values);
      }
      {
          var events = await o.queryFilter(outside_access.filters.ObserverCreated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_outside.address);
          expect(events[1].args[0]).to.equal(account_observer.address);
      }
      {
          var events = await o.queryFilter(outside_access.filters.ObserverRemoved());
          events.length.should.be.equal(1);
          expect(events[0].args[0]).to.equal(account_outside.address);
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(1);
          expect(events[0].args[0]).to.equal(account_contributor.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor.address);
          expect(events[0].args[1]).to.equal(30000000000000001n);
          expect(events[1].args[1]).to.equal(40000000000000002n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contributor.address,account_contender.address,false])
      }
      {
          var events = await o.queryFilter(o.filters.ObserverVote());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_observer.address,account_contender.address,false])
      }
      {
          var events = await o.queryFilter(o.filters.OfferCompleted());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contender.address,40000000000000002n])
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the case without observers", async function () {
    console.log("Test the case without observers");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 30000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      await new Promise(resolve => setTimeout(resolve, 1000));

      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);
      var start_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
      console.debug("Contributor2 account before creating contribution:", start_balance_contributor2);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor created an account sending there enough amount
      await (await account_contributor.sendTransaction({to:offer.target, value: 30000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 30000000000000001n})).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      {
        var end_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor2;
        console.debug("Contributor2 account after creating contribution:", end_balance_contributor2, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      var end_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account after creating contribution:", end_balance_owner);

      // test access to the origin's contribution
      var outside_contribution = (await outside_access.origin_contributor_status())[2];
      outside_contribution.should.be.equal(0n);

      {
        var contributor_contribution = (await contributor_access.origin_contributor_status())[2];
        contributor_contribution.should.be.equal(30000000000000001n);
      }
      {
        var contributor2_contribution = (await contributor2_access.origin_contributor_status())[2];
        contributor2_contribution.should.be.equal(30000000000000001n);
      }

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // Trying to modify observers list should be failed
      o.interface.parseError(extractData(await o.observer_create(account_outside.address).should.eventually.rejectedWith('reverted'))).name.should.be.equal('PreparedOnly');
      o.interface.parseError(extractData(await o.observer_remove(account_outside.address).should.eventually.rejectedWith('reverted'))).name.should.be.equal('PreparedOnly');

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);

      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      console.debug("Contributor has just voted");
      await (await contributor2_access.contributor_vote(account_contender.address)).wait();
      console.debug("Contributor2 has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
          expect(events[0].args[1]).to.equal(30000000000000001n);
          expect(events[1].args[1]).to.equal(30000000000000001n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(2);
          expect(events[0].args).to.deep.equal([account_contributor.address,account_contender.address,false])
          expect(events[1].args).to.deep.equal([account_contributor2.address,account_contender.address,false])
      }
      {
          var events = await o.queryFilter(o.filters.OfferCompleted());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contender.address,60000000000000002n])
      }

    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the contribution unlock timeout preventing contribution cancelling", async function () {
    console.log("Test the contribution unlock timeout preventing contribution cancelling");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 120n,
        "contribution_min_balance": 30000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )
    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);
      var start_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
      console.debug("Contributor2 account before creating contribution:", start_balance_contributor2);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor created an account sending there enough amount
      await (await account_contributor.sendTransaction({to: offer.target, value: 30000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 30000000000000001n})).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      {
        var end_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor2;
        console.debug("Contributor2 account after creating contribution:", end_balance_contributor2, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      var end_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account after creating contribution:", end_balance_owner);

      // test access to the origin's contribution
      var outside_contribution = (await outside_access.origin_contributor_status())[2];
      outside_contribution.should.be.equal(0n);

      {
        var contributor_contribution = (await contributor_access.origin_contributor_status())[2];
        contributor_contribution.should.be.equal(30000000000000001n);
      }
      {
        var contributor2_contribution = (await contributor2_access.origin_contributor_status())[2];
        contributor2_contribution.should.be.equal(30000000000000001n);
      }

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);

      await (await contributor2_access.contribution_cancel()).wait();
      console.debug("Contributor2 has just cancelled contribution");
      {
        var time_to_cancel = (await contributor2_access.origin_contributor_status())[4];
        console.log("Contributor2 time to cancel", time_to_cancel);
      }

      await(await contributor_access.contributor_vote(account_contender.address)).wait();
      console.debug("A single left contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the contribution unlock timeout success contribution cancelling", async function () {
    console.log("Test the contribution unlock timeout success contribution cancelling");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 30n,
        "contribution_min_balance": 30000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      await new Promise(resolve => setTimeout(resolve, 1000));

      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);
      var start_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
      console.debug("Contributor2 account before creating contribution:", start_balance_contributor2);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor created an account sending there enough amount
      await (await account_contributor.sendTransaction({to:offer.target, value:30000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value:30000000000000001n})).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      {
        var end_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor2;
        console.debug("Contributor2 account after creating contribution:", end_balance_contributor2, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      var end_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account after creating contribution:", end_balance_owner);

      // test access to the origin's contribution
      var outside_contribution = (await outside_access.origin_contributor_status())[2];
      outside_contribution.should.be.equal(0n);

      {
        var contributor_contribution = (await contributor_access.origin_contributor_status())[2];
        contributor_contribution.should.be.equal(30000000000000001n);
      }
      {
        var contributor2_contribution = (await contributor2_access.origin_contributor_status())[2];
        contributor2_contribution.should.be.equal(30000000000000001n);
      }

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor2_access.contribution_cancel()).wait();
      console.debug("Contributor2 has just cancelled contribution");
      while(42) {
        // generate a block to increase the time without mining - necessary for hardhat node
        await (await account_contributor2.sendTransaction({to:account_owner, value:100n})).wait();
        var time_to_cancel = (await contributor2_access.origin_contributor_status())[4];
        if( !time_to_cancel )
          break;
        console.log("Contributor2 time to cancel", time_to_cancel);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      await (await contributor2_access.contribution_cancel()).wait();
      {
        var interm_balance_offer = await account_owner.provider.getBalance(offer.target);
        console.debug("Offer account after cancel contribution", interm_balance_offer);
        interm_balance_offer.should.be.equal(30000000000000001n);
      }
      console.debug("Contributor2 has just successfully cancelled contribution");
      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      console.debug("A single left contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
          expect(events[0].args[1]).to.equal(30000000000000001n);
          expect(events[1].args[1]).to.equal(30000000000000001n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contributor.address,account_contender.address,false])
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCanceled());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contributor2.address])
      }
      {
          var events = await o.queryFilter(o.filters.OfferCompleted());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contender.address,30000000000000001n])
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the voting start balance prevents early contract finishing", async function () {
    console.log("Test the voting start balance prevents early contract finishing");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 10n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 20000000000000000n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    console.info("Waiting for deployment...");
    var deployment_tx = offer.deploymentTransaction();
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      await new Promise(resolve => setTimeout(resolve, 1000));

      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor created an account
      await (await account_contributor.sendTransaction({to:offer.target, value:10000000000000001n})).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      {
        var state = await contender_access.state();
        console.log('State before first vote', state);
        state.should.be.equal(1n);
      }
      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);

      console.debug("A single contributor voting should success, but doesn't change state");
      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      {
        var state = await contender_access.state();
        console.log('State should not be changed', state);
        state.should.be.equal(1n);
      }

      var start_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
      console.debug("Contributor2 account before creating contribution:", start_balance_contributor2);
      await (await account_contributor2.sendTransaction({to:offer.target, value:30000000000000001n})).wait();
      {
        var end_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor2;
        console.debug("Contributor2 account after creating contribution:", end_balance_contributor2, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      console.debug("Contributor2 voting should success and finish the contract");
      await (await contributor2_access.contributor_vote(account_contender.address)).wait();
      console.debug("Contributors have just voted");
      {
        var state = await contender_access.state();
        console.log('State after contributors vote', state)
        state.should.be.equal(2n);
      }
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
          expect(events[0].args[1]).to.equal(10000000000000001n);
          expect(events[1].args[1]).to.equal(30000000000000001n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(2);
          expect(events[0].args).to.deep.equal([account_contributor.address,account_contender.address,false])
          expect(events[1].args).to.deep.equal([account_contributor2.address,account_contender.address,false])
      }
      {
          var events = await o.queryFilter(o.filters.OfferCompleted());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contender.address,40000000000000002n])
      }

    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the voting start count prevents early contract finishing", async function () {
    console.log("Test the voting start count prevents early contract finishing");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 10n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 2n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    console.info("Waiting for deployment...");
    var deployment_tx = offer.deploymentTransaction();
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor created an account
      await (await account_contributor.sendTransaction({to:offer.target, value:10000000000000001n})).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      {
        var state = await contender_access.state();
        console.log('State before first vote', state);
        state.should.be.equal(1n);
      }
      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);

      console.debug("A single contributor voting should success, but doesn't change state");
      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      {
        var state = await contender_access.state();
        console.log('State should not be changed', state);
        state.should.be.equal(1n);
      }

      var start_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
      console.debug("Contributor2 account before creating contribution:", start_balance_contributor2);
      await (await account_contributor2.sendTransaction({to:offer.target, value:30000000000000001n})).wait();
      {
        var end_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor2;
        console.debug("Contributor2 account after creating contribution:", end_balance_contributor2, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      console.debug("Contributor2 voting should success and finish the contract now");
      await (await contributor2_access.contributor_vote(account_contender.address)).wait();
      console.debug("Contributors have just voted");
      {
        var state = await contender_access.state();
        console.log('State after contributors vote', state)
        state.should.be.equal(2n);
      }
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(2);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[1].args[0]).to.equal(account_contributor2.address);
          expect(events[0].args[1]).to.equal(10000000000000001n);
          expect(events[1].args[1]).to.equal(30000000000000001n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(2);
          expect(events[0].args).to.deep.equal([account_contributor.address,account_contender.address,false])
          expect(events[1].args).to.deep.equal([account_contributor2.address,account_contender.address,false])
      }
      {
          var events = await o.queryFilter(o.filters.OfferCompleted());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contender.address,40000000000000002n])
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the voting start timeout fails the offer", async function () {
    console.log("Test the voting start timeout fails the offer");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 2n,
        "voting_start_timeout": 10n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    console.info("Waiting for deployment...");
    var deployment_tx = offer.deploymentTransaction();
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();
      {
        var state = await outside_access.state();
        console.log('State before first vote', state);
        state.should.be.equal(1n);
      }
      // test the contributor created an account
      await (await account_contributor.sendTransaction({to:offer.target, value:10000000000000001n})).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      console.debug("Waiting for the voting start timeout");
      await new Promise(resolve => setTimeout(resolve, 15000));
      console.debug("Try to vote by the contributor will lead to failure because of timeout");
      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      {
        var state = await outside_access.state();
        console.log('State after voting calculation should be failed', state)
        state.should.be.equal(3n);
      }
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract failure, contribution has not been reverted yet", final_balance_offer);
      final_balance_offer.should.be.equal(10000000000000001n);

      console.log('Contributor may revert the contribution immediately');
      await (await contributor_access.contribution_cancel()).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor's account after reverting contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1, "OfferCreated");
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1, "OfferApproved");
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(1, "ContributionCreated");
          expect(events[0].args[0]).to.equal(account_contributor.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(1, "ContributionUpdated");
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[0].args[1]).to.equal(10000000000000001n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(1, "ContributorVote");
      }
      {
          var events = await o.queryFilter(o.filters.OfferFailed());
          events.length.should.be.equal(1, "OfferFailed");
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCanceled());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contributor.address])
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the voting for failure", async function () {
    console.log("Test the voting for failure");
    var accounts = await hre.ethers.getSigners();
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 30000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    console.info("Waiting for deployment...");
    var deployment_tx = offer.deploymentTransaction();
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_observer = accounts[1]; // the account will be a signer to check an access from the observer
    var account_contributor = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the observer
    var observer_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_observer, // Observer account trying access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);
      // test updating the definition

      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // test the contributor created an account sending there enough amount
      await (await account_contributor.sendTransaction({to:offer.target, value:30000000000000001n})).wait();

      var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      var diff = start_balance_contributor - end_balance_contributor;
      console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      await (await o.observer_create(account_observer.address)).wait();
      console.log("Registered observer address to work with:", account_observer.address);

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);
      await (await contributor_access.contributor_vote_failure()).wait();
      state = await contender_access.state();
      console.log('State after contributor vote', state)
      state.should.be.equal(1n);
      await (await observer_access.observer_vote_failure()).wait();
      state = await contender_access.state();
      console.log("State after observer's vote should be failed", state);
      state.should.be.equal(3n);
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract failure", final_balance_offer);
      final_balance_offer.should.be.equal(30000000000000001n);
      console.log('Contributor may revert the contribution immediately');
      await (await contributor_access.contribution_cancel()).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor's account after reverting contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      // check the events history
      {
          var events = await o.queryFilter(o.filters.OfferCreated());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.OfferApproved());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCreated());
          events.length.should.be.equal(1);
          expect(events[0].args[0]).to.equal(account_contributor.address);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionUpdated());
          events.length.should.be.equal(1);
          expect(events[0].args[0]).to.equal(account_contributor.address);
          expect(events[0].args[1]).to.equal(30000000000000001n);
      }
      {
          var events = await o.queryFilter(o.filters.ContributorVote());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contributor.address,'0x0',true])
      }
      {
          var events = await o.queryFilter(o.filters.OfferFailed());
          events.length.should.be.equal(1);
      }
      {
          var events = await o.queryFilter(o.filters.ContributionCanceled());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_contributor.address])
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the voting fail timeout", async function () {
    console.log("Test the voting fail timeout");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": hre.network.name == 'local' ? 45n: 6n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var start_balance = await account_owner.provider.getBalance(account_owner.address);
    console.debug("Owner account before deployment:", start_balance);
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    console.info("Waiting for deployment...");
    var deployment_tx = offer.deploymentTransaction();
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", await offer.owner());

    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var account_contributor = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[3]; // the account will be a signer to check an access from the contender
    var account_outside = accounts[4]; // the account will be a signer to check an access from the outside
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )

    // Getting access from the outside
    var outside_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_outside, // Outside account trying access to the contract
    )

    var owner = await o.owner();
    try {
      expect(owner).to.equal(account_owner.address);

      var start_balance_owner = await account_owner.provider.getBalance(account_owner.address);
      console.debug("Owner account before creating contribution:", start_balance_owner);

      var start_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account before creating contribution:", start_balance_offer);

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      {
        var state = await outside_access.state();
        console.log('State before first vote', state);
        state.should.be.equal(1n);
      }
      // test the contributor created an account
      var start_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
      console.debug("Contributor account before creating contribution:", start_balance_contributor);
      {
        await (await account_contributor.sendTransaction({to:offer.target, value:10000000000000001n})).wait();

        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      var start_balance_contributor2 = await account_contributor2.provider.getBalance(account_contributor2.address);
      console.debug("Contributor2 account before creating contribution:", start_balance_contributor2);
      {
        await (await account_contributor2.sendTransaction({to:offer.target, value:20000000000000002n})).wait();

        var end_balance_contributor = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor;
        console.debug("Contributor2 account after creating contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }

      end_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after creating contribution:", end_balance_offer);

      await (await contributor_access.contributor_vote(account_contender.address)).wait();
      console.debug("Contributor has just voted");
      var approved_at = await outside_access.approved_at();
      var failure_at = Number(test_definition.voting_fail_timeout) - (Number((await hre.ethers.provider.getBlock('latest')).timestamp) - Number(approved_at)) + 1;
      console.debug("Waiting for the voting failure timeout:", failure_at);
      await new Promise(resolve => setTimeout(resolve, 1000 * failure_at));
      console.debug("Trying to vote should lead to failure because of timeout");
      await (await contributor2_access.contributor_vote(account_contender.address)).wait();
      {
        var state = await outside_access.state();
        console.log('State after voting calculation should be failed', state)
        state.should.be.equal(3n);
      }
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract failure, contribution has not been reverted yet", final_balance_offer);
      final_balance_offer.should.be.equal(30000000000000003n);

      console.log('Contributors may revert the contribution immediately');
      await (await contributor_access.contribution_cancel()).wait();
      await (await contributor2_access.contribution_cancel()).wait();
      {
        var end_balance_contributor = await account_contributor.provider.getBalance(account_contributor.address);
        var diff = start_balance_contributor - end_balance_contributor;
        console.debug("Contributor's account after reverting contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
      {
        var end_balance_contributor = await account_contributor2.provider.getBalance(account_contributor2.address);
        var diff = start_balance_contributor2 - end_balance_contributor;
        console.debug("Contributor's 2 account after reverting contribution:", end_balance_contributor, "Diff WEI:", diff, "Amount $:", to$(diff));
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      } else {
        console.error("Unknown revert", e);
      }
      throw e;
    }
  });
  it("Test the contributors vote contribution", async function () {
    console.log("Test the contributors vote contribution");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 6000n,
        "contributors_vote_fund_percent": 0n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    console.info("Waiting for deployment...");
    var deployment_tx = offer.deploymentTransaction();
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor3_access.contributor_vote(account_contender.address)).wait();
      console.debug("The most valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(1n);
      await (await contributor1_access.contributor_vote(account_contender.address)).wait();
      console.debug("The least valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the contributors vote amount contribution", async function () {
    console.log("Test the contributors vote amount contribution");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 0n,
        "contributors_vote_fund_percent": 5000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor3_access.contributor_vote(account_contender.address)).wait();
      console.debug("The most valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the observers vote", async function () {
    console.log("Test the observers vote");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 6000n,
        "contributors_vote_percent": 0n,
        "contributors_vote_fund_percent": 0n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Contributors also will be observers
      await (await o.observer_create(account_contributor1.address)).wait();
      await (await o.observer_create(account_contributor2.address)).wait();
      await (await o.observer_create(account_contributor3.address)).wait();

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor3_access.contributor_vote(account_contender.address)).wait();
      console.debug("The most valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(1n);
      await (await contributor1_access.observer_vote(account_contender.address)).wait();
      console.debug("The observer has just voted");
      state = await contender_access.state();
      console.log('State after observers vote', state)
      state.should.be.equal(1n);
      await (await contributor2_access.observer_vote(account_contender.address)).wait();
      console.debug("The other observer has just voted");
      state = await contender_access.state();
      console.log('State after another observers vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the voting conflict", async function () {
    console.log("Test the voting conflict");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 3000n,
        "contributors_vote_percent": 3000n,
        "contributors_vote_fund_percent": 3000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Let's the contender is observer
      await (await o.observer_create(account_contender.address)).wait();

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);

      await (await contributor3_access.contributor_vote(account_contributor3.address)).wait();
      console.debug("The most valuable contributor has just voted for himself");
      await (await contributor1_access.contributor_vote(account_contributor1.address)).wait();
      await (await contributor2_access.contributor_vote(account_contributor1.address)).wait();
      console.debug("The least valuable contributors has just voted for contributor1");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(1n);

      await (await contender_access.observer_vote(account_contender.address)).wait();
      console.debug("The observer/contender has just voted for himself");

      state = await contender_access.state();
      console.log('State after conflict observer vote should not be changed, voting conflict', state)
      state.should.be.equal(1n);
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test multiple votings and revoting", async function () {
    console.log("Test multiple votings and revoting");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(offer.target, contract_abi.abi, account_owner);

    // Getting access from contributors
    var contributors = accounts.slice(1, 11).map((a)=> new ethers.Contract(offer.target, contract_abi.abi, a));
    var contenders = accounts.slice(11, 16).map((a)=> new ethers.Contract(offer.target, contract_abi.abi, a));
    var observers = accounts.slice(16, 20).map((a)=> new ethers.Contract(offer.target, contract_abi.abi, a));

    try {

      console.info('Create observers...', observers.length);

      await observers.reduce(async (memo, b) => {
        await memo;
        console.info('Creating observer', b.runner.address);
        return await (await o.observer_create(b.runner.address)).wait();
      }, 0);

      console.info('Approve the contract');
      await (await o.approve()).wait();

      {
        var statistics = (await o.voting_statistics()).toObject();
        statistics.total_observers_count.should.be.equal(4n);
        statistics.total_contributors_count.should.be.equal(0n);
        statistics.total_contributors_fund.should.be.equal(0n);

        statistics.voted_observers_percent.should.be.equal(0n);
        statistics.voted_contributors_percent.should.be.equal(0n);
        statistics.voted_contributors_fund_percent.should.be.equal(0n);

        statistics.sorted_observers_leaders.length.should.be.equal(0);
        statistics.sorted_contributors_leaders.length.should.be.equal(0);
        statistics.sorted_contributors_fund_leaders.length.should.be.equal(0);
      }

      var c_amount = 10000000000000000n;
      console.info('Contribute the contract');
      await Promise.all(contributors.map(async (c, i) => {
          return await (await c.runner.sendTransaction({to:o.target, value: c_amount + BigInt(i)})).wait();
      }));

      await o.validate();

      {
        var statistics = (await o.voting_statistics()).toObject();
        statistics.total_observers_count.should.be.equal(4n);
        statistics.total_contributors_count.should.be.equal(10n);
        statistics.total_contributors_fund.should.be.equal(100000000000000045n);

        statistics.voted_observers_percent.should.be.equal(0n);
        statistics.voted_contributors_percent.should.be.equal(0n);
        statistics.voted_contributors_fund_percent.should.be.equal(0n);

        statistics.sorted_observers_leaders.length.should.be.equal(0);
        statistics.sorted_contributors_leaders.length.should.be.equal(0);
        statistics.sorted_contributors_fund_leaders.length.should.be.equal(0);
      }

      // Initial state before voting
      var state = await o.state();
      console.info('State before first vote', state);
      state.should.be.equal(1n);
      var start_offer_balance = await account_owner.provider.getBalance(offer.target);
      console.info('Balance before first vote', start_offer_balance, '[', to$(start_offer_balance), '=', to$(c_amount), ' * 10 ]');
      start_offer_balance.should.be.equal(c_amount * 10n + BigInt(9 * 10 / 2));
      var start_balance_contender = await account_owner.provider.getBalance(contenders[0].runner.address);
      console.debug("Leader contender account before contract success:", start_balance_contender);
      var observer_balances = await Promise.all(observers.map( async (b)=>{
        return b.start_balance = await b.runner.provider.getBalance(b.runner.address);
      }))
      var contributor_balances = await Promise.all(contributors.map( async (c)=>{
        return c.start_balance = await c.runner.provider.getBalance(c.runner.address);
      }))

      observers.map((b) => {
          (async (b) => (await b.origin_observer_status())[0])(b).should.eventually.be.equal(true);
      });
      await o.validate();

      contributors.map((c) => {
        (async (c) => (await c.origin_contributor_status())[0])(c).should.eventually.be.equal(true);
      });
      await o.validate();
      console.log('Bad observers voting');
      await observers.reduce(async (memo, b) => {
          var i;
          [i, memo] = await memo;
          console.log('Observer', b.runner.address, 'votes for', contenders[i].runner.address);
          await o.validate();
          return [i+1, await (await b.observer_vote(contenders[i].runner.address)).wait()];
      }, [0, 0]);
      o.state().should.eventually.be.equal(1n);
      await o.validate();

      {
        var statistics = (await o.voting_statistics()).toObject();
        statistics.total_observers_count.should.be.equal(4n);
        statistics.total_contributors_count.should.be.equal(10n);
        statistics.total_contributors_fund.should.be.equal(100000000000000045n);

        statistics.voted_observers_percent.should.be.equal(10000n);
        statistics.voted_contributors_percent.should.be.equal(0n);
        statistics.voted_contributors_fund_percent.should.be.equal(0n);

        statistics.sorted_observers_leaders.length.should.be.equal(4);
        statistics.sorted_contributors_leaders.length.should.be.equal(0);
        statistics.sorted_contributors_fund_leaders.length.should.be.equal(0);

        var contenders_set = {};
        contenders.forEach((c) => {
          contenders_set[c.runner.address] = true;
        });
        delete contenders_set[contenders[4].runner.address]; // The last contender was not voted
        var observer_leaders_set = {};
        statistics.sorted_observers_leaders.toArray().forEach((c) => {
          observer_leaders_set[as_vote(c[0]).contender] = true;
        });
        console.debug("Observer leaders result", statistics.sorted_observers_leaders);
        console.debug("Observer leaders set", observer_leaders_set);
        console.debug("Contenders set", contenders_set);
        observer_leaders_set.should.be.deep.equal(contenders_set);
      }

      console.log('Bad contributors voting');
      await contributors.reduce(async (memo, c) => {
          var i;
          [i, memo] = await memo;
          console.log('Contributor', c.runner.address, 'votes for', contenders[i % contenders.length].runner.address);
          await o.validate();
          return [i+1, await (await c.contributor_vote(contenders[i % contenders.length].runner.address)).wait()];
      }, [0, 0]);
      o.state().should.eventually.be.equal(1n);
      await o.validate();

      {
        var statistics = (await o.voting_statistics()).toObject();
        statistics.total_observers_count.should.be.equal(4n);
        statistics.total_contributors_count.should.be.equal(10n);
        statistics.total_contributors_fund.should.be.equal(100000000000000045n);

        statistics.voted_observers_percent.should.be.equal(10000n);
        statistics.voted_contributors_percent.should.be.equal(10000n);
        statistics.voted_contributors_fund_percent.should.be.equal(10000n);

        statistics.sorted_observers_leaders.length.should.be.equal(4);
        statistics.sorted_contributors_leaders.length.should.be.equal(5);

        var contenders_set = {};
        contenders.forEach((c) => {
          contenders_set[c.runner.address] = true;
        });
        var contributor_leaders_set = {};
        statistics.sorted_contributors_leaders.forEach((c) => {
          contributor_leaders_set[as_vote(c[0]).contender] = true;
        });
        contributor_leaders_set.should.be.deep.equal(contenders_set);
        var contributor_fund_leaders_set = {};
        statistics.sorted_contributors_fund_leaders.forEach((c) => {
          contributor_fund_leaders_set[as_vote(c[0]).contender] = true;
        });
        contributor_fund_leaders_set.should.be.deep.equal(contenders_set);
      }

      console.log('Fine observers revoting for the leader contender', contenders[0].runner.address);
      await observers.reduce(async (memo, b) => {
          await memo;
          console.log('Observer', b.runner.address, 'votes for', contenders[0].runner.address);
          await o.validate();
          return await (await b.observer_vote(contenders[0].runner.address)).wait();
      }, 0);
      await o.validate();
      o.state().should.eventually.be.equal(1n);

      {
        var statistics = (await o.voting_statistics()).toObject();
        statistics.total_observers_count.should.be.equal(4n);
        statistics.total_contributors_count.should.be.equal(10n);
        statistics.total_contributors_fund.should.be.equal(100000000000000045n);

        statistics.voted_observers_percent.should.be.equal(10000n);
        statistics.voted_contributors_percent.should.be.equal(10000n);
        statistics.voted_contributors_fund_percent.should.be.equal(10000n);

        statistics.sorted_observers_leaders.length.should.be.equal(1);
        as_vote(statistics.sorted_observers_leaders[0][0]).contender.should.be.equal(contenders[0].runner.address);
        statistics.sorted_contributors_leaders.length.should.be.equal(5);
        statistics.sorted_contributors_fund_leaders.length.should.be.equal(5);
      }

      console.log('Fine contributors revoting for the leader contender', contenders[0].runner.address);
      await contributors.reduce(async (memo, c) => {
          await memo;
          console.log('Contributor', c.runner.address, 'votes for', contenders[0].runner.address);
          await o.validate();
          return await (await c.contributor_vote(contenders[0].runner.address)).wait();
      }, 0);
      await o.validate();

      o.state().should.eventually.be.equal(2n);
      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);
      {
        var statistics = (await o.voting_statistics()).toObject();
        statistics.total_observers_count.should.be.equal(4n);
        statistics.total_contributors_count.should.be.equal(10n);
        statistics.voted_observers_percent.should.be.equal(10000n);
        statistics.voted_contributors_percent.should.be.equal(10000n);
        statistics.voted_contributors_fund_percent.should.be.equal(10000n);
        statistics.sorted_observers_leaders.length.should.be.equal(1);
        as_vote(statistics.sorted_observers_leaders[0][0]).contender.should.be.equal(contenders[0].runner.address);
        statistics.sorted_contributors_leaders.length.should.be.equal(1);
        as_vote(statistics.sorted_contributors_leaders[0][0]).contender.should.be.equal(contenders[0].runner.address);
        statistics.sorted_contributors_fund_leaders.length.should.be.equal(1);
        as_vote(statistics.sorted_contributors_fund_leaders[0][0]).contender.should.be.equal(contenders[0].runner.address);
      }
      var end_balance_contender = await account_owner.provider.getBalance(contenders[0].runner.address);
      console.debug("Leader contender account after contract success:", end_balance_contender);
      console.debug("Leader contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
      console.debug("Voting cost:");

      await observers.reduce(async (memo, b) => {
          await memo;
          var diff = b.start_balance - await account_owner.provider.getBalance(b.runner.address);
          console.log('Observer', b.runner.address, diff, to$(diff));
      }, 0);

      await contributors.reduce(async (memo, c) => {
          await memo;
          var diff = c.start_balance - await account_owner.provider.getBalance(c.runner.address);
          console.log('Contributor', c.runner.address, diff, to$(diff));
      }, 0);

    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(extractData(e)));
      }
      throw e;
    }
  });

  it("Test the contributors quorum", async function () {
    console.log("Test the contributors quorum");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 0n,
        "contributors_vote_quorum": 6000n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor3_access.contributor_vote(account_contender.address)).wait();
      console.debug("The first contributor has just voted");
      state = await contender_access.state();
      console.log('State after the first contributors vote', state)
      state.should.be.equal(1n);
      await (await contributor1_access.contributor_vote(account_contender.address)).wait();
      console.debug("The second contributor has just voted");
      state = await contender_access.state();
      console.log('State after second contributors vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the contributors fund quorum", async function () {
    console.log("Test the contributors fund quorum");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 0n,
        "contributors_vote_percent": 0n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 6000n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor3_access.contributor_vote(account_contender.address)).wait();
      console.debug("The most valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after the most valuable contributor vote', state)
      state.should.be.equal(1n);
      await (await contributor1_access.contributor_vote(account_contender.address)).wait();
      console.debug("The least valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after the least valuable contributor vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
  it("Test the observers quorum", async function () {
    console.log("Test the observers quorum");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 0n,
        "contributors_vote_fund_percent": 0n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 6000n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0]; // the first account will be a signer to check an access from the owner
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    // Start deployment, returning a promise that resolves to a contract object
    var offer = await Offer.deploy(test_definition);
    var deployment_tx = offer.deploymentTransaction();
    console.info("Waiting for deployment...");
    var deployment_receipt = await deployment_tx.wait();
    console.debug("Actual deployment gas price:", deployment_receipt.gasUsed, "Real world amount $:", gasTo$(deployment_receipt.gasUsed));
    var owner = await offer.owner();
    console.info("Contract deployed to address:", offer.target);
    console.info("Contract owner is:", owner);
    expect(owner).to.equal(account_owner.address);

    var account_contributor1 = accounts[1]; // the account will be a signer to check an access from the contributor
    var account_contributor2 = accounts[2]; // the account will be a signer to check an access from the contributor
    var account_contributor3 = accounts[3]; // the account will be a signer to check an access from the contributor
    var account_contender = accounts[4]; // the account will be a signer to check an access from the contender
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    // Gettings access from the owner
    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner, // Signer to get access to the contract
    )

    // Getting access from the contributor
    var contributor1_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor1, // Contributor account trying access to the contract
    )
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2, // Contributor account trying access to the contract
    )
    var contributor3_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor3, // Contributor account trying access to the contract
    )

    // Getting access from the contender
    var contender_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contender, // Contender account trying access to the contract
    )
    try {
      // Contributors also will be observers
      await (await o.observer_create(account_contributor1.address)).wait();
      await (await o.observer_create(account_contributor2.address)).wait();
      await (await o.observer_create(account_contributor3.address)).wait();

      // Approve the contract to make it unmutable
      await (await o.approve()).wait();

      // test the contributor created an account sending there enough amount
      await (await account_contributor1.sendTransaction({to:offer.target, value: 10000000000000001n})).wait();
      await (await account_contributor2.sendTransaction({to:offer.target, value: 20000000000000001n})).wait();
      await (await account_contributor3.sendTransaction({to:offer.target, value: 30000000000000003n})).wait();
      (await contributor1_access.origin_contributor_status())[2].should.be.equal(10000000000000001n);
      (await contributor2_access.origin_contributor_status())[2].should.be.equal(20000000000000001n);
      (await contributor3_access.origin_contributor_status())[2].should.be.equal(30000000000000003n);

      // voting process
      var state = await contender_access.state();
      console.log('State before first vote', state);
      state.should.be.equal(1n);

      var start_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account before contract success:", start_balance_contender);
      await (await contributor3_access.contributor_vote(account_contender.address)).wait();
      console.debug("The most valuable contributor has just voted");
      state = await contender_access.state();
      console.log('State after contributors vote', state)
      state.should.be.equal(1n);
      await (await contributor1_access.observer_vote(account_contender.address)).wait();
      console.debug("The first observer has just voted");
      state = await contender_access.state();
      console.log('State after the first observer vote', state)
      state.should.be.equal(1n);
      await (await contributor2_access.observer_vote(account_contender.address)).wait();
      console.debug("The second observer has just voted");
      state = await contender_access.state();
      console.log('State after the second observer vote', state)
      state.should.be.equal(2n);

      var final_balance_offer = await account_owner.provider.getBalance(offer.target);
      console.debug("Offer account after contract completion", final_balance_offer);
      final_balance_offer.should.be.equal(0n);

      var end_balance_contender = await account_contender.provider.getBalance(account_contender.address);
      console.debug("Contender account after contract success:", end_balance_contender);
      console.debug("Contender account diff after contract success ($):", to$(end_balance_contender - start_balance_contender));
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });

  it("Test failed payout rolls completion state back", async function () {
    console.log("Test failed payout rolls completion state back");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 1n,
        "contribution_min_balance": 30000000000000000n,
        "voting_start_balance": 0n,
        "voting_start_count": 0n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0];
    var account_observer = accounts[1];
    var account_contributor = accounts[2];
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    var RejectEtherReceiver = await ethers.getContractFactory("RejectEtherReceiver", account_owner);
    var reject_receiver = await RejectEtherReceiver.deploy();
    await reject_receiver.waitForDeployment();
    var offer = await Offer.deploy(test_definition);
    await offer.waitForDeployment();
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner,
    );
    var observer_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_observer,
    );
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor,
    );

    try {
      await (await o.observer_create(account_observer.address)).wait();
      await (await o.approve()).wait();
      await (await account_contributor.sendTransaction({to:offer.target, value:30000000000000001n})).wait();

      var initial_offer_balance = await account_owner.provider.getBalance(offer.target);
      initial_offer_balance.should.be.equal(30000000000000001n);

      await (await contributor_access.contributor_vote(reject_receiver.target)).wait();
      await (await observer_access.observer_vote(reject_receiver.target)).wait();

      (await o.state()).should.be.equal(1n);
      (await o.completed_at()).should.be.equal(0n);
      expect(await o.winner()).to.equal(ethers.ZeroAddress);

      var final_offer_balance = await account_owner.provider.getBalance(offer.target);
      final_offer_balance.should.be.equal(initial_offer_balance);

      var reject_receiver_balance = await account_owner.provider.getBalance(reject_receiver.target);
      reject_receiver_balance.should.be.equal(0n);

      {
          var events = await o.queryFilter(o.filters.OfferCompleted());
          events.length.should.be.equal(0);
      }
      {
        var events = await o.queryFilter(o.filters.OfferPayoutFailed());
        events.length.should.be.equal(1);
        expect(events[0].args).to.deep.equal([reject_receiver.target, initial_offer_balance]);
      }
      {
          var events = await o.queryFilter(o.filters.ObserverVote());
          events.length.should.be.equal(1);
          expect(events[0].args).to.deep.equal([account_observer.address,reject_receiver.target,false]);
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });

  it("Test voting start thresholds are latched on the crossing transaction", async function () {
    console.log("Test voting start thresholds are latched on the crossing transaction");
    var test_definition = {
        "caption": "Test",
        "description": "Test Description",
        "full_details": "Test Details",
        "contribution_unlock_timeout": 120n,
        "contribution_min_balance": 10000000000000000n,
        "voting_start_balance": 50000000000000000n,
        "voting_start_count": 2n,
        "voting_start_timeout": 3600n,
        "voting_fail_timeout": 3600n,
        "observers_vote_percent": 10000n,
        "contributors_vote_percent": 10000n,
        "contributors_vote_fund_percent": 10000n,
        "contributors_vote_quorum": 0n,
        "contributors_vote_fund_quorum": 0n,
        "observers_vote_quorum": 0n,
    };
    var accounts = await hre.ethers.getSigners();
    var account_owner = accounts[0];
    var account_contributor = accounts[1];
    var account_contributor2 = accounts[2];
    var Offer = await ethers.getContractFactory("Offer", account_owner);
    var offer = await Offer.deploy(test_definition);
    await offer.waitForDeployment();
    var contract_abi = require("../artifacts/contracts/ogoo.sol/Offer.json");

    var o = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_owner,
    );
    var contributor_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor,
    );
    var contributor2_access = new ethers.Contract(
      offer.target,
      contract_abi.abi,
      account_contributor2,
    );

    try {
      (await o.voting_started_at()).should.be.equal(0n);
      await (await o.approve()).wait();
      (await o.voting_started_at()).should.be.equal(0n);

      await (await account_contributor.sendTransaction({to:offer.target, value:20000000000000000n})).wait();
      (await o.voting_started_at()).should.be.equal(0n);

      await (await account_contributor2.sendTransaction({to:offer.target, value:10000000000000000n})).wait();
      (await o.voting_started_at()).should.be.equal(0n);

      var crossing_tx = await account_contributor.sendTransaction({to:offer.target, value:20000000000000000n});
      var crossing_receipt = await crossing_tx.wait();
      var crossing_block = await hre.ethers.provider.getBlock(crossing_receipt.blockNumber);
      var voting_started_at = await o.voting_started_at();
      voting_started_at.should.be.equal(BigInt(crossing_block.timestamp));

      await (await contributor2_access.contribution_cancel()).wait();

      (await o.voting_started_at()).should.be.equal(voting_started_at);

      {
          var contributor1_status = await contributor_access.origin_contributor_status();
          contributor1_status[2].should.be.equal(40000000000000000n);
      }
      {
          var contributor2_status = await contributor2_access.origin_contributor_status();
          contributor2_status[2].should.be.equal(10000000000000000n);
          contributor2_status[3].should.not.be.equal(0n);
      }
      {
          var voting_statistics = await o.voting_statistics();
          voting_statistics[1].should.be.equal(1n);
          voting_statistics[2].should.be.equal(40000000000000000n);
      }
    } catch(e) {
      if( e.data ) {
        console.error("Unexpected revert", o.interface.parseError(e.data));
      }
      throw e;
    }
  });
});

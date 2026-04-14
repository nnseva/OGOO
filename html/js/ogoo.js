$(async function() {
    const createMap = function() {
        // Creates a Map using pairs of the arguments
        var r = new Map();
        for(var i=0; i < arguments.length - 1; i += 2) {
            r.set(arguments[i], arguments[i + 1]);
        }
        return r;
    }

    const WeiSymbol = 'w';

    const CONTRACT_FAILED = 1n << 255n;

    const etherUnits = [
        WeiSymbol,
        'K' + WeiSymbol,
        'M' + WeiSymbol,
        'G' + WeiSymbol,
        'mk' + ethers.EtherSymbol,
        'm' + ethers.EtherSymbol,
        ethers.EtherSymbol,
        'K' + ethers.EtherSymbol,
        'M' + ethers.EtherSymbol,
        'G' + ethers.EtherSymbol,
        'T' + ethers.EtherSymbol,
    ]

    const timeUnits = {
        'sec': 1,
        'min': 60,
        'hours': 60*60,
        'days': 60*60*24,
        'weeks': 60*60*24*7,
    }

    const bigIntSplit = function(amount, digits=3) {
        var len = amount.toString().length;
        var len3 = Math.ceil(len / digits);
        var ret = [];
        var delim = 10n ** BigInt(digits);
        for(var i=0; i < len3; i += 1) {
            ret.push(amount % delim);
            amount = amount / delim;
        }
        if(ret[ret.length - 1] == 0n) {
            ret.pop();
        }
        return ret;
    }

    const bigIntUnsplit = function(split, digits=3) {
        var ret = 0n;
        var delim = 10n ** BigInt(digits);
        for(var i=0; i < split.length; i++) {
            ret += split[i] * (delim ** BigInt(i));
        }
        return ret;
    }

    const bigIntSplitRound = function(splitted, parts=null, digits=3) {
        if(parts == 0)
            return splitted;
        var _splitted = Array.from(splitted);
        if(parts == null) {
            parts = _splitted.length - 1;
        }
        var delim = 10n ** BigInt(digits);
        var i;

        _splitted.push(0n);
        // rounding
        if(_splitted[parts - 1] >= delim / 2n) {
            _splitted[parts] += 1n;
            for(i = parts + 1; i < _splitted.length; i++) {
                if(_splitted[i-1] == delim) {
                    _splitted[i] += 1n;
                    _splitted[i-1] = 0n;
                } else {
                    break;
                }
            }
        }
        if(_splitted.slice(-1)[0] == 0n)
            _splitted.pop();
        for(i=0; i < parts && i < _splitted.length - 1; i += 1) {
            _splitted[i] = 0n;
        }
        return _splitted;
    }

    const bigIntRound = function(amount, digits) {
        return bigIntUnsplit(bigIntSplitRound(bigIntSplit(amount, 1), digits, 1), 1);
    }

    const as_vote = function(voting) {
        // returns a structured vote object from combined voting value
        var failure = voting == CONTRACT_FAILED;
        return {
            contender: ethers.getAddress(ethers.toBeHex(failure ? 0n: voting, 20)),
            failure: failure,
        }
    }

    /*const*/ etherFormatApprox = function(amount, parts=2) {
        var ret = '';
        var i;
        var splitted = bigIntSplit(amount);
        // fillup extra-teraethers
        while(splitted.length > etherUnits.length) {
            splitted[splitted.length - 2] += splitted[splitted.length - 1] * 1000n;
            splitted.splice(-1);
        }
        // round-up lower parts
        if(splitted.length > parts) {
            splitted = bigIntSplitRound(splitted, splitted.length - parts);
        }
        // fillup return value
        for(i = splitted.length - 1; i >= splitted.length - parts && i >= 0; i -= 1) {
            if(splitted[i] > 0n) {
                if(ret.length > 0) {
                    ret += ' ';
                }
                ret += splitted[i].toString() + etherUnits[i];
            }
        }
        return ret;
    };

    const convertToWei = function(value, unit_index=0) {
        var sint, sfrac;
        [sint, sfrac] = value.toString().split('.');
        if(typeof(sfrac) == 'undefined')
            sfrac = '';
        var bint = BigInt(sint + sfrac);

        if(sfrac.length > 0) {
            if(sfrac.length > unit_index * 3) {
                bint = (bigIntRound(bint, sfrac.length - unit_index * 3) / (10n ** BigInt(sfrac.length - unit_index * 3)));
            } else {
                bint = bint * (10n ** BigInt(unit_index * 3 - sfrac.length));
            }
        } else {
            bint = bint * (10n ** BigInt(unit_index * 3 - sfrac.length));
        }
        return bint;
    };

    const convertFromWei = function(value, unit_index=0) {
        var swei = value.toString();
        var sint;
        var sfrac;
        if(swei.length > unit_index * 3) {
            sint = swei.substr(0, swei.length - unit_index * 3);
            sfrac = swei.substr(swei.length - unit_index * 3, swei.length);
        } else {
            sint = '0';
            sfrac = '0'.repeat(unit_index * 3 - swei.length) + swei;
        }
        if( BigInt(sfrac) > 0n ) {
            for(var i = sfrac.length-1; i >= 0; i -= 1) {
                if(sfrac.substr(i, i+1) == '0')
                    sfrac = sfrac.substr(0, i);
                else
                    break;
            }
            return sint + '.' + sfrac;
        }
        return sint;
    };

    const extract_revert_data = function(ex) {
        var data = ex.data;
        if( typeof(data) == 'undefined' ) {
            return 'unknown';
        }
        if( typeof(data) != 'string') {
            return extract_revert_data(data);
        }
        return data;
    };

    const extract_revert_error = function(ex) {
        console.debug('Revert error', ex);
        var data = extract_revert_data(ex);
        if( data == 'unknown' )
            return 'Unknown problem';
        try {
            data = (new ethers.ContractFactory(offer_abi.abi, offer_abi.bytecode)).interface.parseError(data);
        } catch(ex) {
            return 'Unexpected revert, data:' + data;
        }
        return `${data.name}(${data.args.join(', ')})`;
    };

    // Language Support
    let currentLang = 'en'; // Default to English

    // External variable `translations`
    const translateElement = function(element, message) {
        if(typeof(message) == 'string') {
            if($(element).text() != message)
                $(element).text(message);
        } else {
            if(message.text) {
                $(element).text(message.text);
            }
            if(message.html) {
                $(element).html(message.html);
            }
            for(var attr in message) {
                if(attr == 'text' || attr == 'html')
                    continue;
                if($(element).attr(attr) != message[attr])
                    $(element).attr(attr, message[attr]);
            }
        }
        return element;
    };

    const translateTree = function(element) {
        const lang = localStorage.getItem('ogoo_lang');
        $(element).find('[data-t]').each(function() {
            const key = $(this).data('t');
            if (translations[lang] && translations[lang][key]) {
                translateElement(this, translations[lang][key]);
            }
        });
        return element;
    }

    const translateHTML = function(html) {
        var root = $('<div></div>');
        root.html(html);
        translateTree(root[0]);
        return root.html();
    }

    const updateLanguage = function(lang) {
        currentLang = lang;
        $('[data-lang]').removeClass('active');
        $(`[data-lang="${lang}"]`).addClass('active');
        $('#langSelector').html(`<i class="bi bi-translate me-1"></i> ${lang.toUpperCase()}`);
        localStorage.setItem('ogoo_lang', lang);
        translateTree(document);
    };

    // Product Tour Logic
    const startProductTour = function() {
        const tour = introJs();
        const steps = currentLang === 'ru' ? [
            {
                title: 'Добро пожаловать в OGOO!',
                intro: 'Давайте быстро разберем, как работает платформа.'
            },
            {
                element: '#tour-offers',
                intro: 'Здесь вы можете найти список всех доступных предложений или добавить существующий контракт по адресу.'
            },
            {
                element: '#tour-contributions',
                intro: 'Управляйте своими вкладами и создавайте новые инвестиции в фонды влияния.'
            },
            {
                element: '#tour-create-offer',
                intro: 'Нажмите сюда, чтобы запустить собственный фонд и предложить задачу сообществу.'
            },
            {
                element: '#tour-stats-offers',
                intro: 'Ваша личная статистика: сколько офферов вы отслеживаете в данный момент.'
            }
        ] : [
            {
                title: 'Welcome to OGOO!',
                intro: 'Let\'s quickly walk through how the platform works.'
            },
            {
                element: '#tour-offers',
                intro: 'Here you can find a list of all available offers or add an existing contract by address.'
            },
            {
                element: '#tour-contributions',
                intro: 'Manage your contributions and create new investments in impact funds.'
            },
            {
                element: '#tour-create-offer',
                intro: 'Click here to launch your own fund and propose a task to the community.'
            },
            {
                element: '#tour-stats-offers',
                intro: 'Your personal statistics: how many offers you are currently tracking.'
            }
        ];

        tour.setOptions({
            steps: steps,
            showProgress: true,
            showBullets: false,
            nextLabel: currentLang === 'ru' ? 'Далее' : 'Next',
            prevLabel: currentLang === 'ru' ? 'Назад' : 'Prev',
            doneLabel: currentLang === 'ru' ? 'Готово' : 'Done'
        }).start();
    };

    $(document).on('click', '[data-lang]', function(e) {
        e.preventDefault();
        updateLanguage($(this).data('lang'));
    });

    $(document).on('click', '#start-tour', function(e) {
        e.preventDefault();
        startProductTour();
    });

    // Initialize language on load
    const detectLanguage = function() {
        const saved = localStorage.getItem('ogoo_lang');
        if (saved) return saved;
        
        const browserLang = (navigator.language || navigator.userLanguage).toLowerCase();
        if (browserLang.startsWith('ru')) return 'ru';
        
        return 'en'; // Default
    };
    
    updateLanguage(detectLanguage());

    const get_database = async function() {
        return await new Promise(function(resolve, reject) {
            var request = indexedDB.open('ogoo', 1);
            request.onerror = (ex) => {
                console.error('Error open ogoo database', ex);
                bootstrap.Modal.getOrCreateInstance($('#no-database')[0], {
                    keyboard: false,
                }).show();
                if( ex.originalTarget && ex.originalTarget.error) {
                    reject(new Error('Database error', {cause: ex.originalTarget.error}));
                } else {
                    reject(new Error(ex.toString()));
                }
            }
            request.onupgradeneeded = (event) => {
                console.debug('OGOO DB upgrade ' + event.oldVersion + ' -> ' + event.newVersion)
                const db = event.target.result;
                const offers_store = db.createObjectStore("offers", { keyPath: "id" });
            }
            request.onsuccess = (event) => {
                console.debug('OGOO DB opened successfully')
                const db = event.target.result;
                resolve(db);
            }
        });
    };

    const get_offers_list = async function() {
        var offers_list = [];
        var db = await get_database();
        return await new Promise(function (resolve, reject) {
            const objectStore = db.transaction("offers").objectStore("offers");
            objectStore.openCursor().addEventListener("success", (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    console.debug('OGOO DB read offers line', cursor.value)
                    offers_list.push(cursor.value.id);
                    cursor.continue();
                } else {
                    resolve(offers_list);
                }
            });
        });
    };

    const add_offer_to_list = async function(id) {
        var db = await get_database();
        var current_account = await get_current_account_async();
        if( !current_account ) {
            console.error('No current account selected');
            throw new Error('No current account selected', {cause: 'NO_ACCCOUNT'});
        }
        var offer_access = new ethers.Contract(
            id,
            offer_abi.abi,
            current_account
        );
        try {
            var state = await offer_access.state();
        } catch(ex) {
            console.error('Error adding a new offer. Is it a proper Offer contract address?', id, ex);
            throw ex;
        }
        return await new Promise(function(resolve, reject) {
            const objectStore = db.transaction(["offers"], "readwrite").objectStore("offers");
            const request = objectStore.add({id: ethers.getAddress(id)});
            request.onerror = function(ex) {
                console.error('Error inserting offer id into ogoo database', id, ex);
                if( ex.originalTarget && ex.originalTarget.error) {
                    reject(new Error('Database error', {cause: ex.originalTarget.error}));
                } else {
                    reject(new Error(ex.toString(), {cause: ex.toString()}));
                }
            };
            request.onsuccess = function(event) {
                console.debug('Offer added', id);
                resolve(true);
            };
        });
    };

    const delete_offer_from_list = async function(id) {
        var db = await get_database();
        return await new Promise(function(resolve, reject) {
            const objectStore = db.transaction(["offers"], "readwrite").objectStore("offers");
            const request = objectStore.delete(id);
            request.onerror = function(event) {
                console.error('Error deleting offer id from ogoo database', id, event);
                reject(event);
            };
            request.onsuccess = function(event) {
                console.debug('Offer deleted', id);
                resolve(true);
            };
        });
    };

    const bs_selectPane = function(selector) {
        var pane$ = $(selector);
        $(document).find('.tab-pane').add(
            $('[data-bs-toggle="tab"]')
        ).add(
            $(`.nav-item a`)
        ).removeClass('active show');
        var parents$ = pane$.parents('.tab-pane');
        parents$.add(
            pane$
        ).add(
            $(`[data-bs-target="${selector}"][data-bs-toggle="tab"]`)
        ).add(
            $(`li.nav-item.dropdown:has([data-bs-target="${selector}"][data-bs-toggle="tab"]) a.dropdown-toggle`)
        ).addClass('active show');
        //$('[data-bs-toggle="tab"]').removeClass('active show');
        //$(`.nav-item a`).removeClass('active show');
        //$(`[data-bs-target="${selector}"][data-bs-toggle="tab"]`).addClass('active show');
        //$(`li.nav-item.dropdown:has([data-bs-target="${selector}"][data-bs-toggle="tab"]) a.dropdown-toggle`).addClass('active show');
        document.title = pane$.attr('pagetitle');
    }

    var offer_abi;  // loaded dynamically
    var OfferState = [ // enum OfferState
        'INITIAL',
        'APPROVED',
        'COMPLETED',
        'FAILED',
    ];

    if( typeof(ethereum) == 'undefined' ) {
        bootstrap.Modal.getOrCreateInstance($('#no-ethereum')[0], {
            keyboard: false,
        }).show();
        return;
    }

    // get all offers accordingly to the current account
    const get_offer_records_list = async function(current_account) {
        if( !current_account )
            return [];
        return (await Promise.allSettled((await get_offers_list()).map(async id => {
            var offer_record = {};
            offer_record.id = id;
            var offer_access = new ethers.Contract(
                offer_record.id,
                offer_abi.abi,
                current_account
            );
            try {
                [
                    offer_record.owner,
                    offer_record.state,
                    offer_record.definition,
                    offer_record.amount,
                    offer_record.observers,
                    offer_record.origin_contributor_status,
                    offer_record.origin_observer_status,
                ] = await Promise.all([
                    offer_access.owner(),
                    offer_access.state(),
                    offer_access.definition(),
                    provider.getBalance(offer_record.id),
                    offer_access.observers(),
                    offer_access.origin_contributor_status(),
                    offer_access.origin_observer_status(),
                ]);
                offer_record.origin_contributor_status = offer_record.origin_contributor_status.toObject();
                offer_record.origin_observer_status = offer_record.origin_observer_status.toObject();
                offer_record.observers = Object.assign({}, ...offer_record.observers.map((key, index) => ({[key]: key})));
                offer_record.contributor_vote = as_vote(offer_record.origin_contributor_status.contributor_voting);
                offer_record.cancelation_timer = offer_record.origin_contributor_status.contribution_cancelation_timeout;
                offer_record.observer_vote = as_vote(offer_record.origin_observer_status.observer_voting);

                offer_record.contribution = offer_record.origin_contributor_status.contribution_amount;
                offer_record.is_contributor = offer_record.origin_contributor_status.is_contributor;
                offer_record.cancelation = offer_record.origin_contributor_status.canceled_at != 0n;

                offer_record.is_observer = offer_record.origin_observer_status.is_observer;
                offer_record.definition = (offer_record.definition).toObject();
                offer_record.state_name = OfferState[offer_record.state];
                offer_record.is_owner = (offer_record.owner == current_account.address);
            } catch(ex) {
                console.error('Error reading the Offer data. Is it a proper Offer contract address?', offer_record.id, ex);
                throw ex;
            }
            console.debug('Offer read:', offer_record);
            return offer_record;
        }))).filter(result => result.status == 'fulfilled').map(result => result.value);
    };

    const get_current_account_async = async function() {
        var accounts = await provider.listAccounts();
        return accounts[0];
    }

    const fill_offer_lists = async function() {
        var current_account = await get_current_account_async();
        var offer_records = await get_offer_records_list(current_account);
        $('#all-offers-number').text(offer_records.length);
        var contributions = 0;
        var observed = 0;
        var owned = 0;

        var offer_list_container = $('#offers-container');
        offer_list_container.html('');
        var contribution_list_container = $('#contributions-container');
        contribution_list_container.html('');
        var observing_list_container = $('#observing-container');
        observing_list_container.html('');
        var managed_list_container = $('#managed-container');
        managed_list_container.html('');
        offer_records.map(function(offer_record) {
            var offer_list_row = $($('#offer-list-row').text());
            offer_list_row.find('.offer-address').text(offer_record.id);
            offer_list_row.find('.offer-title').text(offer_record.definition.caption);
            var offer_list_row_icon_box = offer_list_row.find('.offer-icon-box');

            if(offer_record.is_owner) {
                owned += 1;
                offer_list_row_icon_box.append($($('#icon-owner').text()));

                var managed_list_row = $($('#managed-list-row').text());
                managed_list_row.find('.offer-address').text(offer_record.id);
                managed_list_row.find('.offer-title').text(offer_record.definition.caption);
                managed_list_row.find('.offer-contribution').text(etherFormatApprox(offer_record.contribution));
                managed_list_row.find('.offer-contribution').attr('title', ethers.formatEther(offer_record.contribution) + ethers.EtherSymbol);
                managed_list_row.find('.offer-balance').text(etherFormatApprox(offer_record.amount));
                managed_list_row.find('.offer-balance').attr('title', ethers.formatEther(offer_record.amount) + ethers.EtherSymbol);
                if(offer_record.state != 0n) {
                    managed_list_row.find('.offer-edit-button').addClass('disabled');
                    managed_list_row.find('.offer-approve-button').addClass('disabled');
                }
                if(offer_record.state > 1n) {
                    managed_list_row.find('.offer-add-contribution-button').addClass('disabled');
                }
                if(offer_record.cancelation) {
                    managed_list_row.find('.offer-add-contribution-button').addClass('disabled');
                }
                var managed_list_row_icon_box = managed_list_row.find('.offer-icon-box');
                managed_list_row_icon_box.append($($('#icon-state-' + offer_record.state_name).text()));
                managed_list_row_icon_box.parent().append($($('#badge-state-' + offer_record.state_name).text()));
                managed_list_container.append(translateTree(managed_list_row));
            }
            if(offer_record.is_contributor) {
                contributions += 1;
                offer_list_row_icon_box.append($($('#icon-contributor').text()));

                var contribution_list_row = $($('#contribution-list-row').text());
                contribution_list_row.find('.offer-address').text(offer_record.id);
                contribution_list_row.find('.offer-title').text(offer_record.definition.caption);
                contribution_list_row.find('.offer-contribution').text(etherFormatApprox(offer_record.contribution));
                contribution_list_row.find('.offer-contribution').attr('title', ethers.formatEther(offer_record.contribution) + ethers.EtherSymbol);
                contribution_list_row.find('.offer-balance').text(etherFormatApprox(offer_record.amount));
                contribution_list_row.find('.offer-balance').attr('title', ethers.formatEther(offer_record.amount) + ethers.EtherSymbol);

                if(offer_record.state > 1n) {
                    contribution_list_row.find('.offer-add-contribution-button').addClass('disabled');
                }
                if(offer_record.state != 1n) {
                    contribution_list_row.find('.contributor-vote-button').addClass('disabled');
                }
                if(offer_record.state == 2n) {
                    contribution_list_row.find('.cancel-contribution-button').addClass('disabled');
                }
                if(offer_record.cancelation) {
                    contribution_list_row.find('.offer-add-contribution-button').addClass('disabled');
                    contribution_list_row.find('.contributor-vote-button').addClass('disabled');
                    var i$ = contribution_list_row.find('.cancel-contribution-icon');
                    i$.removeClass('fa-regular fa-circle-xmark');
                    i$.addClass('fa-regular fa-clock');
                    if(offer_record.cancelation_timer) {
                        i$.addClass('text-danger');
                    } else {
                        i$.addClass('text-success');
                    }
                } else
                if(offer_record.contributor_vote) {
                    var cl = 'text-success';
                    if(offer_record.contributor_vote.failure) {
                        cl = 'text-danger';
                    } else
                    if(offer_record.contributor_vote.contender == '0x' + '0'.repeat(40)) {
                        cl = '';
                    }
                    if( cl ) {
                        contribution_list_row.find('.contributor-vote-button i').addClass(cl);
                    }
                }
                var contribution_list_row_icon_box = contribution_list_row.find('.icon-box');
                contribution_list_row_icon_box.append($($('#icon-state-' + offer_record.state_name).text()));
                contribution_list_row_icon_box.parent().append($($('#badge-state-' + offer_record.state_name).text()));
                contribution_list_container.append(translateTree(contribution_list_row));
            }
            if(offer_record.is_observer) {
                observed += 1;
                offer_list_row_icon_box.append($($('#icon-observer').text()));

                var observing_list_row = $($('#observing-list-row').text());
                observing_list_row.find('.offer-address').text(offer_record.id);
                observing_list_row.find('.offer-title').text(offer_record.definition.caption);
                observing_list_row.find('.offer-contribution').text(etherFormatApprox(offer_record.contribution));
                observing_list_row.find('.offer-contribution').attr('title', ethers.formatEther(offer_record.contribution) + ethers.EtherSymbol);
                if(offer_record.state != 1n) {
                    observing_list_row.find('.observer-vote-button').addClass('disabled');
                }
                if(offer_record.observer_vote) {
                    var cl = 'text-success';
                    if(offer_record.observer_vote.failure) {
                        cl = 'text-danger';
                    } else
                    if(offer_record.observer_vote.contender == '0x' + '0'.repeat(40)) {
                        cl = '';
                    }
                    if( cl ) {
                        observing_list_row.find('.observer-vote-button i').addClass(cl);
                    }
                }
                var observing_list_row_icon_box = observing_list_row.find('.offer-icon-box');
                observing_list_row_icon_box.append($($('#icon-state-' + offer_record.state_name).text()));
                observing_list_row_icon_box.parent().append($($('#badge-state-' + offer_record.state_name).text()));
                observing_list_container.append(translateTree(observing_list_row));
            }
            offer_list_row_icon_box.append('&nbsp;');
            offer_list_row_icon_box.append($($('#icon-state-' + offer_record.state_name).text()));
            offer_list_row_icon_box.parent().append($($('#badge-state-' + offer_record.state_name).text()));
            offer_list_row.find('.offer-contribution').text(etherFormatApprox(offer_record.contribution));
            offer_list_row.find('.offer-contribution').attr('title', ethers.formatEther(offer_record.contribution) + ethers.EtherSymbol);
            offer_list_row.find('.offer-balance').text(etherFormatApprox(offer_record.amount));
            offer_list_row.find('.offer-balance').attr('title', ethers.formatEther(offer_record.amount) + ethers.EtherSymbol);
            offer_list_container.append(translateTree(offer_list_row));
        });
        $('#all-contributions-number').text(contributions);
        $('#all-observed-number').text(observed);
        $('#all-owned-number').text(owned);
        {
            var edit_offer$ = $('#edit-offer');
            if( edit_offer$.find('form').length ) {
                var address = $('#edit-offer').find('form')[0].address;
                if( address ) {
                    on_edit_offer(address);
                }
            }
        }
    };

    address_input_check = async function(id) {
        var input = $(id);
        var form = input.parentsUntil('form').parent();
        var addr = input.val();
        if( !addr || !addr.length ) {
            form.removeClass('was-validated');
            return;
        }
        if( !form.hasClass('was-validated') ) {
            form.addClass('was-validated');
        }
        if( !await ethers.isAddress(addr.toLowerCase()) ) {
            input[0].setCustomValidity('Address invalid');
        } else {
            input[0].setCustomValidity('');
        }
    }

    const durationHuman = function(seconds) {
        if( !seconds )
            return '0';
        var v = luxon.Duration.fromObject({
            seconds: Number(seconds)
        }).shiftTo('seconds', 'minutes', 'hours', 'days', 'weeks');
        var o = v.toObject();
        var v = {};
        for(var k in o) {
            if(o[k])
                v[k] = o[k];
        }
        return luxon.Duration.fromObject(v).toHuman();
    };

    const etherHuman = function(wei) {
        var v = etherFormatApprox(wei, 20);
        if( v.length == 0 )
            v = '0';
        return v;
    };

    const etherExactHuman = function(wei) {
        // returns amount string and unit index
        if( wei == 0n ) {
            return ['0', 6];
        }
        v = bigIntSplit(wei);
        for(var i=0; i < v.length; i++) {
            if( v[i] != 0 ) {
                return [bigIntUnsplit(v.slice(i)).toString(), i];
            }
        }
        return ['error', 0];
    };

    const durationExactHuman = function(seconds) {
        // returns timeout number and unit index
        seconds = Number(seconds);
        if( seconds == 0 )
            return [0, 1];
        var pairs = Object.keys(timeUnits).map((k)=>[k, timeUnits[k]]);
        pairs = pairs.sort((p1, p2)=>p2[1] - p1[1]);
        for(var i in pairs) {
            if( seconds % pairs[i][1] == 0 )
                return [seconds / pairs[i][1], pairs[i][1]];
        }
        return [seconds, 1];
    }

    // synchronize hash back to state
    const onhashchange = async function() {
        var params = new URLSearchParams(document.location.hash.substring(1));
        var selector = `#${params.get('pane')}`;
        if( $(selector).length == 0 )
            return;
        if(selector == '#edit-offer') {
            bs_selectPane(selector);
        } else if(selector.startsWith('#view-offer')) {
            bs_selectPane(selector);
        } else {
            if( params.get('address') ) {
                params.delete('address');  // TODO: cleanup the history
                var new_hash = '#' + params.toString().replaceAll('+', ' ');
                document.location.hash = new_hash;
            } else {
                bs_selectPane(selector);
            }
        }
    };
    $(window).on('hashchange', onhashchange);

    offer_abi = await $.ajax(url='./ogoo.sol/Offer.json');
    var update_accounts = async function() {
        var accounts = await provider.listAccounts();
        if( accounts.length == 0 ) {
            bootstrap.Modal.getOrCreateInstance($('#no-accounts')[0]).show();
        } else {
            var current_account = accounts[0];
            var balance = await provider.getBalance(current_account.address);
            var addr = current_account.address;
            $('.nav-current-account').text(addr.slice(0, 6) + '...' + addr.slice(-4));
            $('.nav-current-account').attr('title', addr);
            var balanceEther = parseFloat(ethers.formatEther(balance));
            $('.nav-current-amount').text(balanceEther.toFixed(4) + ethers.EtherSymbol);
            $('.nav-current-amount').attr('title', ethers.formatEther(balance) + ethers.EtherSymbol);

            await onhashchange();
            await fill_offer_lists();
        }
    };

    // Copy the entire create-offer tab content to have a similar edit-offer tab
    $('#edit-offer').html(translateHTML($('#create-offer').html()));
    // Modify a display options for edit-offer tab
    $('#edit-offer .input-observers-list').parentsUntil('.col').parent().removeClass('d-none');

    // Copy the entire create-offer-submit dialog content to have a similar edit-offer-submit dialog
    $('#edit-offer-submit').html($('#create-offer-submit').html());
    $('#edit-offer-submit .modal-header h1').text('Update Offer');
    $('#edit-offer-submit .offer-submit-header').html(
        'Account <em class="current-account-id account-address"></em> [<em class="current-account-balance"></em>]' +
        'is going to update the Offer contract <em class="offer-address"></em>'
    );
    $('#edit-offer-submit button[type="submit"]').text('Update Offer');
    $('#edit-offer-submit .modal-header h1').attr('data-t', 'edit-offer-submit-modal-head-text');
    $('#edit-offer-submit .offer-submit-header').attr('data-t', 'edit-offer-submit-header-html');
    $('#edit-offer-submit button[type="submit"]').attr('data-t', 'edit-offer-submit-button-text');

    translateTree($('#edit-offer-submit'));

    $('form.needs-validation').on('submit', event => {
        // initiale validation on submit for all forms
        if (!event.target.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
        }
        $(event.target).addClass('was-validated')
    });

    {
        // initiate units selectors for amounts
        var input_amount_unit$ = $('.input-amount-unit');
        input_amount_unit$.empty();
        for(var i in etherUnits) {
            var unit = etherUnits[i];
            var option = `<option title="${unit}" value=${i}>${unit}</option>`;
            var option$ = input_amount_unit$.append(option);
            for(var j=0; j < option$.length; j++) {
                option$[j].index = i;
            }
        }
        for(var i=0; i < input_amount_unit$.length; i++) {
            var hidden$ = $(input_amount_unit$[i]).parent().find('input[type="hidden"]');
            if(hidden$.val())
                $(input_amount_unit$[i]).val(hidden$.val());
            else
                $(input_amount_unit$[i]).val(3);
        }

        input_amount_unit$.on('change', function(event) {
            var old_unit = Number($(event.currentTarget)[0].old_value);
            var new_unit = Number($(event.currentTarget).val());
            var change = old_unit - new_unit;
            var input$ = $(event.currentTarget).parent().find('input.form-control');
            var hidden$ = $(event.currentTarget).parent().find('input[type="hidden"]');
            if( input$.val() ) {
                var wei = convertToWei(input$.val(), old_unit);
                input$.val(convertFromWei(wei, new_unit));
            }
            $(event.currentTarget)[0].old_value = $(event.currentTarget).val();
            hidden$.val($(event.currentTarget).val());
        });
        input_amount_unit$.on('focus', function(event) {
            $(event.currentTarget)[0].old_value = $(event.currentTarget).val();
        });
    }

    {
        // initiate units selectors for timeouts
        var input_timeout_unit$ = $('.input-timeout-unit');
        input_timeout_unit$.empty();
        for(var i in timeUnits) {
            var multiplier = timeUnits[i];
            var option = `<option title="${i}" value=${multiplier}>${i}</option>`;
            var option$ = input_timeout_unit$.append(option);
            for(var j=0; j < option$.length; j++) {
                option$[j].multiplier = multiplier;
            }
        }
        for(var i=0; i < input_timeout_unit$.length; i++) {
            var hidden$ = $(input_timeout_unit$[i]).parent().find('input[type="hidden"]');
            if(hidden$.val())
                $(input_timeout_unit$[i]).val(hidden$.val());
            else
                $(input_timeout_unit$[i]).val(60*60*24);
        }

        input_timeout_unit$.on('change', function(event) {
            var change = Number($(event.currentTarget)[0].old_value) / Number($(event.currentTarget).val());
            var input$ = $(event.currentTarget).parent().find('input.form-control');
            var hidden$ = $(event.currentTarget).parent().find('input[type="hidden"]');
            if( input$.val() ) {
                input$.val(Number(input$.val()) * change);
            }
            $(event.currentTarget)[0].old_value = $(event.currentTarget).val();
            hidden$.val($(event.currentTarget).val());
        });
        input_timeout_unit$.on('focus', function(event) {
            $(event.currentTarget)[0].old_value = $(event.currentTarget).val();
        });
    }

    var renderMarkdownTo = function(target$, source) {
        var md = new remarkable.Remarkable('full', {
            html: true,
            breaks: true,
            typographer: true,
        });
        target$.html(md.render(source || ''));
        renderMathInElement(target$[0], {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    };

    {
        // initiate markdown preview for markdown input
        const _update_md = function(src$) {
            var markdown$ = src$.parentsUntil(':has(".markdown")').parent().find('.markdown');
            renderMarkdownTo(markdown$, src$.val());
        };
        $(document).on('input', '.markdown-source', function(event) {
            _update_md($(event.target));
        });
        $('.markdown-source').map(function(i, element) {
            _update_md($(element));
        });
    }
    $(document).on('click', '.offer-share-button', async function(event) {
        event.preventDefault();
        // All offer share buttons
        var share_dialog = $('#share-offer');
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        share_dialog.find('.share-offer-qr').html('').qrcode(offer_address);
        share_dialog.find('.share-offer-address').html('').text(offer_address);

        bootstrap.Modal.getOrCreateInstance(share_dialog[0]).show();
    });
    $(document).on('click', '.offer-remove-button', async function(event) {
        event.preventDefault();
        var remove_dialog = $('#remove-offer');
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var offer_title = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-title').text();
        remove_dialog.find('.offer-title').html('').text(offer_title);
        remove_dialog.find('.offer-address').html('').text(offer_address);

        bootstrap.Modal.getOrCreateInstance(remove_dialog[0]).show();
    });

    $(document).on('click', '.cancel-contribution-button', async function(event) {
        event.preventDefault();
        var cancel_dialog = $('#cancel-contribution');
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var offer_title = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-title').text();
        cancel_dialog.find('.offer-title').html('').text(offer_title);
        cancel_dialog.find('.offer-address').html('').text(offer_address);

        bootstrap.Modal.getOrCreateInstance(cancel_dialog[0]).show();
    });

    $(document).on('click', 'a:has(".offer-address")', async function(event) {
        event.preventDefault();
        var offer_address = $(event.currentTarget).find('.offer-address').text();
        var hash = document.location.hash;
        var params = new URLSearchParams(hash.substring(1));
        params.set('pane', 'view-offer-main');
        params.set('address', offer_address);
        document.location.hash = '#' + params.toString().replaceAll('+', ' ');
    });

    $('#connect-account-button').on('click', async function(event) {
        // initial connect to the wallet plugin
        $('#connect-account-button').prop('disabled', true);
        try {
            await ethereum.request({method:'eth_requestAccounts'});
        } catch(ex) {
            console.log('Account connection failed:', ex);
            $('#connect-account-button').prop('disabled', false);
            $('#no-accounts .dialog-error').text(ex.message);
            return;
        }
        bootstrap.Modal.getOrCreateInstance($('#no-accounts')[0]).hide();
        $('#no-accounts .dialog-error').text('');
        $('#connect-account-button').prop('disabled', false);
    });

    $(document).on('click', '.offer-edit-button', async function(event) {
        event.preventDefault();
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var hash = document.location.hash;
        var params = new URLSearchParams(hash.substring(1));
        params.set('pane', 'edit-offer');
        params.set('address', offer_address);
        document.location.hash = '#' + params.toString().replaceAll('+', ' ');
    });

    $(document).on('click', '.offer-approve-button', async function(event) {
        event.preventDefault();
        // Offer approval buttons
        var dialogue$ = $('#approve-offer');
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var offer_title = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-title').text();
        dialogue$.find('.offer-address').text(offer_address);
        dialogue$.find('.offer-title').text(offer_title);
        dialogue$.find('.approve-offer-warning').addClass('d-none');
        dialogue$.find('button.pre-approve').removeClass('d-none');
        dialogue$.find('button.approve').addClass('d-none disabled');
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('');
        bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    {
        var timer;
        // Approval dialogue control
        $('#approve-offer button.pre-approve').on('click', async function(event) {
            event.preventDefault();
            var dialogue$ = $('#approve-offer');
            dialogue$.find('.approve-offer-warning').removeClass('d-none');
            dialogue$.find('button.pre-approve').addClass('d-none');
            dialogue$.find('button.approve').removeClass('d-none');
            var timer = setTimeout(async function() {
                if( dialogue$.find('button.approve').is(':visible') ) {
                    dialogue$.find('button.approve').removeClass('disabled');
                }
                timer = undefined;
            }, 3000);
        });
        $('#approve-offer form').on('submit', async function(event) {
            event.preventDefault();
            var dialogue$ = $('#approve-offer');
            var address = dialogue$.find('.offer-address').text();
            var current_account = await get_current_account_async();
            var modal_info$ = dialogue$.find('.modal-footer .modal-info');
            modal_info$.removeClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.addClass('text-info');
            modal_info$.text('Waiting for approve...');
            dialogue$.find('button').prop('disabled', true);
            try {
                var contract = new ethers.Contract(address, offer_abi.abi, current_account);
                var tx = await contract.approve();
                modal_info$.text('Waiting for transaction...');
                await tx.wait();
                modal_info$.text('');
                await update_accounts();
                bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
                dialogue$.find('.approve-offer-warning').addClass('d-none');
                dialogue$.find('button.pre-approve').removeClass('d-none');
                dialogue$.find('button.approve').addClass('d-none disabled');
            } catch(ex) {
                var err = ex.shortMessage;
                console.error('Error approving the contract:', ex);
                if(ex.code == 'ACTION_REJECTED') {
                    err = 'Approve rejected';
                }
                if(ex.code == 'CALL_EXCEPTION') {
                    err = 'Operation rejected: ' + extract_revert_error(ex);
                }
                modal_info$.removeClass('text-info');
                modal_info$.addClass('text-danger');
                modal_info$.removeClass('text-warning');
                modal_info$.text('Error: ' + err);
            }
            dialogue$.find('button').prop('disabled', false);
        });
        $('#approve-offer').on('hidden.bs.modal', async function(event) {
            // additional operations when dismissed
            var dialogue$ = $('#approve-offer');
            dialogue$.find('.approve-offer-warning').addClass('d-none');
            dialogue$.find('button.pre-approve').removeClass('d-none');
            dialogue$.find('button.approve').addClass('d-none disabled');
            if( timer ) {
                clearTimeout(timer);
                timer = undefined;
            }
        });
    }

    {
        // Create contribution dialogue control
        $('#create-contribution form').on('submit', async function(event) {
            event.preventDefault();
            var dialogue$ = $('#create-contribution');
            var address = dialogue$.find('.input-address').val();
            var amount = convertToWei(
                dialogue$.find('.input-amount').val(),
                Number(dialogue$.find('.input-amount ~ select').val())
            );
            var current_account = await get_current_account_async();
            var modal_info$ = dialogue$.find('.modal-footer .modal-info');
            modal_info$.removeClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.addClass('text-info');
            modal_info$.text('Waiting for contributing...');
            dialogue$.find('button').prop('disabled', true);
            try {
                var tx = await current_account.sendTransaction({to:address, value: amount});
                modal_info$.text('Waiting for transaction...');
                await tx.wait();
                modal_info$.text('');
                await update_accounts();
                bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
            } catch(ex) {
                var err = ex.shortMessage;
                console.error('Error contributing to the contract:', ex);
                if(ex.code == 'ACTION_REJECTED') {
                    err = 'Contribution rejected';
                }
                if(ex.code == 'CALL_EXCEPTION') {
                    err = 'Operation rejected: ' + extract_revert_error(ex);
                }
                modal_info$.removeClass('text-info');
                modal_info$.addClass('text-danger');
                modal_info$.removeClass('text-warning');
                modal_info$.text('Error: ' + err);
            }
            dialogue$.find('button').prop('disabled', false);
        });
    }

    {
        // Remove offer dialogue control
        $('#remove-offer form').on('submit', async function(event) {
            event.preventDefault();
            var dialogue$ = $('#remove-offer');

            var offer_address = dialogue$.find('.offer-address').text();
            dialogue$.find('.offer-title').html('');
            dialogue$.find('.offer-address').html('');

            await delete_offer_from_list(offer_address);
            await fill_offer_lists();
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
        });
    }

    {
        // Cancel contribution dialogue control
        $('#cancel-contribution form').on('submit', async function(event) {
            event.preventDefault();
            var dialogue$ = $('#cancel-contribution');
            var address = dialogue$.find('.offer-address').text();
            var current_account = await get_current_account_async();
            var modal_info$ = dialogue$.find('.modal-footer .modal-info');
            modal_info$.removeClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.addClass('text-info');
            modal_info$.text('Waiting for canceling...');
            dialogue$.find('button').prop('disabled', true);
            try {
                var contract = new ethers.Contract(address, offer_abi.abi, current_account);
                var tx = await contract.contribution_cancel();
                modal_info$.text('Waiting for transaction...');
                await tx.wait();
                modal_info$.text('');
                dialogue$.find('.offer-title').html('');
                dialogue$.find('.offer-address').html('');
                await update_accounts();
                bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
            } catch(ex) {
                var err = ex.shortMessage;
                console.error('Error cancelling contribution:', ex);
                if(ex.code == 'ACTION_REJECTED') {
                    err = 'Cancellation rejected';
                }
                if(ex.code == 'CALL_EXCEPTION') {
                    err = 'Operation rejected: ' + extract_revert_error(ex);
                }
                modal_info$.removeClass('text-info');
                modal_info$.addClass('text-danger');
                modal_info$.removeClass('text-warning');
                modal_info$.text('Error: ' + err);
            }
            dialogue$.find('button').prop('disabled', false);
        });
    }

    $(document).on('click', '.offer-add-contribution-button', function(event) {
        // `Plus` sign on the contributions list line
        event.preventDefault();
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').parent().find('.offer-address').text();
        var dialogue$ = $('#create-contribution');
        dialogue$.find('.input-address').val(offer_address);
        bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    $('#create-contribution').on('hidden.bs.modal', function(event) {
        var dialogue$ = $('#create-contribution');
        dialogue$.find('.input-address').prop('readonly', false);
    });
    {
        // main page card buttons
        $('#offers-card-offers-button').on('click', async function(event) {
            event.preventDefault();
            bs_selectPane('#offers-list');
        });
        $('#contributions-card-contributions-button').on('click', async function(event) {
            event.preventDefault();
            bs_selectPane('#contributions-list');
        });
        $('#observing-card-observers-button').on('click', async function(event) {
            event.preventDefault();
            bs_selectPane('#observing-list');
        });
        $('#manage-card-managed-button').on('click', async function(event) {
            event.preventDefault();
            bs_selectPane('#managed-offers-list');
        });
        $('.create-offer-button').on('click', async function(event) {
            event.preventDefault();
            bs_selectPane('#create-offer');
        });
        // Create New Offer on the Managed Offers list
        $('.btn.create-new-offer').on('click', async function(event) {
            event.preventDefault();
            bs_selectPane('#create-offer');
        });
    }
    $('#watch-offer').on('submit', async function(event) {
        // add offer dialogue submit
        event.preventDefault();
        try {
            await add_offer_to_list($('#watch-offer .ether-address-input').val());
        } catch(ex) {
            var err = ex.message;
            if(ex.code == 'BAD_DATA') {
                err = 'No such offer. Is it a proper Offer address?';
            } else {
                if(ex.cause.name == 'ConstraintError') {
                    err = 'The Offer is already in the list'
                } else {
                    err = ex.cause.message;
                }
            }
            $('#watch-offer .dialog-error').text(err);
            return;
        }
        await fill_offer_lists();
        bootstrap.Modal.getOrCreateInstance($('#watch-offer')[0]).hide();
    });
    $('.save-archive-button').on('click', async function (event) {
        // save archive button
        event.preventDefault();
        var offers = await get_offers_list();
        console.log('Save Archive', offers);
        var content = offers.join("\n") + "\n";
        if (window.showSaveFilePicker) {
            // If File System Access API is available
            const opts = {
                types: [{
                    description: 'CSV file',
                    accept: { 'text/csv': ['.csv'] },
                }],
                suggestedName: 'offers.csv'
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
        } else {
            // Fallback: create a download link
            // Prepare CSV content
            let csvContent = "data:text/csv;charset=utf-8," + content;
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "offers.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
    $('.restore-archive-button').on('click', async function (event) {
        // restore archive button
        event.preventDefault();
        var _read_and_add_offers = async function (file) {
            // Read offers from a file
            const text = await file.text();
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
            for (const line of lines) {
                try {
                    await add_offer_to_list(line);
                } catch (ex) {
                    // Ignore duplicates or invalid offers, optionally show error
                    console.warn('Failed to add offer from archive:', line, ex);
                }
            }
            await fill_offer_lists();
        };
        if (window.showOpenFilePicker) {
            // Use the File Picker API if available
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                description: 'CSV file',
                accept: { 'text/csv': ['.csv'] },
                }],
                multiple: false
            });
            const file = await fileHandle.getFile();
            await _read_and_add_offers(file);
        } else {
            // Fallback for browsers without File Picker API
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,text/csv';
            input.style.display = 'none';
            document.body.appendChild(input);

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                await _read_and_add_offers(file);
                document.body.removeChild(input);
            };
            input.click();
        }
    });
    $('.share-archive-button').on('click', async function (event) {
        // share archive button
        event.preventDefault();
        var offers = await get_offers_list();
        console.log('Share Archive', offers);
        var content = offers.join("\n") + "\n";
        if (false && navigator.canShare && navigator.canShare({ text: content })) {
            // Use the Web Share API if available
            // TODO: test on supporting browsers and platforms before release
            try {
                await navigator.share({
                    title: 'Ogoo Offers Archive',
                    text: content,
                    url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(content)
                });
            } catch (err) {
                console.error('Error sharing archive:', err);
                alert('Failed to share archive: ' + err.message);
            }
        } else {
            // Fallback: open share dialog
            const shareDialog = $('#share-archive');
            shareDialog.find('.share-archive-content').val(content);
            bootstrap.Modal.getOrCreateInstance(shareDialog[0]).show();
        }
    });
    $('#create-offer form').on('submit', async function(event) {
        // create offer page submit
        event.preventDefault();
        var form$ = $(event.target);
        if( !event.target.checkValidity() )
            return false;
        var definition = {
            caption: form$.find('.input-caption').val(),
            contribution_min_balance: convertToWei(
                form$.find('.input-contribution-min-balance').val(),
                Number(form$.find('.input-contribution-min-balance ~ select').val())
            ),
            contribution_unlock_timeout: (
                BigInt(form$.find('.input-contribution-unlock-timeout').val() * 10) *
                BigInt(form$.find('.input-contribution-unlock-timeout ~ select').val()) / 10n
            ),
            voting_start_balance: convertToWei(
                form$.find('.input-voting-start-balance').val(),
                Number(form$.find('.input-voting-start-balance ~ select').val())
            ),
            voting_start_count: BigInt(form$.find('.input-voting-start-count').val()),
            voting_start_timeout: (
                BigInt(form$.find('.input-voting-start-timeout').val() * 10) *
                BigInt(form$.find('.input-voting-start-timeout ~ select').val()) / 10n
            ),
            voting_fail_timeout: (
                BigInt(form$.find('.input-voting-fail-timeout').val() * 10) *
                BigInt(form$.find('.input-voting-fail-timeout ~ select').val()) / 10n
            ),
            observers_vote_quorum: (
                BigInt(form$.find('.input-observers-vote-quorum').val() * 100)
            ),
            contributors_vote_quorum: (
                BigInt(form$.find('.input-contributors-vote-quorum').val() * 100)
            ),
            contributors_vote_fund_quorum: (
                BigInt(form$.find('.input-contributors-vote-fund-quorum').val() * 100)
            ),
            observers_vote_percent: (
                BigInt(form$.find('.input-observers-vote-percent').val() * 100)
            ),
            contributors_vote_percent: (
                BigInt(form$.find('.input-contributors-vote-percent').val() * 100)
            ),
            contributors_vote_fund_percent: (
                BigInt(form$.find('.input-contributors-vote-fund-percent').val() * 100)
            ),
            description: form$.find('.input-description').val(),
            full_details: form$.find('.input-full-details').val(),
        };
        console.log('Create Offer Submit', definition);
        var dialogue$ = $('#create-offer-submit');
        var current_account = await get_current_account_async();
        dialogue$.find('form')[0].definition = definition;
        dialogue$.find('form')[0].current_account = current_account;
        var balance = await provider.getBalance(current_account.address);
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
        dialogue$.find('.current-account-id').text(current_account.address);
        dialogue$.find('.current-account-balance').text(etherFormatApprox(balance));

        dialogue$.find('.input-caption').text(definition.caption);
        dialogue$.find('.input-contribution-min-balance').text(etherHuman(definition.contribution_min_balance));
        dialogue$.find('.input-contribution-unlock-timeout').text(durationHuman(definition.contribution_unlock_timeout));
        dialogue$.find('.input-voting-start-balance').text(etherHuman(definition.voting_start_balance));
        dialogue$.find('.input-voting-start-count').text(definition.voting_start_count);
        dialogue$.find('.input-voting-start-timeout').text(durationHuman(definition.voting_start_timeout));
        dialogue$.find('.input-voting-fail-timeout').text(durationHuman(definition.voting_fail_timeout));
        dialogue$.find('.input-observers-vote-quorum').text(Number(definition.observers_vote_quorum) / 100 + '%');
        dialogue$.find('.input-contributors-vote-quorum').text(Number(definition.contributors_vote_quorum) / 100 + '%');
        dialogue$.find('.input-contributors-vote-fund-quorum').text(Number(definition.contributors_vote_fund_quorum) / 100 + '%');
        dialogue$.find('.input-observers-vote-percent').text(Number(definition.observers_vote_percent) / 100 + '%');
        dialogue$.find('.input-contributors-vote-percent').text(Number(definition.contributors_vote_percent) / 100 + '%');
        dialogue$.find('.input-contributors-vote-fund-percent').text(Number(definition.contributors_vote_fund_percent) / 100 + '%');
        renderMarkdownTo(dialogue$.find('.input-description'), definition.description);
        renderMarkdownTo(dialogue$.find('.input-full-details'), definition.full_details);
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('');
    });
    $('#create-offer-submit form').on('submit', async function(event) {
        // create offer dialogue submit
        event.preventDefault();
        var form$ = $(event.target);
        var definition = form$[0].definition;
        var current_account = form$[0].current_account;
        var dialogue$ = form$.parentsUntil('.modal').parent();
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        form$.find('button').prop('disabled', true);
        modal_info$.text('Waiting for deploy...');
        var Offer = new ethers.ContractFactory(offer_abi.abi, offer_abi.bytecode, current_account);
        try {
            var offer = await Offer.deploy(definition);
            modal_info$.text('Waiting for transaction...');
            await offer.waitForDeployment();
            modal_info$.text('');
            console.log('Offer deployed:', offer);
            try {
                await add_offer_to_list(offer.target);
            } catch(ex) {
                console.error('Error adding the offer to the list:', ex);
                var err = ex.message;
                if(ex.code == 'BAD_DATA') {
                    err = 'No such offer. Is it a proper Offer address?';
                } else {
                    if(ex.cause.name == 'ConstraintError') {
                        err = 'The Offer is already in the list'
                    } else {
                        err = ex.cause.message;
                    }
                }
                modal_info$.removeClass('text-info');
                modal_info$.removeClass('text-danger');
                modal_info$.addClass('text-warning');
                modal_info$.text('Error adding the offer to the list: '+ err.toString());
            }
            await update_accounts();
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
            // select the edit offer pane for the just created offer
            var hash = document.location.hash;
            var params = new URLSearchParams(hash.substring(1));
            params.set('pane', 'edit-offer');
            params.set('address', offer.target);
            document.location.hash = '#' + params.toString().replaceAll('+', ' ');
        } catch(ex) {
            var err = ex.shortMessage;
            console.error('Error creating the contract:', ex);
            if(ex.code == 'ACTION_REJECTED') {
                err = 'Creation rejected';
            }
            if(ex.code == 'CALL_EXCEPTION') {
                err = 'Operation rejected: ' + extract_revert_error(ex);
            }
            modal_info$.removeClass('text-info');
            modal_info$.addClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.text('Error: ' + err);
        }
        form$.find('button').prop('disabled', false);
    });
    $('#contributor-vote .failure').on('click', function(event) {
        var disabled = event.currentTarget.ariaPressed == 'true';
        var p = event.currentTarget.parentElement;
        var p_p = p.parentElement;
        var input$ = $(p_p).find('.ether-address-input');
        var camera$ = $(p_p).find('.ether-address-input-button');
        if( disabled ) {
            input$.addClass('d-none');
            input$.prop('required', false);
            input$.val('');
            camera$.addClass('d-none');
            p_p.appendChild(input$[0]);
            p_p.appendChild(camera$[0]);
            event.currentTarget.style.width = '100%';
        } else {
            p.appendChild(input$[0]);
            p.appendChild(event.currentTarget);
            p.appendChild(camera$[0]);
            event.currentTarget.style.width = '';
            input$.prop('required', true);
            input$.removeClass('d-none');
            camera$.removeClass('d-none');
        }
    });
    $('#contributor-vote form').on('submit', async function(event) {
        event.preventDefault();
        var dialogue$ = $('#contributor-vote');
        var form$ = dialogue$.find('form');
        var failure = dialogue$.find('.failure')[0].ariaPressed == 'true';
        var contender = dialogue$.find('.ether-address-input').val();
        var offer_address = dialogue$.find('.offer-address').text();
        var current_account = await get_current_account_async();
        var offer_access = new ethers.Contract(
            offer_address,
            offer_abi.abi,
            current_account
        );
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        form$.find('button').prop('disabled', true);
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('Waiting for update...');
        try {
            modal_info$.text('Waiting for transaction...');
            var tx;
            if( failure ) {
                tx = await offer_access.contributor_vote_failure();
            } else {
                tx = await offer_access.contributor_vote(contender);
            }
            await tx.wait();
            modal_info$.text('');
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
        } catch(ex) {
            console.error('Error voting:', ex);
            var err = ex.shortMessage || ex.message;
            if(ex.code == 'ACTION_REJECTED') {
                err = 'Voting rejected';
            }
            if(ex.code == 'CALL_EXCEPTION') {
                err = 'Operation rejected: ' + extract_revert_error(ex);
            }
            modal_info$.addClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.removeClass('text-info');
            modal_info$.text('Error: ' + err);
        }
        await update_accounts();
        form$.find('button').prop('disabled', false);
    });
    $(document).on('click', '.contributor-vote-button', function(event) {
        event.preventDefault();
        var offer_title = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-title').text();
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var dialogue$ = $('#contributor-vote');
        dialogue$.find('.offer-title').text(offer_title);
        dialogue$.find('.offer-address').text(offer_address);
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    $(document).on('click', '.cancel-contribution-button', function(event) {
        event.preventDefault();
        var offer_title = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-title').text();
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var dialogue$ = $('#cancel-contribution');
        dialogue$.find('.offer-title').text(offer_title);
        dialogue$.find('.offer-address').text(offer_address);
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    $('#observer-vote .failure').on('click', function(event) {
        var disabled = event.currentTarget.ariaPressed == 'true';
        var p = event.currentTarget.parentElement;
        var p_p = p.parentElement;
        var input$ = $(p_p).find('.ether-address-input');
        var camera$ = $(p_p).find('.ether-address-input-button');
        if( disabled ) {
            input$.addClass('d-none');
            input$.prop('required', false);
            input$.val('');
            camera$.addClass('d-none');
            p_p.appendChild(input$[0]);
            p_p.appendChild(camera$[0]);
            event.currentTarget.style.width = '100%';
        } else {
            p.appendChild(input$[0]);
            p.appendChild(event.currentTarget);
            p.appendChild(camera$[0]);
            event.currentTarget.style.width = '';
            input$.prop('required', true);
            input$.removeClass('d-none');
            camera$.removeClass('d-none');
        }
    });
    $('#observer-vote form').on('submit', async function(event) {
        event.preventDefault();
        var dialogue$ = $('#observer-vote');
        var form$ = dialogue$.find('form');
        var failure = dialogue$.find('.failure')[0].ariaPressed == 'true';
        var contender = dialogue$.find('.ether-address-input').val();
        var offer_address = dialogue$.find('.offer-address').text();
        var current_account = await get_current_account_async();
        var offer_access = new ethers.Contract(
            offer_address,
            offer_abi.abi,
            current_account
        );
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        form$.find('button').prop('disabled', true);
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('Waiting for update...');
        try {
            modal_info$.text('Waiting for transaction...');
            var tx;
            if( failure ) {
                tx = await offer_access.observer_vote_failure();
            } else {
                tx = await offer_access.observer_vote(contender);
            }
            await tx.wait();
            modal_info$.text('');
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
        } catch(ex) {
            console.error('Error voting:', ex);
            var err = ex.shortMessage || ex.message;
            if(ex.code == 'ACTION_REJECTED') {
                err = 'Voting rejected';
            }
            if(ex.code == 'CALL_EXCEPTION') {
                err = 'Operation rejected: ' + extract_revert_error(ex);
            }
            modal_info$.addClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.removeClass('text-info');
            modal_info$.text('Error: ' + err);
        }

        await update_accounts();
        form$.find('button').prop('disabled', false);
    });
    $(document).on('click', '.observer-vote-button', function(event) {
        event.preventDefault();
        var offer_title = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-title').text();
        var offer_address = $(event.currentTarget).parentsUntil('.offer-item').find('.offer-address').text();
        var dialogue$ = $('#observer-vote');
        dialogue$.find('.offer-title').text(offer_title);
        dialogue$.find('.offer-address').text(offer_address);
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    const on_edit_offer = async function(address) {
        var current_account = await get_current_account_async();
        var offer_record = {
            id: address
        };

        var offer_access = new ethers.Contract(
            address,
            offer_abi.abi,
            current_account
        );
        try {
            [
                offer_record.owner,
                offer_record.state,
                offer_record.definition,
                offer_record.origin_contributor_status,
                offer_record.amount,
                offer_record.observers,
            ] = await Promise.all([
                offer_access.owner(),
                offer_access.state(),
                offer_access.definition(),
                offer_access.origin_contributor_status(),
                provider.getBalance(offer_record.id),
                offer_access.observers(),
            ]);
            offer_record.origin_contributor_status = offer_record.origin_contributor_status.toObject();
            offer_record.is_contributor = offer_record.origin_contributor_status.is_contributor;
            offer_record.contribution = offer_record.origin_contributor_status.contribution;
            offer_record.observers = Object.assign({}, ...offer_record.observers.map((key, index) => ({[key]: key})));

            offer_record.is_observer = offer_record.observers[current_account.address];
            offer_record.definition = (offer_record.definition).toObject();
            offer_record.state_name = OfferState[offer_record.state];
            offer_record.is_owner = (offer_record.owner == current_account.address);
        } catch(ex) {
            console.error('Error reading the Offer data. Is it a proper Offer contract address?', offer_record.id, ex);
            // TODO: UI message
            return;
        }
        console.debug('Offer read:', offer_record);

        var edit_offer$ = $('#edit-offer');
        edit_offer$.find('form')[0].address = address;

        {
            edit_offer$.find('input.input-caption').val(offer_record.definition.caption);
            var v = etherExactHuman(offer_record.definition.contribution_min_balance);
            edit_offer$.find('input.input-contribution-min-balance').val(v[0]);
            edit_offer$.find('input.input-contribution-min-balance ~ .input-amount-unit').val(v[1]);
            v = durationExactHuman(offer_record.definition.contribution_unlock_timeout);
            edit_offer$.find('input.input-contribution-unlock-timeout').val(v[0]);
            edit_offer$.find('input.input-contribution-unlock-timeout ~ .input-timeout-unit').val(v[1]);
            v = etherExactHuman(offer_record.definition.voting_start_balance)
            edit_offer$.find('input.input-voting-start-balance').val(v[0]);
            edit_offer$.find('input.input-voting-start-balance ~ .input-amount-unit').val(v[1]);
            edit_offer$.find('input.input-voting-start-count').val(offer_record.definition.voting_start_count);
            v = durationExactHuman(offer_record.definition.voting_start_timeout);
            edit_offer$.find('input.input-voting-start-timeout').val(v[0]);
            edit_offer$.find('input.input-voting-start-timeout ~ .input-timeout-unit').val(v[1]);
            v = durationExactHuman(offer_record.definition.voting_fail_timeout);
            edit_offer$.find('input.input-voting-fail-timeout').val(v[0]);
            edit_offer$.find('input.input-voting-fail-timeout ~ .input-timeout-unit').val(v[1]);

            edit_offer$.find('input.input-observers-vote-quorum').val(Number(offer_record.definition.observers_vote_quorum) / 100.);
            edit_offer$.find('input.input-contributors-vote-quorum').val(Number(offer_record.definition.contributors_vote_quorum) / 100.);
            edit_offer$.find('input.input-contributors-vote-fund-quorum').val(Number(offer_record.definition.contributors_vote_fund_quorum) / 100.);

            edit_offer$.find('input.input-observers-vote-percent').val(Number(offer_record.definition.observers_vote_percent) / 100.);
            edit_offer$.find('input.input-contributors-vote-percent').val(Number(offer_record.definition.contributors_vote_percent) / 100.);
            edit_offer$.find('input.input-contributors-vote-fund-percent').val(Number(offer_record.definition.contributors_vote_fund_percent) / 100.);

            edit_offer$.find('textarea.input-description').val(offer_record.definition.description).trigger('input');
            edit_offer$.find('textarea.input-full-details').val(offer_record.definition.full_details).trigger('input');
            edit_offer$.find('.input-observers-list').find('.item').remove();
            for(var k in offer_record.observers) {
                var row$ = $($('#input-observers-list-item').text());
                row$.find('.item-text').text(k);
                edit_offer$.find('.input-observers-list').append(row$);
            }

        }

        edit_offer$.find('form button[type="submit"]').attr('data-t', 'edit-offer-tab-pane-submit');
        if( offer_record.is_owner && offer_record.state < 1n ) {
            var header=$($('#edit-offer-tab-pane-header').text());
            header.find('.offer-address').text(address);
            edit_offer$.find('.tab-pane-header').html(header.html());
            edit_offer$.find('form button[type="submit"]').text('Update Offer');
            edit_offer$.find('form .form-control').prop('readonly', false);
            edit_offer$.find('form .form-select').prop('readonly', false);
            edit_offer$.find('form button[type="submit"]').prop('disabled', false);
            edit_offer$.find('form button[type="submit"]').removeClass('invisible');
            edit_offer$.find('.edit-only').removeClass('d-none');
        } else {
            var header=$($('#view-offer-tab-pane-header').text());
            header.find('.offer-address').text(address);
            edit_offer$.find('.tab-pane-header').html(header.html());
            edit_offer$.find('form button[type="submit"]').text('');
            edit_offer$.find('form .form-control').prop('readonly', true);
            edit_offer$.find('form .form-select').prop('readonly', true);
            edit_offer$.find('form button[type="submit"]').prop('disabled', true);
            edit_offer$.find('form button[type="submit"]').addClass('invisible');
            edit_offer$.find('.edit-only').addClass('d-none');
        }
        translateTree(edit_offer$[0]);
    };

    $('#edit-offer .input-observers-list .list-add').on('click', async function(event) {
        event.preventDefault();
        var dialogue$ = $('#add-observer');
        var form$ = $(event.currentTarget).parentsUntil('form').parent();
        dialogue$.find('form')[0].current_account = await get_current_account_async();
        dialogue$.find('form')[0].address = form$[0].address;
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    $('#add-observer form').on('submit', async function(event) {
        event.preventDefault();
        var dialogue$ = $('#add-observer');
        var form$ = $(event.currentTarget);
        var current_account = form$[0].current_account;
        var address = form$[0].address;
        var observer_address = form$.find('.ether-address-input').val();
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        form$.find('button').prop('disabled', true);
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('Waiting for update...');
        try {
            var contract = new ethers.Contract(address, offer_abi.abi, current_account);
            var tx = await contract.observer_create(observer_address);
            modal_info$.text('Waiting for transaction...');
            await tx.wait();
            modal_info$.text('');
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
        } catch(ex) {
            console.error('Error adding an observer:', ex);
            var err = ex.shortMessage || ex.message;
            if(ex.code == 'BAD_DATA') {
                err = 'No such offer. Is it a proper Offer address?';
            }
            if(ex.code == 'ACTION_REJECTED') {
                err = 'Update rejected';
            }
            if(ex.code == 'CALL_EXCEPTION') {
                err = 'Operation rejected: ' + extract_revert_error(ex);
            }
            modal_info$.addClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.removeClass('text-info');
            modal_info$.text('Error: ' + err);
        }
        await update_accounts();
        form$.find('button').prop('disabled', false);
    });

    $('#remove-observer form').on('submit', async function(event) {
        event.preventDefault();
        var dialogue$ = $('#remove-observer');
        var form$ = $(event.currentTarget);
        var current_account = form$[0].current_account;
        var address = form$[0].address;
        var observer_address = dialogue$.find('.observer-address').text();
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        form$.find('button').prop('disabled', true);
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('Waiting for update...');
        try {
            var contract = new ethers.Contract(address, offer_abi.abi, current_account);
            var tx = await contract.observer_remove(observer_address);
            modal_info$.text('Waiting for transaction...');
            await tx.wait();
            modal_info$.text('');
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
        } catch(ex) {
            console.error('Error removing an observer:', ex);
            var err = ex.shortMessage || ex.message;
            if(ex.code == 'BAD_DATA') {
                err = 'No such offer. Is it a proper Offer address?';
            }
            if(ex.code == 'ACTION_REJECTED') {
                err = 'Update rejected';
            }
            if(ex.code == 'CALL_EXCEPTION') {
                err = 'Operation rejected: ' + extract_revert_error(ex);
            }
            modal_info$.addClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.removeClass('text-info');
            modal_info$.text('Error: ' + err);
        }
        await update_accounts();
        form$.find('button').prop('disabled', false);
    });

    var fill_view_offer = async function() {
        var hash = window.location.hash;
        var params = new URLSearchParams(hash.substring(1));
        var address = params.get('address');
        if( !address ) {
            return;
        }
        var current_account = await get_current_account_async();
        var offer_record = {
            id: address
        };
        var offer_access = new ethers.Contract(
            address,
            offer_abi.abi,
            current_account
        );
        try {
            [
                offer_record.owner,
                offer_record.state,
                offer_record.definition,
                offer_record.amount,
                offer_record.approved_at,
                offer_record.voting_started_at,
                offer_record.completed_at,
                offer_record.failed_at,
                offer_record.voting_statistics,
                offer_record.observers,
                offer_record.winner,
            ] = await Promise.all([
                offer_access.owner(),
                offer_access.state(),
                offer_access.definition(),
                provider.getBalance(offer_record.id),
                offer_access.approved_at(),
                offer_access.voting_started_at(),
                offer_access.completed_at(),
                offer_access.failed_at(),
                offer_access.voting_statistics(),
                offer_access.observers(),
                offer_access.winner(),
            ]);
            offer_record.definition = (offer_record.definition).toObject();
            offer_record.state_name = OfferState[offer_record.state];
            offer_record.voting_statistics = offer_record.voting_statistics.toObject();
            offer_record.observers = Object.assign({}, ...offer_record.observers.map((key, index) => ({[key]: key})));
            offer_record.voting_statistics.sorted_observers_leaders = offer_record.voting_statistics.sorted_observers_leaders.map((item) => {
                var vote = as_vote(item[0]);
                return [(vote.failure ? 'Failure' : vote.contender), item[1]];
            });
            offer_record.voting_statistics.sorted_contributors_leaders = offer_record.voting_statistics.sorted_contributors_leaders.map((item) => {
                var vote = as_vote(item[0]);
                return [(vote.failure ? 'Failure' : vote.contender), item[1]];
            });
            offer_record.voting_statistics.sorted_contributors_fund_leaders = offer_record.voting_statistics.sorted_contributors_fund_leaders.map((item) => {
                var vote = as_vote(item[0]);
                return [(vote.failure ? 'Failure' : vote.contender), item[1]];
            });
        } catch(ex) {
            console.error('Error reading the Offer data. Is it a proper Offer contract address?', offer_record.id, ex);
            // TODO: UI message
            return;
        }
        $('#view-offer .offer-address').text(address);
        $('#view-offer .offer-caption').text(offer_record.definition.caption);
        $('#view-offer .offer-state').text(offer_record.state_name);
        $('#view-offer .offer-winner').text(offer_record.winner);
        if(offer_record.state < 2n) {
            $('#view-offer .offer-winner-table').addClass('d-none');
            $('#view-offer .offer-winner-head').addClass('d-none');
            $('#view-offer .offer-balance-head').removeClass('d-none');
            $('#view-offer .offer-balance-table').removeClass('d-none');
        } else if(offer_record.state == 2n) {
            $('#view-offer .offer-winner-table').removeClass('d-none');
            $('#view-offer .offer-winner-head').removeClass('d-none');
            $('#view-offer .offer-winner-head').text('Winner');
            $('#view-offer .offer-balance-head').addClass('d-none');
            $('#view-offer .offer-balance-table').addClass('d-none');
        } else {
            $('#view-offer .offer-winner-head').removeClass('d-none');
            $('#view-offer .offer-winner-head').text('Failure');
            $('#view-offer .offer-winner-table').addClass('d-none');
            $('#view-offer .offer-balance-head').removeClass('d-none');
            $('#view-offer .offer-balance-table').removeClass('d-none');
        }
        renderMarkdownTo($('#view-offer .offer-description'), offer_record.definition.description);
        renderMarkdownTo($('#view-offer .offer-full-details'), offer_record.definition.full_details);
        $('#view-offer .offer-contribution-min-balance').text(etherHuman(offer_record.definition.contribution_min_balance));
        $('#view-offer .offer-contribution-unlock-timeout').text(durationHuman(offer_record.definition.contribution_unlock_timeout));
        $('#view-offer .offer-voting-start-balance').text(etherHuman(offer_record.definition.voting_start_balance));
        $('#view-offer .offer-voting-start-count').text(offer_record.definition.voting_start_count);
        $('#view-offer .offer-voting-start-timeout').text(durationHuman(offer_record.definition.voting_start_timeout));
        $('#view-offer .offer-voting-fail-timeout').text(durationHuman(offer_record.definition.voting_fail_timeout));
        $('#view-offer .offer-observers-vote-quorum').text(Number(offer_record.definition.observers_vote_quorum) / 100 + '%');
        $('#view-offer .offer-contributors-vote-quorum').text(Number(offer_record.definition.contributors_vote_quorum) / 100 + '%');
        $('#view-offer .offer-contributors-vote-fund-quorum').text(Number(offer_record.definition.contributors_vote_fund_quorum) / 100 + '%');
        $('#view-offer .offer-observers-vote-percent').text(Number(offer_record.definition.observers_vote_percent) / 100 + '%');
        $('#view-offer .offer-contributors-vote-percent').text(Number(offer_record.definition.contributors_vote_percent) / 100 + '%');
        $('#view-offer .offer-contributors-vote-fund-percent').text(Number(offer_record.definition.contributors_vote_fund_percent) / 100 + '%');
        $('#view-offer .offer-state-icon').html(translateTree(
            $($('#icon-state-' + offer_record.state_name).text())
        ));
        $('#view-offer .offer-balance').text(etherHuman(offer_record.amount));
        $('#view-offer .offer-approved-at-row').addClass('d-none');
        $('#view-offer .offer-voting-started-at-row').addClass('d-none');
        $('#view-offer .offer-completed-at-row').addClass('d-none');
        $('#view-offer .offer-failed-at-row').addClass('d-none');
        if(offer_record.state > 0n) {
            $('#view-offer .offer-approved-at-row').removeClass('d-none');
        }
        if(offer_record.voting_started_at > 0n) {
            $('#view-offer .offer-voting-started-at-row').removeClass('d-none');
        }
        if(offer_record.state == 2n) {
            $('#view-offer .offer-completed-at-row').removeClass('d-none');
        } else if(offer_record.state == 3n) {
            $('#view-offer .offer-failed-at-row').removeClass('d-none');
        }
        var current_lang = localStorage.getItem('ogoo_lang') || 'en';
        $('#view-offer .offer-approved-at').text(offer_record.approved_at ? new Date(Number(offer_record.approved_at) * 1000).toLocaleString(current_lang) : '-');
        $('#view-offer .offer-voting-started-at').text(offer_record.voting_started_at ? new Date(Number(offer_record.voting_started_at) * 1000).toLocaleString(current_lang) : '-');
        $('#view-offer .offer-completed-at').text(offer_record.completed_at ? new Date(Number(offer_record.completed_at) * 1000).toLocaleString(current_lang) : '-');
        $('#view-offer .offer-failed-at').text(offer_record.failed_at ? new Date(Number(offer_record.failed_at) * 1000).toLocaleString(current_lang) : '-');
        $('#view-offer .offer-total-observers-count').text(
            offer_record.voting_statistics.total_observers_count
        );
        $('#view-offer .offer-total-contributors-count').text(
            offer_record.voting_statistics.total_contributors_count
        );
        $('#view-offer .offer-total-contributors-fund').text(
            etherHuman(offer_record.voting_statistics.total_contributors_fund)
        );
        $('#view-offer .offer-observer-contenders-count').text(
            offer_record.voting_statistics.sorted_observers_leaders.length
        );
        $('#view-offer .offer-contributor-contenders-count').text(
            offer_record.voting_statistics.sorted_contributors_leaders.length
        );
        var contenders_set = Object.assign({}, ...offer_record.voting_statistics.sorted_contributors_leaders.map(([k, p], index) => ({[k]: k})));
        contenders_set = Object.assign(contenders_set, ...offer_record.voting_statistics.sorted_observers_leaders.map(([k, p], index) => ({[k]: k})));
        var contenders_list = Object.keys(contenders_set);
        $('#view-offer .offer-contenders-count').text(
            contenders_list.length
        );
        $('#view-offer .offer-observers-list').text('');
        for(var k in offer_record.observers) {
            var row$ = $($('#view-observers-list-item').text());
            row$.find('.item-text').text(k);
            $('#view-offer .offer-observers-list').append(row$);
        }
        $('#view-offer .offer-observers-contenders-list').text('');
        offer_record.voting_statistics.sorted_observers_leaders.map(([k, p]) => {
            var row$ = $($('#offer-contenders-list-item').text());
            row$.find('.item-text').text(k);
            row$.find('.item-percent').text(Number(p * 10000n / offer_record.voting_statistics.total_observers_count)/100);
            $('#view-offer .offer-observers-contenders-list').append(row$);
            console.log('Observer contender:', k, p);
        });
        $('#view-offer .offer-contributors-contenders-list').text('');
        offer_record.voting_statistics.sorted_contributors_leaders.map(([k, p]) => {
            var row$ = $($('#offer-contenders-list-item').text());
            row$.find('.item-text').text(k);
            row$.find('.item-percent').text(Number(p * 10000n / offer_record.voting_statistics.total_contributors_count)/100);
            $('#view-offer .offer-contributors-contenders-list').append(row$);
            console.log('Contributor contender:', k, p);
        });
        $('#view-offer .offer-contributors-fund-contenders-list').text('');
        offer_record.voting_statistics.sorted_contributors_fund_leaders.map(([k, p]) => {
            var row$ = $($('#offer-contenders-list-item').text());
            row$.find('.item-text').text(k);
            row$.find('.item-percent').text(Number(p * 10000n / offer_record.voting_statistics.total_contributors_fund)/100);
            $('#view-offer .offer-contributors-fund-contenders-list').append(row$);
            console.log('Contributor fund contender:', k, p);
        });
    };

    $('#view-offer').on('visible', async function(event) {
        if(event.target == $('#view-offer')[0] ) {
            await fill_view_offer();
        }
    });

    $('#edit-offer').on('visible', async function(event) {
        if(event.target == $('#edit-offer')[0] ) {
            var params = new URLSearchParams(document.location.hash.substring(1));
            var address = params.get('address');
            if( address.length > 0 )
                await on_edit_offer(address);
        }
    });

    $('#user-guide').on('visible', async function(event) {
        if(event.target == $('#user-guide')[0]) {
            var lang = localStorage.getItem('ogoo_lang');
            var content = await $.ajax(url='./USER-GUIDE.' + lang + '.md');
            var target$ = $('#user-guide .content');
            renderMarkdownTo(target$, content);
        }
    });

    $('#edit-offer form').on('submit', async function(event) {
        // edit offer page submit
        event.preventDefault();
        var form$ = $(event.target);
        if( !event.target.checkValidity() )
            return false;
        var definition = {
            caption: form$.find('.input-caption').val(),
            contribution_min_balance: convertToWei(
                form$.find('.input-contribution-min-balance').val(),
                Number(form$.find('.input-contribution-min-balance ~ select').val())
            ),
            contribution_unlock_timeout: (
                BigInt(form$.find('.input-contribution-unlock-timeout').val() * 10) *
                BigInt(form$.find('.input-contribution-unlock-timeout ~ select').val()) / 10n
            ),
            voting_start_balance: convertToWei(
                form$.find('.input-voting-start-balance').val(),
                Number(form$.find('.input-voting-start-balance ~ select').val())
            ),
            voting_start_count: BigInt(form$.find('.input-voting-start-count').val()),
            voting_start_timeout: (
                BigInt(form$.find('.input-voting-start-timeout').val() * 10) *
                BigInt(form$.find('.input-voting-start-timeout ~ select').val()) / 10n
            ),
            voting_fail_timeout: (
                BigInt(form$.find('.input-voting-fail-timeout').val() * 10) *
                BigInt(form$.find('.input-voting-fail-timeout ~ select').val()) / 10n
            ),
            observers_vote_quorum: (
                BigInt(form$.find('.input-observers-vote-quorum').val() * 100)
            ),
            contributors_vote_quorum: (
                BigInt(form$.find('.input-contributors-vote-quorum').val() * 100)
            ),
            contributors_vote_fund_quorum: (
                BigInt(form$.find('.input-contributors-vote-fund-quorum').val() * 100)
            ),
            observers_vote_percent: (
                BigInt(form$.find('.input-observers-vote-percent').val() * 100)
            ),
            contributors_vote_percent: (
                BigInt(form$.find('.input-contributors-vote-percent').val() * 100)
            ),
            contributors_vote_fund_percent: (
                BigInt(form$.find('.input-contributors-vote-fund-percent').val() * 100)
            ),
            description: form$.find('.input-description').val(),
            full_details: form$.find('.input-full-details').val(),
        };
        console.log('Update Offer Submit', definition);
        var dialogue$ = $('#edit-offer-submit');
        var current_account = await get_current_account_async();
        dialogue$.find('form')[0].definition = definition;
        dialogue$.find('form')[0].current_account = current_account;
        dialogue$.find('form')[0].address = form$[0].address;
        var balance = await provider.getBalance(current_account.address);
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
        dialogue$.find('.current-account-id').text(current_account.address);
        dialogue$.find('.current-account-balance').text(etherFormatApprox(balance));
        dialogue$.find('.offer-address').text(form$[0].address);

        dialogue$.find('.input-caption').text(definition.caption);
        dialogue$.find('.input-contribution-min-balance').text(etherHuman(definition.contribution_min_balance));
        dialogue$.find('.input-contribution-unlock-timeout').text(durationHuman(definition.contribution_unlock_timeout));
        dialogue$.find('.input-voting-start-balance').text(etherHuman(definition.voting_start_balance));
        dialogue$.find('.input-voting-start-count').text(definition.voting_start_count);
        dialogue$.find('.input-voting-start-timeout').text(durationHuman(definition.voting_start_timeout));
        dialogue$.find('.input-voting-fail-timeout').text(durationHuman(definition.voting_fail_timeout));
        dialogue$.find('.input-observers-vote-quorum').text(Number(definition.observers_vote_quorum) / 100 + '%');
        dialogue$.find('.input-contributors-vote-quorum').text(Number(definition.contributors_vote_quorum) / 100 + '%');
        dialogue$.find('.input-contributors-vote-fund-quorum').text(Number(definition.contributors_vote_fund_quorum) / 100 + '%');
        dialogue$.find('.input-observers-vote-percent').text(Number(definition.observers_vote_percent) / 100 + '%');
        dialogue$.find('.input-contributors-vote-percent').text(Number(definition.contributors_vote_percent) / 100 + '%');
        dialogue$.find('.input-contributors-vote-fund-percent').text(Number(definition.contributors_vote_fund_percent) / 100 + '%');
        renderMarkdownTo(dialogue$.find('.input-description'), definition.description);
        renderMarkdownTo(dialogue$.find('.input-full-details'), definition.full_details);
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('');
    });

    $(document).on('click', '.input-observers-list .list-remove', async function(event) {
        var item$ = $(event.currentTarget).parentsUntil('.item').parent();
        if( item$.length == 0 )
            item$ = $(event.currentTarget).parent();
        var observer_address = item$.find('.item-text').text();
        var dialogue$ = $('#remove-observer');
        var form$ = $(event.currentTarget).parentsUntil('form').parent();
        dialogue$.find('form')[0].current_account = await get_current_account_async();
        dialogue$.find('form')[0].address = form$[0].address;
        dialogue$.find('form')[0].observer_address = observer_address;
        dialogue$.find('.observer-address').text(observer_address);
        var dialogue = bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
    });

    $('#edit-offer-submit form').on('submit', async function(event) {
        // edit offer dialog submit
        event.preventDefault();
        var form$ = $(event.target);
        var definition = form$[0].definition;
        var current_account = form$[0].current_account;
        var address = form$[0].address;
        var dialogue$ = form$.parentsUntil('.modal').parent();
        var modal_info$ = dialogue$.find('.modal-footer .modal-info');
        form$.find('button').prop('disabled', true);
        modal_info$.removeClass('text-danger');
        modal_info$.removeClass('text-warning');
        modal_info$.addClass('text-info');
        modal_info$.text('Waiting for update...');
        try {
            var contract = new ethers.Contract(address, offer_abi.abi, current_account);
            var tx = await contract.definition_update(definition);
            modal_info$.text('Waiting for transaction...');
            await tx.wait();
            modal_info$.text('');
            console.log('Offer updated:', address, definition);
            await fill_offer_lists();
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
        } catch(ex) {
            console.error('Error updating the offer:', ex);
            var err = ex.shortMessage || ex.message;
            if(ex.code == 'BAD_DATA') {
                err = 'No such offer. Is it a proper Offer address?';
            }
            if(ex.code == 'ACTION_REJECTED') {
                err = 'Update rejected';
            }
            if(ex.code == 'CALL_EXCEPTION') {
                err = 'Operation rejected: ' + extract_revert_error(ex);
            }
            modal_info$.addClass('text-danger');
            modal_info$.removeClass('text-warning');
            modal_info$.removeClass('text-info');
            modal_info$.text('Error: ' + err);
        }
        await update_accounts();
        form$.find('button').prop('disabled', false);
    });

    scanner_init = function(dialogue_selector, button_selector, input_selector) {
        // The function will init a scanner for any input `input_selector`
        // and a button `button_selector` near to the input, in the
        // same subtree.
        // Pressing the button opens a dialogue `dialogue_selector` which
        // has a `video` element to initialize the scanner

        var dialogue$ = $(dialogue_selector);

        dialogue$.on('visible', async function(event) {
            if( !$(event.target).is(dialogue_selector) ) {
                return;
            }
            dialogue$.find('video').addClass('d-none');
            if( dialogue$.find('.video-absent').length == 0 ) {
                dialogue$.find('video').parent().append('<p class="video-absent bg-warning"></p>');
            }
            // try to init camera, show error if it's not found
            if( !await QrScanner.hasCamera() ) {
                dialogue$.find('.video-absent').text('Camera not found, use text input instead');
                dialogue$.find('.video-absent').removeClass('d-none');
            } else {
                dialogue$.find('.video-absent').addClass('d-none');
                dialogue$.find('.video-absent').text('');
                dialogue$.find('video').removeClass('d-none');
                dialogue$[0].scanner = new QrScanner(dialogue$.find('video')[0], async function(result) {
                    dialogue$[0].input$.val(result.data);
                    await address_input_check(dialogue$[0].input$);
                    await dialogue$[0].scanner.stop();
                    dialogue$[0].scanner.destroy()
                    delete dialogue$[0].scanner;
                    dialogue$.find('video').addClass('d-none');
                    bootstrap.Modal.getOrCreateInstance(dialogue$[0]).hide();
                }, {
                    highlightScanRegion:true,
                    highlightCodeOutline: true,
                    returnDetailedScanResult: true
                });
                try {
                    await dialogue$[0].scanner.start();
                } catch(ex) {
                    console.error('Scanner can not be started', ex);
                    dialogue$.find('.video-absent').text('Scanner can not be started, use text input instead');
                    dialogue$.find('.video-absent').removeClass('d-none');
                    dialogue$.find('video').addClass('d-none');
                }
            }
        });
        dialogue$.on('invisible', async function(event) {
            if( !$(event.target).is(dialogue_selector) ) {
                // prevent bubble upped events
                return;
            }
            // try to stop camera, if present
            if( typeof(dialogue$[0].scanner) != 'undefined' ) {
                try {
                    await dialogue$[0].scanner.stop();
                } catch(ex) {
                    logger.warning('Error ignored', ex);
                }
            }
            if( dialogue$[0].parent_dialogue$ && dialogue$[0].parent_dialogue$.length ) {
                bootstrap.Modal.getOrCreateInstance(dialogue$[0].parent_dialogue$[0]).show();
            }
        });
        $(document).on('click', button_selector, function(event) {
            // find an input
            event.preventDefault();
            var parent$ = $(event.currentTarget).parent();
            if( !parent$.has(input_selector).length )
                parent$ = $(event.currentTarget).parentsUntil(`:has(${input_selector})`).parent();
            if( !parent$.length ) {
                console.error(`Common parent for ${input_selector} not found`);
                return;
            }
            var input$ = parent$.find(input_selector);
            if( !input$.length ) {
                console.error(`${input_selector} not found`);
                return;
            }
            dialogue$[0].input$ = input$;
            var parent_dialogue$ = parent$.parents('.modal');
            if( parent_dialogue$.length ) {
                bootstrap.Modal.getOrCreateInstance(parent_dialogue$[0]).hide();
            }
            dialogue$[0].parent_dialogue$ = parent_dialogue$;
            bootstrap.Modal.getOrCreateInstance(dialogue$[0]).show();
        });
        QrScanner.hasCamera().then((has)=>{
            if( !has ) {
                // No camera - the button is disabled
                $(button_selector).prop('disabled', true);
            }
        })
    }

    scanner_init('#ether-address-input', '.ether-address-input-button', '.ether-address-input');

    {
        // selected pane to hash synchronization
        var panes$ = $('.tab-pane');
        for(var ip=0; ip < panes$.length; ip++) {
            $(panes$[ip]).on('visible', async function(event) {
                var pane$ = $(event.target);
                if( pane$.is('.tab-pane') ) {
                    if( pane$.find('.tab-pane').length )
                        return; // ignore pane with subpanes - they are processed separately
                    var hash = document.location.hash;
                    var params = new URLSearchParams(hash.substring(1));
                    params.set('pane', pane$.attr('id'));
                    var new_hash = '#' + params.toString().replaceAll('+', ' ');
                    if( hash != new_hash ) {
                        document.location.hash = new_hash;
                    }
                }
            });
        }
    }
    {
        var hash = document.location.hash;
        var params = new URLSearchParams(hash.substring(1));
        if( params.get('pane') ) {
            onhashchange();
        } else {
            params.set('pane', 'application-page');
            var new_hash = '#' + params.toString().replaceAll('+', ' ');
            document.location.hash = new_hash;
        }
    }
    {
        // initialize visibility mutation events
        new MutationObserver(async function(events) {
            events.map(async function(event) {
                if( typeof(event.target._visible) == 'undefined' ) {
                    event.target._visible = null;
                }
                if( $(event.target).is(':visible') == true ) {
                    if( event.target._visible != true ) {
                        event.target._visible = true;
                        $(event.target).trigger({
                            type: 'visible',
                            originalEvent: event,
                        });
                    }
                } else {
                    if( event.target._visible != false ) {
                        event.target._visible = false;
                        $(event.target).trigger({
                            type: 'invisible',
                            originalEvent: event,
                        });
                    }
                }
            });
        }).observe(document,{subtree: true, attributeFilter:['class', 'style']});
    }

    const on_change_wallet = async function(option$) {
        var form$ = $('[role="wallets"]');
        var button$ = form$.find('[data-bs-toggle="dropdown"]');
        ethereum = option$[0].ethereum;
        provider = new ethers.BrowserProvider(ethereum, 'any');
        button$[0].current = option$[0].rdns;
        button$.html(`<img src="${option$[0].icon}" height="20pt"> ${option$[0].name}`);
        form$.find('a.dropdown-item').removeClass('active');
        option$.find('a').addClass('active');
        await update_accounts();
    };

    var wallets = {};

    window.addEventListener(
        "eip6963:announceProvider",
        async (event) => {
            console.debug('Wallet announce', event);
            //ethereum = event.detail.provider;
            //event.detail.info.uuid;
            //event.detail.info.name;
            //event.detail.info.rdns;
            //event.detail.info.icon; // URL
            var provider = new ethers.BrowserProvider(event.detail.provider, 'any');
            var accounts = await provider.listAccounts();
            var account_address =   '-- no current account --';
            var account_balance_s = '------ no balance ------';
            if( accounts.length > 0 ) {
                account_address = accounts[0].address;
                var balance = await provider.getBalance(account_address);
                account_balance_s = ethers.formatEther(balance) + ethers.EtherSymbol;
            }
            var form$ = $('[role="wallets"]');
            var option$ = $(`
                <li rdns="${event.detail.info.rdns}">
                    <a class="dropdown-item" href="#" title="${account_address}">
                        <img src="${event.detail.info.icon}" height="20p"></img> ${event.detail.info.name}
                        <p class="text-little">
                        <em>${account_balance_s}</em>
                        </p>
                    </a>
                </li>
            `);

            option$[0].uuid = event.detail.info.uuid;
            option$[0].icon = event.detail.info.icon;
            option$[0].name = event.detail.info.name;
            option$[0].rdns = event.detail.info.rdns;
            option$[0].ethereum = event.detail.provider;
            option$[0].account_address = account_address;
            option$[0].account_balance_s = account_balance_s;
            form$.find('.dropdown-menu').append(option$);
            var button$ = form$.find('[data-bs-toggle="dropdown"]');
            if( !button$[0].current || event.detail.info.rdns == button$[0].current ) {
                await on_change_wallet(option$);
            }
            if(!wallets[event.detail.info.rdns]) {
                wallets[event.detail.info.rdns] = {
                    ...event.detail.info,
                    ethereum: event.detail.provider,
                }
                // wallet change state tracking - setup only once
                event.detail.provider.on('connect', async function() {
                    console.debug("Wallet connect", arguments);
                    await update_accounts();
                });
                event.detail.provider.on('disconnect', async function() {
                    console.debug("Wallet disconnect", arguments);
                    await update_accounts();
                });
                event.detail.provider.on('accountsChanged', async function() {
                    console.debug("Wallet accounts list changed", arguments);
                    await refill_wallets();
                    await update_accounts();
                });
                event.detail.provider.on('chainChanged', async function() {
                    console.debug("Wallet chain connection changed", arguments);
                    await refill_wallets();
                    await update_accounts();
                });
            }
        }
    );
    const refill_wallets = async function() {
        var form$ = $('[role="wallets"]');
        form$.find('.dropdown-menu').html('');
        console.debug('Request providers');
        window.dispatchEvent(new Event("eip6963:requestProvider"));
    };
    refill_wallets();
    $(document).on('click', '[role="wallets"] a.dropdown-item', async function(event) {
        event.preventDefault();
        var option$ = $(event.currentTarget).parent();
        await on_change_wallet(option$);
    });
});

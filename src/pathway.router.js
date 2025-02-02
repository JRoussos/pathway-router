/**
 * @typedef CacheState
 *
 * @property {string} title
 * @property {string} url
 * @property {HTMLElement} content
 */

/**
 * @typedef HistoryState
 *
 * @property {string} title
 * @property {string} url
 * @property {Record|null} state
 */

/**
 * @callback OnLoadingChangeCallback
 *
 * @param {Pathway} router
 * @param {boolean} state
 */

/**
 * @callback OnNavigateCallback
 *
 * @param {Pathway} router
 * @param {string} url
 */

/**
 * @callback OnBeforeLeaveCallback
 *
 * @param {Pathway} router
 */

/**
 * @callback OnBeforeRenderCallback
 *
 * @param {Pathway} router
 */

/**
 * @callback OnAfterRenderCallback
 *
 * @param {Pathway} router
 */

/**
 * @callback OnErrorCallback
 *
 * @param {Pathway} router
 * @param {ErrorEvent} error
 */

/**
 * @typedef PathwayOptions
 *
 * @property {string} [containerSelector    ]
 * @property {string} [preloadLinkSelector  ]
 * @property {string} [excludeLinkSelector  ]
 *
 * @property {number} [historyStackSize     ]
 * @property {number} [cacheCapacity        ]
 * @property {number} [transitionDuration   ]
 *
 * @property {boolean} [updateRouterHistory ]
 * @property {boolean} [popstateEvent       ]
 * @property {boolean} [clickEvent          ]
 * @property {boolean} [mutationObserver    ]
 *
 * @property {OnNavigateCallback     } [onNavigate      ]
 * @property {OnLoadingChangeCallback} [onLoadingChange ]
 * @property {OnBeforeLeaveCallback  } [onBeforeLeave   ]
 * @property {OnBeforeRenderCallback } [onBeforeRender  ]
 * @property {OnAfterRenderCallback  } [onAfterRender   ]
 * @property {OnErrorCallback        } [onError         ]
 *
 */

"use strict";

/**
 *
 * @param {PathwayOptions} params
 */
function Pathway(params) {
    this.options = /** @type {PathwayOptions} */ {
        containerSelector:   'body',
        preloadLinkSelector: '[data-preload-link]',
        excludeLinkSelector: '[data-exclude-link]',
        cacheCapacity:       10,
        historyStackSize:    10,
        transitionDuration:  0,
        updateRouterHistory: true,
        popstateEvent:       true,
        clickEvent:          true,
        mutationObserver:    true,
        onNavigate:          function () {},
        onLoadingChange:     function () {},
        onBeforeLeave:       function () {},
        onBeforeRender:      function () {},
        onAfterRender:       function () {},
        onError:             function () {},
    }

    Object.assign(this.options, params)

    this.history = /** @type {HistoryState[]}*/ []
    this.cache   = /** @type {Map<string,CacheState>} */ new Map()

    this.isLoading = /** @type {Boolean} */ false
    this.container = /** @type {HTMLElement} */ document.querySelector(this.options.containerSelector) || document.body

    this.mutation  = /** @type {{observer: MutationObserver|null}}*/ {
        observer: null
    }

    this.cacheResponse(window.location.href, document)
    this.initEvents()
}

/**
 * Initialize events necessary for navigation
 *
 * @private
 */
Pathway.prototype.initEvents = function () {

    if (this.options.popstateEvent) {
        window.addEventListener('popstate', () => {
            this.navigate(window.location.href, null, false)
        })
    }

    if (this.options.clickEvent) {
        window.addEventListener('click', event => {
            const target    = /**@type HTMLAnchorElement */ event.target
            const href      = target.href

            if (target.tagName.toLowerCase() !== 'a' || !href) {
                return
            }

            if (target.matches(this.options.excludeLinkSelector)) {
                return
            }

            if (href.match('mailto:')) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            if(window.location.pathname === href || window.location.href === href) {
                return
            }

            const state = {...target.dataset}
            this.navigate(href, state, this.options.updateRouterHistory)
        })
    }

    if (this.options.mutationObserver) {
        this.mutation.observer = new MutationObserver((mutationList, observer) => {
            this.mutationHandler(mutationList, observer)
        })
    }

    this.history.push({
        url:   window.location.href,
        title: document.title,
        state: null
    })

    if(this.options.preloadLinkSelector) {
        this.cacheContainerLinks()
    }
}

/**
 * Searching for all the links that they are marked as "cachable" and performing for each one
 * a fetch request to store them in cache ahead of time
 *
 * @private
 */
Pathway.prototype.cacheContainerLinks = function () {
    const links = document.body.querySelectorAll(this.options.preloadLinkSelector)

    const sortWeightedLinks = (a, b) => {
        const dataAttribute = this.options.preloadLinkSelector.replace(/[\[\]]/g, "")

        const aPreloadWeight = a.getAttribute(dataAttribute)
        const bPreloadWeight = b.getAttribute(dataAttribute)

        return aPreloadWeight > bPreloadWeight ? 1 : aPreloadWeight < bPreloadWeight ? -1 : 0
    }

    Array.from(links).sort(sortWeightedLinks).forEach(link => {
        const href = link.href

        if (!this.cache.has(href) && !href.match('mailto:')) {
            this.fetchLink(href)
        }
    })
}

/**
 * Performing a GET request to the route and passing the response in the cache
 *
 * @param {string} url
 * @param {function} [resolve]
 * @param {function} [reject]
 *
 * @private
 */
Pathway.prototype.fetchLink = function (url, resolve, reject) {
    const request = new Request(url, {
        method: 'GET',
        headers: new Headers({
            "Accept": "text/html; charset=UTF-8"
        })
    })

    if (this.cache.has(url) && resolve) {
        return resolve(this.__get(url))
    }

    this.isLoading = true
    this.options.onLoadingChange(this, true)

    const roundCodeNumber = code => {
        return Math.trunc(code/100) * 100
    }

    window.fetch(request)
        .then(async response => {
            if (roundCodeNumber(response.status) !== 200) {
                throw new Error(`(ERROR) Request failed with status code ${response.status}`)
            }

            const html = await response.text()
            const parser = new DOMParser()

            const document = parser.parseFromString(html, 'text/html')
            const cached = this.cacheResponse(url, document)

            if (resolve) resolve(cached)
        })
        .catch(error => {
            console.warn('(ERROR) Parse document:', error)
            if (reject) reject(error)

            this.options.onError(this, error)
        })
        .finally(() => {
            this.isLoading = false
            this.options.onLoadingChange(this, false)
        })
}

/**
 * Performing the actual navigation between the routes.
 *
 * @param {string} url
 * @param {Object} historyState
 * @param {boolean} updateHistory
 *
 * @private
 */
Pathway.prototype.navigate = function (url, historyState, updateHistory) {
    if (this.isLoading) return

    this.options.onNavigate(this, url)

    setTimeout(async () => {
        this.options.onBeforeLeave(this)

        const contentData = await this.waitFetch(url)
        this.updateDocument(contentData, historyState, updateHistory)

    }, this.options.transitionDuration)
}

/**
 * Update the document with the newly received data and update the router object
 *
 * @param {CacheState} data
 * @param {Object} historyState
 * @param {boolean} updateHistory
 *
 * @private
 */
Pathway.prototype.updateDocument = function (data, historyState, updateHistory) {
    if (updateHistory)
        window.history.pushState(historyState, null, data.url)

    else
        window.history.replaceState(historyState, null, data.url)

    this.history.splice(0, this.history.length - this.options.historyStackSize)
    this.history.push({
        url:    data.url,
        title:  data.title,
        state:  historyState
    })

    document.title = data.title

    if (this.mutation.observer) {
        this.mutation.observer.observe(this.container.parentElement, { childList: true })
    }

    this.options.onBeforeRender(this)

    this.container.replaceWith(data.content)
}

/**
 * Checks if the container has been updated and performs resets
 *
 * @param {MutationRecord[]} mutationList
 * @param {MutationObserver} observer
 *
 * @private
 */
Pathway.prototype.mutationHandler = function (mutationList, observer) {
    for (const mutation of mutationList) {
        if (mutation.type !== "childList") continue

        this.container = mutation.addedNodes[0]
        this.options.onAfterRender(this)

        if (this.options.preloadLinkSelector) {
            this.cacheContainerLinks()
        }

        observer.disconnect()

        break
    }
}

/**
 * Waiting for the fetch to resolve and the data to be cached
 *
 * @param {string} href
 *
 * @returns {Promise}
 * @private
 */
Pathway.prototype.waitFetch = async function (href) {
    try {
        return await new Promise((resolve, reject) => this.fetchLink(href, resolve, reject))
    }
    catch (error) {
        console.warn('(ERROR) Async Fetch:', error)
    }
}

/**
 * Cache the fetch response for quick later use
 *
 * @param {string} url
 * @param {Document} response
 *
 * @returns {CacheState}
 *
 * @private
 */
Pathway.prototype.cacheResponse = function (url, response) {
    const content = this.parseResponse(response)
    const title = response.title

    const cacheData = {title, content, url}
    return this.__set(url, cacheData)
}

/**
 * Parse the response and get the content of the container
 *
 * @param {Document} document
 *
 * @private
 */
Pathway.prototype.parseResponse = function (document) {
    return document.querySelector(this.options.containerSelector) || document.body
}

/**
 * Retrieve cache state with a given key
 *
 * @param {string} key
 * @returns {CacheState}
 *
 * @private
 */
Pathway.prototype.__get = function (key) {
    if (!this.cache.has(key))
        return undefined

    let cache_value = this.cache.get(key)

    this.cache.delete(key)
    this.cache.set(key, cache_value)

    return cache_value
}

/**
 * Store a history state to the cache
 *
 * @param {string} key
 * @param {CacheState} value
 *
 * @returns {CacheState}
 *
 * @private
 */
Pathway.prototype.__set = function (key, value) {
    this.cache.delete(key)

    if (this.options.cacheCapacity <= 0)
        return value

    if (this.cache.size === this.options.cacheCapacity) {
        this.cache.delete(this.cache.keys().next().value)
        this.cache.set(key, value)
    }

    else {
        this.cache.set(key, value)
    }

    return value
}

/**
 * LRU retrieval method
 *
 * @returns {[string, {title:string, url:string,content:HTMLElement }]}
 */
Pathway.prototype.getLeastRecent = function () {
    return Array.from(this.cache)[0]
}

/**
 * MRU retrieval method
 *
 * @returns {[string, {title:string, url:string,content:HTMLElement }]}}
 */
Pathway.prototype.getMostRecent = function () {
    return Array.from(this.cache)[this.cache.size - 1]
}

export default Pathway